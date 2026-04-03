import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validateRequest, asyncHandler } from '../../middleware/auth';
import * as customerController from './customers.controller';

const router = Router();

export const customerSchema = z.object({
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
  authenticate as any,

  asyncHandler(customerController.getCustomers)
);

/**
 * GET /api/customers/lookup
 */
router.get(
  '/lookup',
  authenticate as any,

  asyncHandler(customerController.lookupCustomer)
);

/**
 * GET /api/customers/:id
 */
router.get(
  '/:id',
  authenticate as any,

  asyncHandler(customerController.getCustomerById)
);

/**
 * POST /api/customers
 */
router.post(
  '/',
  authenticate as any,

  validateRequest(customerSchema),
  asyncHandler(customerController.createCustomer)
);

/**
 * PUT /api/customers/:id
 */
router.put(
  '/:id',
  authenticate as any,

  validateRequest(customerSchema.partial()),
  asyncHandler(customerController.updateCustomer)
);

/**
 * GET /api/customers/:id/orders
 */
router.get(
  '/:id/orders',
  authenticate as any,

  asyncHandler(customerController.getCustomerOrders)
);

export default router;
