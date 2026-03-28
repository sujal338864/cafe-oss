import { Router } from 'express';
import { prisma } from '../index';
import { asyncHandler } from '../middleware/auth';
import { PaymentMethod } from '@prisma/client';
import { sendWhatsAppBill } from '../lib/whatsapp';
import { getCache, setCache } from '../common/cache';
import { emitToShop } from '../lib/socket';
import { logger } from '../lib/logger';
import { generateInvoicePDF } from '../lib/invoice';
import { applyPricingRules } from '../lib/pricing';
import rateLimit from 'express-rate-limit';

const POINTS_PER_RUPEE = parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE || '0.1');
const REDEEM_RATE = parseFloat(process.env.LOYALTY_REDEEM_RATE || '10');
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
  const { shopId } = req.query;
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId query is required' });

  const cacheKey = `menu:${shopId}`;

  try {
    // 1. Redis-first: try cache
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
      return res.json(cached);
    }

    // 2. DB fallback: parallel queries for performance
    const [shop, categories, products] = await Promise.all([
      prisma.shop.findUnique({
        where: { id: shopId },
        select: { name: true, logoUrl: true, currency: true, pricingEnabled: true, pricingRules: true }
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

    // 2.5 Apply Dynamic Pricing Rules
    const dynamicProducts = applyPricingRules(products, shop);
    const payload = { shop, categories, products: dynamicProducts };

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
        stock: { gt: 0 },
        id: { notIn: ignoreIds }
      },
      select: { 
        id: true, name: true, sellingPrice: true, costPrice: true, 
        imageUrl: true, description: true, stock: true 
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


/**
 * POST /api/menu/order
 * Public endpoint for scanner menu orders.
 * Handles customer creation, loyalty points, and real-time kitchen notification.
 */
router.post('/order', orderLimiter, asyncHandler(async (req, res) => {
  const { customerName, customerPhone, tableNumber, notes, paymentMethod, items, redeemPoints = 0, shopId } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items in order' });
  if (!shopId || typeof shopId !== 'string') return res.status(400).json({ error: 'shopId is required' });

  try {
    const shop = await prisma.shop.findUnique({ 
      where: { id: shopId }, 
      include: { users: { take: 1, select: { id: true } } } 
    });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    
    const userId = shop.users[0]?.id;
    if (!userId) {
      logger.error(`[MENU] Shop ${shopId} has no active users to assign orders to.`);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Resolve Customer
    let customerId: string | null = null;
    if (customerPhone) {
      const digits = customerPhone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
      let cust = await prisma.customer.findFirst({ where: { shopId: shop.id, phone: { contains: digits } } });
      if (!cust) {
        cust = await prisma.customer.create({
          data: { shopId: shop.id, name: customerName || 'Walk-in', phone: customerPhone }
        });
      }
      customerId = cust.id;
    }

    // Pricing & Validation
    const productIds = items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({ where: { id: { in: productIds } } });

    let subtotal = 0;
    // Apply Pricing Rules for backend Price protection
    const productsWithPricing = applyPricingRules(dbProducts, shop);

    const orderItems = items.map((i: any) => {
      const p = productsWithPricing.find((x: any) => x.id === i.productId);
      if (!p) throw new Error('Product not found: ' + i.productId);
      
      const priceToUse = p.discountedPrice || Number(p.sellingPrice);
      const amount = priceToUse * i.quantity;
      subtotal += amount;
      return {
        productId: p.id,
        name: p.name,
        quantity: i.quantity,
        unitPrice: priceToUse,
        costPrice: p.costPrice || 0,
        taxRate: p.taxRate || 0,
        discount: 0,
        total: amount
      };
    });

    const taxAmount = orderItems.reduce((s: number, i: any) => s + i.total * (Number(i.taxRate) / 100), 0);
    const totalAmount = subtotal + taxAmount;
    const pointsDiscount = Number(redeemPoints) / REDEEM_RATE;
    const finalTotal = Math.max(0, totalAmount - pointsDiscount);

    // Meta Generation
    const count = await prisma.order.count({ where: { shopId: shop.id } });
    const invoiceNumber = `ONL-${String(count + 1).padStart(6, '0')}`;
    const tokenNumber = ((count % 9999) + 1).toString().padStart(4, '0');

    // Payment Strategy
    const pm = (paymentMethod as PaymentMethod) || PaymentMethod.CASH;
    const paymentStatus = pm === 'CASH' ? 'UNPAID' : 'PAID';

    // Create Order
    const order = await prisma.order.create({
      data: {
        shopId: shop.id,
        userId,
        customerId,
        invoiceNumber,
        subtotal,
        taxAmount,
        discountAmount: pointsDiscount,
        totalAmount: finalTotal,
        paidAmount: paymentStatus === 'PAID' ? finalTotal : 0,
        paymentMethod: pm,
        paymentStatus: paymentStatus as any,
        status: 'PENDING' as any, // Public orders always start as PENDING in kitchen
        notes: `[KITCHEN:PENDING] ${tableNumber ? 'Table: ' + tableNumber + '. ' : ''}${notes || ''}`,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    // Side Effects
    logger.info(`[MENU] Scanner Order created: ${invoiceNumber} for Shop ${shop.id}`);
    emitToShop(shop.id, 'ORDER_CREATED', { ...order, status: 'PENDING' });

    // Stock & Loyalty updates (Deferred for performance)
    updatePostOrderMetrics(shop.id, items, customerId, Number(redeemPoints), finalTotal, paymentStatus, customerPhone).catch(err => {
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
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { paymentStatus: true, status: true }
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json(order);
}));

/**
 * GET /api/menu/order/:id/invoice
 * Generates PDF invoice for public download.
 */
router.get('/order/:id/invoice', asyncHandler(async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
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
  customerId: string | null, 
  redeemPoints: number,
  finalTotal: number,
  paymentStatus: string,
  customerPhone: string | null
) {
  // 1. Stock Deduction & Low Stock Alert
  for (const item of items) {
    const product = await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
      select: { id: true, name: true, stock: true, lowStockAlert: true }
    });
    if (product.stock <= product.lowStockAlert) {
      logger.warn(`[STOCK] Low stock alert for Shop ${shopId}: ${product.name} at ${product.stock}`);
      emitToShop(shopId, 'STOCK_LOW', { productId: product.id, name: product.name, currentStock: product.stock });
    }
  }

  // 2. Loyalty & WhatsApp
  if (customerId) {
    const pointsEarned = paymentStatus === 'PAID' ? Math.floor(finalTotal * POINTS_PER_RUPEE) : 0;
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
          invoiceNumber: 'AUTO', // Re-fetching would be heavy, use summary
          items: [], 
          subtotal: 0, taxAmount: 0, discountAmount: 0, 
          totalAmount: Number(finalTotal), 
          paymentMethod: 'UPI', paymentStatus: 'PAID'
        }, 
        shop?.name || 'Shop', 
        pointsEarned, 
        updatedCustomer?.loyaltyPoints
      ).catch(e => logger.warn(`[MENU] WhatsApp failed: ${e.message}`));
    }
  }
}

export default router;
