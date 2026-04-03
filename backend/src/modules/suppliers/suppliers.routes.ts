import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, asyncHandler, validateRequest } from '../../middleware/auth';
import * as supplierController from './suppliers.controller';

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
  authenticate as any,

  asyncHandler(supplierController.getSuppliers)
);

/**
 * GET /api/suppliers/:id
 */
router.get(
  '/:id',
  authenticate as any,

  asyncHandler(supplierController.getSupplierById)
);

/**
 * POST /api/suppliers
 */
router.post(
  '/',
  authenticate as any,

  authorize('ADMIN', 'MANAGER'),
  validateRequest(supplierSchema),
  asyncHandler(supplierController.createSupplier)
);

/**
 * PUT /api/suppliers/:id
 */
router.put(
  '/:id',
  authenticate as any,

  authorize('ADMIN', 'MANAGER'),
  validateRequest(supplierSchema.partial()),
  asyncHandler(supplierController.updateSupplier)
);

/**
 * GET /api/suppliers/:id/purchases
 */
router.get(
  '/:id/purchases',
  authenticate as any,

  asyncHandler(supplierController.getSupplierPurchases)
);

export default router;
