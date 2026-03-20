import { Router } from 'express';
import { prisma } from '../index';
import { asyncHandler } from '../middleware/auth';
import { PaymentMethod } from '@prisma/client';
import { sendWhatsAppBill } from '../lib/whatsapp';
import { getCache, setCache } from '../common/cache';

import { generateInvoicePDF } from '../lib/invoice';

const POINTS_PER_RUPEE = parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE || '0.1');
const MENU_CACHE_TTL = 300; // 5 minutes

const router = Router();

/**
 * GET /api/menu?shopId=...
 * Unified endpoint: returns shop + categories + products in one response.
 * Redis-cached with 5-minute TTL for ultra-fast responses.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { shopId } = req.query;
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId query is required' });

  const cacheKey = `menu:${shopId}`;

  // 1. Redis-first: try cache
  const cached = await getCache<any>(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.json(cached);
  }

  // 2. DB fallback: parallel queries
  const [shop, categories, products] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, logoUrl: true, currency: true }
    }),
    prisma.category.findMany({
      where: { shopId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' }
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true, stock: { gt: 0 } },
      select: {
        id: true, name: true, sellingPrice: true, stock: true,
        imageUrl: true, description: true, taxRate: true, categoryId: true
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    }),
  ]);

  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const payload = { shop, categories, products };

  // 3. Cache the result
  await setCache(cacheKey, payload, MENU_CACHE_TTL);

  res.set('X-Cache', 'MISS');
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
  return res.json(payload);
}));

// Public: get shop info (kept for backward compat)
router.get('/shop', asyncHandler(async (req, res) => {
  const { shopId } = req.query;
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId required' });

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { name: true }
  });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  res.json(shop);
}));

// Public: lookup customer loyalty points
router.get('/customer', asyncHandler(async (req, res) => {
  const { phone, shopId } = req.query;
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' });
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId required' });

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const digits = phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
  const cust = await prisma.customer.findFirst({
    where: { shopId: shop.id, phone: { contains: digits } }
  });

  if (!cust) return res.status(404).json({ error: 'Customer not found' });
  res.json({ loyaltyPoints: cust.loyaltyPoints || 0, name: cust.name });
}));

// Public: place order from scanner menu
router.post('/order', asyncHandler(async (req, res) => {
  const { customerName, customerPhone, tableNumber, notes, paymentMethod, items, redeemPoints = 0, shopId } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId is required' });

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, include: { users: { take: 1 } } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const userId = shop.users[0]?.id;
  if (!userId) return res.status(404).json({ error: 'No user found' });

  const REDEEM_RATE = parseFloat(process.env.LOYALTY_REDEEM_RATE || '10');

  // Find or create customer by phone
  let customerId: string | null = null;
  let customer: any = null;
  if (customerPhone) {
    const digits = customerPhone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
    let cust = await prisma.customer.findFirst({ where: { shopId: shop.id, phone: { contains: digits } } });
    if (!cust) {
      cust = await prisma.customer.create({
        data: { shopId: shop.id, name: customerName || 'Walk-in', phone: customerPhone }
      });
    }
    customerId = cust.id;
    customer = cust;
  }

  const productIds = items.map((i: any) => i.productId);
  const dbProducts = await prisma.product.findMany({ where: { id: { in: productIds } } });

  let subtotal = 0;
  const orderItems = items.map((i: any) => {
    const p = dbProducts.find((x: any) => x.id === i.productId);
    if (!p) throw new Error('Product not found: ' + i.productId);
    const amount = Number(p.sellingPrice) * i.quantity;
    subtotal += amount;
    return {
      productId: p.id,
      name: p.name,
      quantity: i.quantity,
      unitPrice: p.sellingPrice,
      costPrice: p.costPrice || 0,
      taxRate: p.taxRate || 0,
      discount: 0,
      total: amount
    };
  });

  const taxAmount = orderItems.reduce((s: number, i: any) => s + i.total * (Number(i.taxRate) / 100), 0);
  const totalAmount = subtotal + taxAmount;

  const count = await prisma.order.count({ where: { shopId: shop.id } });
  const invoiceNumber = 'ONL-' + String(count + 1).padStart(6, '0');

  // Token number: short 4-digit numeric token for "Pay at Counter" orders
  const tokenNumber = ((count % 9999) + 1).toString().padStart(4, '0');

  const pm = (paymentMethod as PaymentMethod) || PaymentMethod.CASH;
  // paymentMethod 'CASH' from scanner = Pay at Counter (UNPAID), 'UPI' = online (PAID)
  const paymentStatus = pm === 'CASH' ? 'UNPAID' : 'PAID';

  const pointsDiscount = Number(redeemPoints) / REDEEM_RATE;
  const discountAmount = pointsDiscount;
  const finalTotal = Math.max(0, totalAmount - pointsDiscount);

  const order = await prisma.order.create({
    data: {
      shopId: shop.id,
      userId,
      customerId,
      invoiceNumber,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount: finalTotal,
      paidAmount: paymentStatus === 'PAID' ? finalTotal : 0,
      paymentMethod: pm,
      paymentStatus: paymentStatus as any,
      status: 'COMPLETED',
      notes: (tableNumber ? 'Table: ' + tableNumber + '. ' : '') + (notes || ''),
      items: { create: orderItems },
    },
    include: { items: true },
  });

  // Deduct stock
  for (const item of items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } }
    });
  }

  // Update customer loyalty points (Earn/Deduct)
  if (customerId) {
    const pointsEarned = paymentStatus === 'PAID' ? Math.floor(finalTotal * POINTS_PER_RUPEE) : 0;
    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          totalPurchases: paymentStatus === 'PAID' ? { increment: finalTotal } : undefined,
          loyaltyPoints: { increment: pointsEarned - Number(redeemPoints) }
        } as any
      });
    } catch (e) { console.warn('Loyalty update failed:', e); }

    // WhatsApp bill for UPI orders
    try {
      if (customerPhone) {
        const updatedCustomer = (await prisma.customer.findUnique({ where: { id: customerId } })) as any;
        await sendWhatsAppBill(
          customerPhone,
          {
            invoiceNumber: order.invoiceNumber,
            items: order.items.map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
            subtotal: Number(order.subtotal),
            taxAmount: Number(order.taxAmount),
            discountAmount: 0,
            totalAmount: Number(order.totalAmount),
            paymentMethod: order.paymentMethod,
            paymentStatus: 'PAID',
          },
          shop.name,
          pointsEarned,
          updatedCustomer?.loyaltyPoints
        );
      }
    } catch (e) { console.warn('WhatsApp bill failed:', e); }
  }

  return res.status(201).json({
    order,
    invoiceNumber,
    tokenNumber,
    paymentStatus,
    whatsappSent: !!(customerPhone && paymentStatus === 'PAID'),
  });
}));

// GET /api/menu/orders
router.get('/orders', asyncHandler(async (req, res) => {
  const { phone, shopId } = req.query;
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' });
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId required' });

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const digits = phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
  const cust = await prisma.customer.findFirst({
    where: { shopId: shop.id, phone: { contains: digits } }
  });

  if (!cust) return res.json({ orders: [] });

  const orders = await prisma.order.findMany({
    where: { customerId: cust.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  res.json({ orders });
}));

// Public: check order status for scanner client polling
router.get('/order/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { paymentStatus: true, status: true }
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ paymentStatus: order.paymentStatus, status: order.status });
}));

// GET /api/menu/order/:id/invoice
router.get('/order/:id/invoice', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, customer: true }
  });

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const shop = await prisma.shop.findFirst();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.invoiceNumber}.pdf`);

  const doc = generateInvoicePDF(order, shop || { name: 'Our Shop' });
  doc.pipe(res);
}));

export default router;
