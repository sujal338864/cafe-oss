import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/reports/sales
 */
router.get(
  '/sales',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { startDate, endDate, format = 'json' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const orders = await prisma.order.findMany({
      where: {
        shopId: req.user!.shopId,
        createdAt: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        },
        status: 'COMPLETED'
      },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' }
    });

    if (format === 'csv') {
      // TODO: Generate CSV
      res.json({ message: 'CSV export coming soon' });
    } else {
      res.json(orders);
    }
  })
);

/**
 * GET /api/reports/inventory
 */
router.get(
  '/inventory',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { format = 'json' } = req.query;

    const products = await prisma.product.findMany({
      where: { shopId: req.user!.shopId, isActive: true },
      include: { category: true }
    });

    if (format === 'csv') {
      // TODO: Generate CSV
      res.json({ message: 'CSV export coming soon' });
    } else {
      res.json(products);
    }
  })
);

/**
 * GET /api/reports/customers
 */
router.get(
  '/customers',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { format = 'json' } = req.query;

    const customers = await prisma.customer.findMany({
      where: { shopId: req.user!.shopId },
      orderBy: { totalPurchases: 'desc' }
    });

    if (format === 'csv') {
      // TODO: Generate CSV
      res.json({ message: 'CSV export coming soon' });
    } else {
      res.json(customers);
    }
  })
);

export default router;
