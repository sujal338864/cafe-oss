import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as orderService from './orders.service';
import { prisma } from '../../index';
import { addWhatsAppJob } from '../../jobs/queues/whatsapp.queue';
import { addDashboardUpdateJob } from '../../jobs/queues/dashboard.queue';
import { emitToShop } from '../../lib/socket';
import { logger } from '../../lib/logger';

const POINTS_PER_RUPEE = parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE || '0.1');

/**
 * POST /api/orders
 * Main entry point for creating orders. Handles stock checks, loyalty points,
 * and triggers background jobs for notifications and dashboard updates.
 */
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const shopId = req.user!.shopId;
    const userId = req.user!.id;
    
    // Core business logic (Atomic)
    const order = await orderService.createOrder(shopId, userId, req.body);

    // ==========================================
    // NON-CRITICAL SIDE EFFECTS (Post-Commit)
    // ==========================================
    
    // 1. WhatsApp Notification
    if (order.customer?.phone && req.body.paymentStatus === 'PAID') {
      addWhatsAppJob({
        phone: order.customer.phone,
        billData: {
          invoiceNumber: order.invoiceNumber,
          items: order.items.map((i: any) => ({ 
            name: i.name, 
            quantity: i.quantity, 
            unitPrice: Number(i.unitPrice), 
            total: Number(i.total) 
          })),
          subtotal: Number(order.subtotal),
          taxAmount: Number(order.taxAmount),
          discountAmount: Number(order.discountAmount),
          totalAmount: Number(order.totalAmount),
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
        },
        shopName: 'Our Shop', // In production, fetch from shop config
        pointsEarned: Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE),
        currentLoyaltyPoints: order.customer?.loyaltyPoints
      }).catch(err => logger.warn(`[ORDER] WhatsApp job failed: ${err.message}`));
    }

    // 2. Dashboard & Socket Notification
    addDashboardUpdateJob(shopId).catch(err => logger.warn(`[ORDER] Dashboard job failed: ${err.message}`));
    
    const pointsEarned = req.body.customerId ? Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE) : 0;
    emitToShop(shopId, 'ORDER_CREATED', { ...order, pointsEarned });

    // 3. Low Stock Check (Deferred)
    productStockCheck(order.items).catch(err => logger.warn(`[ORDER] Stock check failed: ${err.message}`));

    return res.status(201).json({ ...order, pointsEarned });
    
  } catch (error: any) {
    logger.error(`[ORDER] Create failed: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * GET /api/orders
 * Paginated list of orders for the authenticated shop.
 */
export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', startDate, endDate, customerId, status, paymentStatus } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 20);
    const skip = (pageNum - 1) * limitNum;

    const { orders, total } = await orderService.getOrders(req.user!.shopId, {
      skip,
      take: limitNum,
      startDate: startDate as string,
      endDate: endDate as string,
      customerId: customerId as string,
      status: status as string,
      paymentStatus: paymentStatus as string
    });

    return res.json({ 
      orders, 
      pagination: { 
        total, 
        page: pageNum, 
        limit: limitNum, 
        pages: Math.ceil(total / limitNum) 
      } 
    });
  } catch (error: any) {
    logger.error(`[ORDER] List fetch failed: ${error.message}`);
    return res.status(500).json({ error: 'Failed to retrieve orders' });
  }
};

/**
 * GET /api/orders/:id
 */
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user!.shopId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json(order);
  } catch (error: any) {
    logger.error(`[ORDER] View failed: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/orders/:id/cancel
 */
export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    const updated = await orderService.cancelOrder(req.params.id, req.user!.shopId);
    
    // Background updates
    addDashboardUpdateJob(req.user!.shopId).catch(() => {});
    emitToShop(req.user!.shopId, 'ORDER_CANCELLED', { orderId: req.params.id });

    return res.json(updated);
  } catch (error: any) {
    logger.error(`[ORDER] Cancel failed: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * PATCH /api/orders/:id/payment
 */
export const updatePaymentStatus = async (req: AuthRequest, res: Response) => {
  const { paymentStatus } = req.body;
  
  if (!['PAID', 'PARTIAL', 'UNPAID'].includes(paymentStatus)) {
    return res.status(400).json({ error: 'Invalid payment status' });
  }

  try {
    const updated = await orderService.updatePaymentStatus(req.params.id, req.user!.shopId, paymentStatus);

    // Sync side effects for newly PAID orders
    if (paymentStatus === 'PAID') {
      try {
        if (updated.customerId) {
          const pointsEarned = Math.floor(Number(updated.totalAmount) * POINTS_PER_RUPEE);
          await prisma.customer.update({
            where: { id: updated.customerId },
            data: { loyaltyPoints: { increment: pointsEarned } } as any
          });
        }
      } catch (e) { 
        logger.warn(`[ORDER] Loyalty points sync failed: ${e instanceof Error ? e.message : 'Unknown'}`); 
      }
    }

    addDashboardUpdateJob(req.user!.shopId).catch(() => {});
    emitToShop(req.user!.shopId, 'ORDER_UPDATED', updated);

    return res.json(updated);
  } catch (error: any) {
    logger.error(`[ORDER] Payment update failed: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * GET /api/orders/kitchen
 */
export const getKitchenOrders = async (req: AuthRequest, res: Response) => {
  try {
    const orders = await orderService.getKitchenOrders(req.user!.shopId);
    return res.json({ orders });
  } catch (error: any) {
    logger.error(`[KITCHEN] Fetch failed: ${error.message}`);
    return res.status(500).json({ error: 'Failed to retrieve kitchen orders' });
  }
};

/**
 * PUT /api/orders/:id/status (Kitchen status)
 */
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
  }

  try {
    const updated = await orderService.updateKitchenStatus(req.params.id, req.user!.shopId, status);
    emitToShop(req.user!.shopId, 'ORDER_UPDATED', updated);
    return res.json(updated);
  } catch (error: any) {
    logger.error(`[KITCHEN] Status update failed: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * POST /api/orders/:id/resend-whatsapp
 */
export const resendWhatsApp = async (req: AuthRequest, res: Response) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user!.shopId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.customer?.phone) return res.status(400).json({ error: 'Customer has no phone number' });

    await addWhatsAppJob({
      phone: order.customer.phone,
      billData: {
        invoiceNumber: order.invoiceNumber,
        items: order.items.map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        discountAmount: Number(order.discountAmount),
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      },
      shopName: 'Our Shop',
      currentLoyaltyPoints: order.customer?.loyaltyPoints
    });

    return res.json({ sent: true, queued: true, phone: order.customer.phone });
  } catch (error: any) {
    logger.error(`[ORDER] Resend WhatsApp failed: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
};



/**
 * Internal: Audits stock levels after an order and logs alerts
 */
async function productStockCheck(items: any[]) {
  for (const item of items) {
    const product = await prisma.product.findUnique({ 
      where: { id: item.productId },
      select: { id: true, name: true, stock: true, lowStockAlert: true }
    });
    if (product && product.stock <= product.lowStockAlert) {
      logger.warn(`[STOCK] Low stock alert: ${product.name} is down to ${product.stock} units`);
      // Future: add to Notification center table
    }
  }
}
