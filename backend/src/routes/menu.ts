import { Router } from 'express';
import { prisma } from '../common/prisma';
import { asyncHandler, validateRequest } from '../middleware/auth';
// @ts-expect-error - IDE sync issue with Prisma Client enums
import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { sendWhatsAppBill } from '../lib/whatsapp';
import { getCache, setCache, deleteCache } from '../common/cache';
import { emitToShop } from '../lib/socket';
import { logger } from '../lib/logger';
import { generateInvoicePDF } from '../lib/invoice';
import { applyPricingRules } from '../lib/pricing';
import rateLimit from 'express-rate-limit';

const MENU_CACHE_TTL = 300; // 5 minutes

/**
 * Public Menu Rate Limiters
 * Prevents automated scraping and order spam.
 */
const menuLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many menu requests. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many order attempts. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

/**
 * GET /api/menu?shopId=...
 * Unified endpoint: returns shop + categories + products in one response.
 * Implements a "Double-Layer" cache: Redis (5m) and Browser Cache (1m).
 */
router.get('/', menuLimiter, asyncHandler(async (req, res) => {
  const { shopId, fresh } = req.query;
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId query is required' });

  const cacheKey = `menu:${shopId}`;

  // If fresh=true, delete stale cache first
  if (fresh === 'true') {
    await deleteCache(cacheKey);
    logger.info(`[MENU] Cache cleared for shop ${shopId}`);
  }

  try {
    // 1. Redis-first: try cache (skip if fresh=true)
    if (fresh !== 'true') {
      const cached = await getCache<any>(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
        return res.json(cached);
      }
    }

    // 2. DB fallback: parallel queries for performance
    const [shop, categories, products] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: shopId },
        select: { name: true, logoUrl: true, pricingEnabled: true, pricingRules: true, loyaltyRate: true, redeemRate: true } as any
      }) as any,
      prisma.category.findMany({
        where: { shopId },
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' }
      }),
      prisma.product.findMany({
        where: { shopId, isActive: true },
        select: {
          id: true, name: true, sellingPrice: true, stock: true,
          imageUrl: true, description: true, taxRate: true, categoryId: true,
          isAvailable: true
        },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      }),
    ]);

    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    logger.info(`[MENU] Loaded ${products.length} products for shop "${shop.name}"`);

    // 2.5 Apply Dynamic Pricing Rules
    const dynamicProducts = applyPricingRules(products, shop);
    const payload = { 
      shop, 
      categories, 
      products: dynamicProducts,
      loyaltyRate: (shop as any).loyaltyRate,
      redeemRate: (shop as any).redeemRate
    };

    // 3. Cache the result
    await setCache(cacheKey, payload, MENU_CACHE_TTL);

    res.set('X-Cache', 'MISS');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.json(payload);
  } catch (error: any) {
    logger.error(`[MENU] Failed to fetch menu: ${error.message}`, { shopId });
    return res.status(500).json({ error: 'Failed to retrieve menu. Please try again later.' });
  }
}));

/**
 * GET /api/menu/recommendations?shopId=...&cartItemIds=id1,id2
 * AI Upsell Engine: suggests high-margin items not already in cart.
 */
router.get('/recommendations', menuLimiter, asyncHandler(async (req, res) => {
  const { shopId, cartItemIds = '' } = req.query;
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId required' });

  const ignoreIds = (cartItemIds as string).split(',').filter(Boolean);

  try {
    // 1. Get Top 10 Popular Items (by sales volume)
    const popularData = await prisma.orderItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      where: { order: { shopId } },
      orderBy: { _count: { productId: 'desc' } },
      take: 10
    });
    const popularIds = popularData.map(d => d.productId);

    // 2. Fetch Products (prioritizing high-margin/popular)
      const products = await prisma.product.findMany({
      where: { 
        shopId, 
        isActive: true, 
        isAvailable: true,
        id: { notIn: ignoreIds }
      },
      select: { 
        id: true, name: true, sellingPrice: true, costPrice: true, 
        imageUrl: true, taxRate: true, stock: true, description: true, categoryId: true
      },
      take: 20
    });

    // 3. Score and Sort: (Selling - Cost) * (Popularity Bonus)
    const scored = products.map(p => {
      const margin = Number(p.sellingPrice) - Number(p.costPrice || 0);
      const isPopular = popularIds.includes(p.id);
      const score = margin * (isPopular ? 1.5 : 1.0);
      return { ...p, score };
    });

    const recommendations = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score, costPrice, ...rest }) => rest); // Hide internal score/cost from public API

    return res.json({ recommendations });
  } catch (error: any) {
    logger.error(`[MENU] Recommendations failed: ${error.message}`);
    return res.json({ recommendations: [] }); // Fallback to empty instead of error
  }
}));


