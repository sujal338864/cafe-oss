import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest } from '../middleware/auth';

const router = Router();

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.number().positive('Cost price must be positive'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  taxRate: z.number().min(0).max(100).default(0),
  stock: z.number().int().min(0).default(0),
  lowStockAlert: z.number().int().min(0).default(10),
  unit: z.string().default('pcs'),
  imageUrl: z.string().optional(),
});

/**
 * GET /api/products
 * Get all products with pagination and filters
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { page = '1', limit = '20', search = '', category, lowStock } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(1000, parseInt(limit as string) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      shopId: req.user!.shopId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { sku: { contains: search as string, mode: 'insensitive' } },
          { barcode: { contains: search as string, mode: 'insensitive' } }
        ]
      }),
      ...(category && { categoryId: category as string }),
      ...(lowStock === 'true' && {
        stock: { lte: prisma.product.fields.lowStockAlert }
      })
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limitNum,
        select: {
          id: true, name: true, sku: true, barcode: true,
          sellingPrice: true, costPrice: true, stock: true,
          lowStockAlert: true, unit: true, imageUrl: true,
          taxRate: true, category: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  })
);

/**
 * GET /api/products/:id
 * Get single product
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        shopId: req.user!.shopId
      },
      include: { category: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  })
);

/**
 * POST /api/products
 * Create new product
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(productSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = req.body;

    // Check SKU uniqueness if provided
    if (data.sku) {
      const existing = await prisma.product.findFirst({
        where: {
          shopId: req.user!.shopId,
          sku: data.sku
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'SKU already exists' });
      }
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        shopId: req.user!.shopId
      },
      include: { category: true }
    });

    res.status(201).json(product);
  })
);

/**
 * PUT /api/products/:id
 * Update product
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(productSchema.partial()),
  asyncHandler(async (req: AuthRequest, res) => {
    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        shopId: req.user!.shopId
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
      include: { category: true }
    });

    res.json(updated);
  })
);

/**
 * DELETE /api/products/:id
 * Soft delete product
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        shopId: req.user!.shopId
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ success: true, message: 'Product deleted' });
  })
);

/**
 * GET /api/products/:id/stock-history
 * Get stock history for product
 */
router.get(
  '/:id/stock-history',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { limit = '50' } = req.query;

    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        shopId: req.user!.shopId
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const history = await prisma.stockHistory.findMany({
      where: { productId: req.params.id },
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' }
    });

    res.json(history);
  })
);

/**
 * POST /api/products/:id/adjust-stock
 * Adjust stock manually
 */
router.post(
  '/:id/adjust-stock',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { quantity, note } = req.body;

    if (!quantity || typeof quantity !== 'number') {
      return res.status(400).json({ error: 'Quantity is required and must be a number' });
    }

    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        shopId: req.user!.shopId
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: req.params.id },
        data: {
          stock: { increment: quantity }
        }
      });

      await tx.stockHistory.create({
        data: {
          productId: req.params.id,
          type: 'ADJUSTMENT',
          quantity,
          note: note || 'Manual adjustment'
        }
      });

      return updatedProduct;
    });

    res.json(updated);
  })
);

export default router;
