import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest } from '../middleware/auth';

const router = Router();

const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional()
});

/**
 * GET /api/suppliers
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
          { phone: { contains: search as string, mode: 'insensitive' } }
        ]
      })
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' }
      }),
      prisma.supplier.count({ where })
    ]);

    res.json({
      suppliers,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
    });
  })
);

/**
 * POST /api/suppliers
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(supplierSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const supplier = await prisma.supplier.create({
      data: {
        shopId: req.user!.shopId,
        ...req.body
      }
    });

    res.status(201).json(supplier);
  })
);

/**
 * GET /api/suppliers/:id
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  })
);

/**
 * PUT /api/suppliers/:id
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(supplierSchema.partial()),
  asyncHandler(async (req: AuthRequest, res) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(updated);
  })
);

/**
 * GET /api/suppliers/:id/purchases
 */
router.get(
  '/:id/purchases',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const purchases = await prisma.purchase.findMany({
      where: {
        supplierId: req.params.id,
        shopId: req.user!.shopId
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(purchases);
  })
);

export default router;
