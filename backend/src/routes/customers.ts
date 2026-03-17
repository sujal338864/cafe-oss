import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest } from '../middleware/auth';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional()
});

/**
 * GET /api/customers
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { page = '1', limit = '20', search = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      shopId: req.user!.shopId,
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ]
      })
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      customers,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
    });
  })
);

/**
 * POST /api/customers
 */
router.post(
  '/',
  authenticate,
  validateRequest(customerSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const customer = await prisma.customer.create({
      data: {
        shopId: req.user!.shopId,
        ...req.body
      }
    });

    res.status(201).json(customer);
  })
);


/**
 * GET /api/customers/lookup?phone=9876543210
 * Phone-first customer lookup for POS
 */
router.get(
  '/lookup',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone query param required' });
    }

    // Normalize: strip non-digits, handle leading 0 or +91
    const digits = phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');

    const customer = await prisma.customer.findFirst({
      where: {
        shopId: req.user!.shopId,
        phone: { contains: digits }
      },
      include: {
        orders: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, totalAmount: true }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ found: false, error: 'Customer not found' });
    }

    res.json({ found: true, customer });
  })
);

/**
 * GET /api/customers/:id
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  })
);

/**
 * PUT /api/customers/:id
 */
router.put(
  '/:id',
  authenticate,
  validateRequest(customerSchema.partial()),
  asyncHandler(async (req: AuthRequest, res) => {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(updated);
  })
);

/**
 * GET /api/customers/:id/orders
 */
router.get(
  '/:id/orders',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const orders = await prisma.order.findMany({
      where: {
        customerId: req.params.id,
        shopId: req.user!.shopId
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  })
);

export default router;
