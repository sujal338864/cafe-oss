import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, asyncHandler, validateRequest, tenantContext } from '../../middleware/auth';
import * as categoryController from './categories.controller';

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
  authenticate as any,
  tenantContext,
  asyncHandler(categoryController.getCategories)
);

/**
 * POST /api/categories
 */
router.post(
  '/',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(categorySchema),
  asyncHandler(categoryController.createCategory)
);

/**
 * PUT /api/categories/:id
 */
router.put(
  '/:id',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  validateRequest(categorySchema.partial()),
  asyncHandler(categoryController.updateCategory)
);

/**
 * DELETE /api/categories/:id
 */
router.delete(
  '/:id',
  authenticate as any,
  tenantContext,
  authorize('ADMIN'),
  asyncHandler(categoryController.deleteCategory)
);

export default router;
