import { Router } from 'express';
import { authenticate, authorize, asyncHandler, validateRequest, tenantContext } from '../../middleware/auth';
import * as orderController from './orders.controller';
import { createOrderSchema } from './orders.validation';
import { idempotency } from '../../middleware/idempotency';

const router = Router();

/**
 * POST /api/orders
 */
router.post(
  '/',
  authenticate,
  idempotency,
  validateRequest(createOrderSchema),
  orderController.createOrder
);

/**
 * GET /api/orders
 */
router.get(
  '/',
  authenticate as any,
  tenantContext,
  asyncHandler(orderController.getOrders)
);

/**
 * GET /api/orders/kitchen  — Kitchen Display endpoint
 * MUST be before /:id or Express will match 'kitchen' as an id!
 */
router.get(
  '/kitchen',
  authenticate as any,
  tenantContext,
  asyncHandler(orderController.getKitchenOrders)
);

/**
 * GET /api/orders/:id
 */
router.get(
  '/:id',
  authenticate as any,
  tenantContext,
  asyncHandler(orderController.getOrderById)
);

/**
 * PUT /api/orders/:id/cancel
 */
router.put(
  '/:id/cancel',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(orderController.cancelOrder)
);

/**
 * PUT /api/orders/:id/payment
 */
router.put(
  '/:id/payment',
  authenticate as any,
  tenantContext,
  authorize('ADMIN', 'MANAGER'),
  idempotency,
  asyncHandler(orderController.updatePaymentStatus)
);

/**
 * PUT /api/orders/:id/status
 */
router.put(
  '/:id/status',
  authenticate as any,
  tenantContext,
  asyncHandler(orderController.updateOrderStatus)
);

/**
 * POST /api/orders/:id/whatsapp
 */
router.post(
  '/:id/whatsapp',
  authenticate as any,
  tenantContext,
  asyncHandler(orderController.resendWhatsApp)
);

export default router;
