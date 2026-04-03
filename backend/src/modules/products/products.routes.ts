import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, asyncHandler, validateRequest, tenantContext } from '../../middleware/auth';
import * as productController from './products.controller';

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
 */
router.get(
  '/',
  authenticate as any,
  tenantContext,
  asyncHandler(productController.getProducts)
);

/**
 * GET /api/products/:id
 */
router.get(
  '/:id',
  authenticate as any,
  tenantContext,
  asyncHandler(productController.getProductById)
);

/**
 * POST /api/products
 */
router.post(
  '/',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(productSchema),
  asyncHandler(productController.createProduct)
);

/**
 * PUT /api/products/:id
 */
router.put(
  '/:id',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(productSchema.partial()),
  asyncHandler(productController.updateProduct)
);

/**
 * DELETE /api/products/:id
 */
router.delete(
  '/:id',
  authenticate as any,
  tenantContext,
  authorize('ADMIN'),
  asyncHandler(productController.deleteProduct)
);

/**
 * GET /api/products/:id/stock-history
 */
router.get(
  '/:id/stock-history',
  authenticate as any,
  tenantContext,
  asyncHandler(productController.getStockHistory)
);

/**
 * POST /api/products/:id/adjust-stock
 */
router.post(
  '/:id/adjust-stock',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(productController.adjustStock)
);

export default router;
