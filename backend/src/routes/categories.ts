import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest } from '../middleware/auth';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  color: z.string().optional()
});

/**
 * GET /api/categories
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const categories = await prisma.category.findMany({
      where: { shopId: req.user!.shopId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });

    res.json({ categories });
  })
);

/**
 * POST /api/categories
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(categorySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, color } = req.body;

    const existing = await prisma.category.findFirst({
      where: { shopId: req.user!.shopId, name }
    });

    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const category = await prisma.category.create({
      data: {
        shopId: req.user!.shopId,
        name,
        color
      }
    });

    res.status(201).json(category);
  })
);

/**
 * PUT /api/categories/:id
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(categorySchema.partial()),
  asyncHandler(async (req: AuthRequest, res) => {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body
    });

    res.json(updated);
  })
);

/**
 * DELETE /api/categories/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await prisma.category.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  })
);

export default router;
