import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/shop/profile
 */
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const shop = await prisma.shop.findUnique({
      where: { id: req.user!.shopId }
    });

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json(shop);
  })
);

/**
 * PUT /api/shop/profile
 */
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, phone, email, address, currency } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.user!.shopId },
      data: { name, phone, email, address, currency }
    });

    res.json(shop);
  })
);

/**
 * POST /api/shop/demo-data
 * Hydrates empty shop with sample categories, products, and orders for onboarding
 */
router.post(
  '/demo-data',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const shopId = req.user!.shopId;

    // 1. Safety Guard: Only allow if no products exist
    const productCount = await prisma.product.count({ where: { shopId } });
    if (productCount > 0) {
      return res.status(400).json({ error: 'Demo data can only be loaded for empty shops.' });
    }

    // 2. Create Sample Categories
    const cat1 = await prisma.category.create({ data: { shopId, name: 'Beverages', color: '#c084fc' } });
    const cat2 = await prisma.category.create({ data: { shopId, name: 'Snacks', color: '#3b82f6' } });

    // 3. Create Sample Products
    const p1 = await prisma.product.create({ data: { shopId, categoryId: cat1.id, name: 'Filter Coffee', costPrice: 20, sellingPrice: 50, stock: 100 } });
    const p2 = await prisma.product.create({ data: { shopId, categoryId: cat1.id, name: 'Cold Brew',   costPrice: 40, sellingPrice: 90, stock: 40  } });
    const p3 = await prisma.product.create({ data: { shopId, categoryId: cat2.id, name: 'Nachos Grid',  costPrice: 30, sellingPrice: 70, stock: 8, lowStockAlert: 10 } }); // low stock trigger

    // 4. Create Sample Customer
    const customer = await prisma.customer.create({ data: { shopId, name: 'Common Walk-in', phone: '9000000000' } });

    // 5. Create 5 sample orders distributed over last 3 months
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(now.getDate() - (i * 12)); // Backdate 12 days increments

      await prisma.order.create({
        data: {
          shopId,
          customerId: customer.id,
          userId: req.user!.id,
          invoiceNumber: `DEMO-${Date.now()}-${i}`,
          subtotal: 160,
          totalAmount: 160,
          paidAmount: 160,
          status: 'COMPLETED',
          createdAt: d,
          items: {
            create: [
              { productId: p1.id, name: 'Filter Coffee', quantity: 2, costPrice: 20, unitPrice: 50, total: 100 },
              { productId: p2.id, name: 'Cold Brew',   quantity: 1, costPrice: 40, unitPrice: 60, total: 60 }
            ]
          }
        }
      });
    }

    res.json({ message: 'Demo data loaded successfully' });
  })
);

/**
 * POST /api/shop/upgrade
 * Simulates upgrading the shop's subscription tier
 */
router.post(
  '/upgrade',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const shopId = req.user!.shopId;
    const { plan } = req.body;

    if (!['STARTER', 'PRO', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: { plan }
    });

    res.json({ message: `Successfully upgraded to ${plan}`, shop });
  })
);

/**
 * PUT /api/shop/invoice-settings
 */
router.put(
  '/invoice-settings',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { invoiceSettings } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.user!.shopId },
      data: { invoiceSettings }
    });
    res.json(shop);
  })
);

export default router;
