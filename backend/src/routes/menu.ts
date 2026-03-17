import { Router } from 'express';
import { prisma } from '../index';
import { asyncHandler } from '../middleware/auth';
import { PaymentMethod } from '@prisma/client';
import { sendWhatsAppBill } from '../lib/whatsapp';

const POINTS_PER_RUPEE = parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE || '0.1');

const router = Router();

// Public: get menu products
router.get('/', asyncHandler(async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    include: { category: { select: { name: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });
  return res.json({ products });
}));

// Public: place order from scanner menu
router.post('/order', asyncHandler(async (req, res) => {
  const { customerName, customerPhone, tableNumber, notes, paymentMethod, items } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });

  const shop = await prisma.shop.findFirst({ include: { users: { take: 1 } } });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const userId = shop.users[0]?.id;
  if (!userId) return res.status(404).json({ error: 'No user found' });

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

  const order = await prisma.order.create({
    data: {
      shopId: shop.id,
      userId,
      customerId,
      invoiceNumber,
      subtotal,
      taxAmount,
      discountAmount: 0,
      totalAmount,
      paidAmount: paymentStatus === 'PAID' ? totalAmount : 0,
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

  // Award loyalty points for UPI (PAID) orders only
  if (customerId && paymentStatus === 'PAID') {
    const pointsEarned = Math.floor(totalAmount * POINTS_PER_RUPEE);
    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          totalPurchases: { increment: totalAmount },
          loyaltyPoints: { increment: pointsEarned }
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

export default router;