const publicOrderSchema = z.object({
  shopId: z.string().min(1),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().max(20).optional().nullable(),
  tableNumber: z.string().optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD']).optional(),
  redeemPoints: z.number().int().nonnegative().optional().default(0),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive() // Automatically rejects negative quantities
  })).min(1)
});

/**
 * POST /api/menu/order
 * Public endpoint for scanner menu orders.
 * Handles customer creation, loyalty points, and real-time kitchen notification.
 */
router.post('/order', orderLimiter, validateRequest(publicOrderSchema), asyncHandler(async (req, res) => {
  const { customerName, customerPhone, tableNumber, notes, paymentMethod, items, redeemPoints = 0, shopId } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items in order' });
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId is required' });

  try {
    const shop = await prisma.shop.findUnique({ 
      where: { id: shopId }, 
      include: { users: { take: 1, select: { id: true } } } 
    });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    
    const loyaltyRate = (shop as any).loyaltyRate || 0.1;
    
    const userId = shop.users[0]?.id;
    if (!userId) {
      logger.error(`[MENU] Shop ${shopId} has no active users to assign orders to.`);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Resolve Customer — normalize phone FIRST to prevent duplicate records
    // Same normalization logic as /customer lookup endpoint
    let customerId: string | null = null;
    if (customerPhone) {
      const normalizedPhone = customerPhone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
      let cust = await prisma.customer.findFirst({
        where: {
          shopId: shop.id,
          OR: [
            { phone: normalizedPhone },
            { phone: { contains: normalizedPhone } }
          ]
        }
      });
      if (!cust) {
        cust = await prisma.customer.create({
          data: { shopId: shop.id, name: customerName || 'Walk-in', phone: normalizedPhone }
        });
      }
      if (redeemPoints > 0 && cust.loyaltyPoints < redeemPoints) {
        return res.status(400).json({ error: `Insufficient points. You only have ${cust.loyaltyPoints}` });
      }
      customerId = cust.id;
    } else if (redeemPoints > 0) {
      return res.status(400).json({ error: 'A valid phone number is required to redeem points' });
    }

    // Pricing & Validation — always fetch from DB with shopId guard (NEVER trust client prices)
    const productIds = items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({ 
      where: { 
        id: { in: productIds },
        shopId: shop.id,          // ← CRITICAL: verify all products belong to THIS shop
        isActive: true,           // only orderable active products
        isAvailable: true         // only orderable available products
      },
      select: { id: true, name: true, sellingPrice: true, costPrice: true, taxRate: true, categoryId: true, stock: true }
    });

    // Ensure every requested product was found in this shop
    const foundIds = new Set(dbProducts.map((p: any) => p.id));
    for (const item of items) {
      if (!foundIds.has(item.productId)) {
        return res.status(400).json({ error: `Product not found or not available in this menu.` });
      }
    }

    let subtotal = 0;
    // Apply Pricing Rules for backend Price protection
    const productsWithPricing = applyPricingRules(dbProducts, shop);

    const orderItems = items.map((i: any) => {
      const p = productsWithPricing.find((x: any) => x.id === i.productId);
      if (!p) throw new Error('Product not found: ' + i.productId);
      
      // Price is ALWAYS taken from DB — client-sent price is ignored entirely
      const priceToUse = p.discountedPrice || Number(p.sellingPrice);
      const amount = priceToUse * i.quantity;
      subtotal += amount;
      return {
        productId: p.id,
        name: p.name,
        quantity: i.quantity,
        unitPrice: priceToUse,    // DB price, never client price
        costPrice: p.costPrice || 0,
        taxRate: p.taxRate || 0,
        discount: 0,
        total: amount
      };
    });

    const taxAmount = orderItems.reduce((s: number, i: any) => s + i.total * (Number(i.taxRate) / 100), 0);
    const totalAmount = subtotal + taxAmount;
    const pointsDiscount = Number(redeemPoints) / ((shop as any).redeemRate || 10);
    const finalTotal = Math.max(0, totalAmount - pointsDiscount);

    // Payment Strategy
    const pm = (paymentMethod as PaymentMethod) || PaymentMethod.CASH;
    const paymentStatus = pm === 'CASH' ? 'UNPAID' : 'PAID';

    // Create Order atomically — count inside transaction prevents duplicate invoice numbers
    const { order, invoiceNumber, tokenNumber } = await prisma.$transaction(async (tx) => {
      const count = await tx.order.count({ where: { shopId: shop.id } });
      const newInvoiceNumber = `ONL-${String(count + 1).padStart(6, '0')}`;
      const newTokenNumber = ((count % 9999) + 1).toString().padStart(4, '0');

      const order = await tx.order.create({
        data: {
          shopId: shop.id,
          userId,
          customerId,
          invoiceNumber: newInvoiceNumber,
          subtotal,
          taxAmount,
          discountAmount: pointsDiscount,
          totalAmount: finalTotal,
          paidAmount: paymentStatus === 'PAID' ? finalTotal : 0,
          paymentMethod: pm,
          paymentStatus: paymentStatus as any,
          status: 'PENDING' as any,
          notes: (tableNumber ? 'Table: ' + tableNumber + '. ' : '') + (notes || ''),
          items: { create: orderItems },
        },
        include: { items: true },
      });
      return { order, invoiceNumber: newInvoiceNumber, tokenNumber: newTokenNumber };
    });

    // Side Effects
    logger.info(`[MENU] Scanner Order created: ${invoiceNumber} for Shop ${shop.id}`);
    emitToShop(shop.id, 'ORDER_CREATED', { ...order, status: 'PENDING' });

    // Stock & Loyalty updates (Deferred for performance)
    updatePostOrderMetrics(shop.id, items, orderItems, invoiceNumber, customerId, Number(redeemPoints), finalTotal, paymentStatus, pm, customerPhone, loyaltyRate).catch(err => {
      logger.warn(`[MENU] Deferred updates failed for ${invoiceNumber}: ${err.message}`);
    });

    return res.status(201).json({
      order,
      invoiceNumber,
      tokenNumber,
      paymentStatus,
      whatsappSent: !!(customerPhone && paymentStatus === 'PAID'),
    });

  } catch (error: any) {
    logger.error(`[MENU] Order placement failed: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
}));

/**
 * GET /api/menu/customer
 * Endpoint for looking up customer name and loyalty points by phone number.
 */
router.get('/customer', asyncHandler(async (req, res) => {
  const { phone, shopId } = req.query;
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' });
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId required' });

  try {
    const digits = phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
    const cust = await prisma.customer.findFirst({
      where: { 
        shopId, 
        OR: [
          { phone: digits },
          { phone: { contains: digits } },
          { phone: phone }
        ]
      },
      select: { name: true, loyaltyPoints: true }
    });

    if (!cust) return res.json({});
    return res.json(cust);
  } catch (error: any) {
    logger.error(`[MENU] Customer lookup failed: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/menu/orders
 * Returns history for a specific customer phone.
 */
router.get('/orders', asyncHandler(async (req, res) => {
  const { phone, shopId } = req.query;
  if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' });
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId required' });

  try {
    const digits = phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
    const cust = await prisma.customer.findFirst({
      where: { shopId, phone: { contains: digits } }
    });

    if (!cust) return res.json({ orders: [] });

    const orders = await prisma.order.findMany({
      where: { customerId: cust.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json({ orders });
  } catch (error: any) {
    logger.error(`[MENU] History fetch failed: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
}));

/**
 * GET /api/menu/order/:id/status
 * Polling endpoint for scanner menu clients.
 */
router.get('/order/:id/status', asyncHandler(async (req, res) => {
  const { shopId } = req.query;
  if (!shopId || typeof shopId !== 'string') {
    return res.status(400).json({ error: 'shopId query parameter is required' });
  }
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, shopId },
    select: { paymentStatus: true, status: true }
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json(order);
}));

/**
 * GET /api/menu/order/:id/invoice?shopId=...
 * Generates PDF invoice. shopId required to prevent cross-shop PII leak.
 */
router.get('/order/:id/invoice', asyncHandler(async (req, res) => {
  const { shopId } = req.query;
  if (!shopId || typeof shopId !== 'string') {
    return res.status(400).json({ error: 'shopId query parameter is required' });
  }
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, shopId },
      include: { items: true, customer: true, shop: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.invoiceNumber}.pdf`);

    const doc = generateInvoicePDF(order, order.shop);
    doc.pipe(res);
  } catch (error: any) {
    logger.error(`[MENU] PDF generation failed: ${error.message}`);
    return res.status(500).json({ error: 'Failed to generate invoice' });
  }
}));

/**
 * Post-order metrics update handler.
 * Deducts stock, updates loyalty, and sends WhatsApp notifications.
 */
async function updatePostOrderMetrics(
  shopId: string,
  items: any[],
  orderItems: any[],      // resolved order items with actual prices
  invoiceNumber: string,  // real invoice number for WhatsApp
  customerId: string | null,
  redeemPoints: number,
  finalTotal: number,
  paymentStatus: string,
  paymentMethod: any,     // actual payment method (not hardcoded)
  customerPhone: string | null,
  loyaltyRate: number
) {
  // 1. Stock Deduction & Low Stock Alert
  for (const item of items) {
    const affected = await prisma.$executeRaw`
      UPDATE "Product"
      SET stock = stock - ${item.quantity}
      WHERE id = ${item.productId} AND "shopId" = ${shopId} AND stock >= ${item.quantity}
    `;

    if (affected === 0) {
      logger.warn(`[STOCK] Stock deduction failed or insufficient for Product ${item.productId} in Shop ${shopId}`);
    }

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, stock: true, lowStockAlert: true }
    });

    if (product && product.stock <= product.lowStockAlert) {
      logger.warn(`[STOCK] Low stock alert for Shop ${shopId}: ${product.name} at ${product.stock}`);
      emitToShop(shopId, 'STOCK_LOW', { productId: product.id, name: product.name, currentStock: product.stock });
    }
  }

  // 2. Loyalty & WhatsApp
  if (customerId) {
    const pointsEarned = paymentStatus === 'PAID' ? Math.floor(finalTotal * loyaltyRate) : 0;
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalPurchases: paymentStatus === 'PAID' ? { increment: finalTotal } : undefined,
        loyaltyPoints: { increment: pointsEarned - redeemPoints }
      } as any
    });

    if (customerPhone && paymentStatus === 'PAID') {
      const updatedCustomer = (await prisma.customer.findUnique({ where: { id: customerId } })) as any;
      const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } });
      
      await sendWhatsAppBill(customerPhone, {
          invoiceNumber,
          items: orderItems.map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
          subtotal: orderItems.reduce((s: number, i: any) => s + Number(i.total), 0),
          taxAmount: orderItems.reduce((s: number, i: any) => s + Number(i.total) * (Number(i.taxRate) / 100), 0),
          discountAmount: redeemPoints > 0 ? redeemPoints / 10 : 0,
          totalAmount: Number(finalTotal),
          paymentMethod,
          paymentStatus: 'PAID'
        },
        shop?.name || 'Shop',
        pointsEarned,
        updatedCustomer?.loyaltyPoints
      ).catch(e => logger.warn(`[MENU] WhatsApp failed: ${e.message}`));
    }
  }
}

export default router;
