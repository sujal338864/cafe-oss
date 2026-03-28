import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as orderService from './orders.service';
import { prisma } from '../../index';
import { addWhatsAppJob } from '../../jobs/queues/whatsapp.queue';
import { addDashboardUpdateJob } from '../../jobs/queues/dashboard.queue';
import { emitToShop } from '../../lib/socket';

const POINTS_PER_RUPEE = parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE || '0.1');

export const createOrder = async (req: AuthRequest, res: Response) => {
  const order = await orderService.createOrder(req.user!.shopId, req.user!.id, req.body);

  // Non-critical: Low stock check
  try {
    for (const item of req.body.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (product && product.stock <= product.lowStockAlert) {
        // low stock trigger placeholders
      }
    }
  } catch (e) {
    console.warn('Low stock check failed:', e);
  }

  // Non-critical: WhatsApp bill
  try {
    if (order.customer?.phone && req.body.paymentStatus === 'PAID') {
      const shop = await prisma.shop.findUnique({ where: { id: req.user!.shopId }, select: { name: true } });
      const updatedCustomer = (await prisma.customer.findUnique({ where: { id: order.customerId! } })) as any;
      const pointsEarned = Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE);
      
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
        shopName: shop?.name || 'Our Shop',
        pointsEarned,
        currentLoyaltyPoints: updatedCustomer?.loyaltyPoints
      });
    }
  } catch (e) {
    console.warn('WhatsApp bill queueing failed:', e);
  }

  const pointsEarned = req.body.customerId ? Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE) : 0;
  
  // Trigger dashboard update & notify clients
  try {
    await addDashboardUpdateJob(req.user!.shopId);
    emitToShop(req.user!.shopId, 'ORDER_CREATED', { ...order, pointsEarned });
  } catch (e) {
    console.warn('Dashboard update queueing failed:', e);
  }

  res.status(201).json({ ...order, pointsEarned });
};

export const getOrders = async (req: AuthRequest, res: Response) => {
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

  res.json({ orders, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  const order = await orderService.getOrderById(req.params.id, req.user!.shopId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
};

export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    const updated = await orderService.cancelOrder(req.params.id, req.user!.shopId);
    
    // Trigger dashboard update & notify clients
    try { 
      await addDashboardUpdateJob(req.user!.shopId); 
      emitToShop(req.user!.shopId, 'ORDER_CANCELLED', { orderId: req.params.id });
    } catch (e) {}

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const updatePaymentStatus = async (req: AuthRequest, res: Response) => {
  const { paymentStatus } = req.body;
  if (!['PAID', 'PARTIAL', 'UNPAID'].includes(paymentStatus)) {
    return res.status(400).json({ error: 'Invalid payment status' });
  }

  try {
    const updated = await orderService.updatePaymentStatus(req.params.id, req.user!.shopId, paymentStatus);

    // When marking PAID from UNPAID, trigger points & WhatsApp
    if (paymentStatus === 'PAID') {
      try {
        if (updated.customerId) {
          const pointsEarned = Math.floor(Number(updated.totalAmount) * POINTS_PER_RUPEE);
          await prisma.customer.update({
            where: { id: updated.customerId },
            data: { loyaltyPoints: { increment: pointsEarned } } as any
          });
        }
      } catch (e) { console.warn('Loyalty points update failed:', e); }

      try {
        if (updated.customer?.phone) {
          const shop = await prisma.shop.findUnique({ where: { id: req.user!.shopId }, select: { name: true } });
          const customer = updated.customerId ? (await prisma.customer.findUnique({ where: { id: updated.customerId } })) as any : null;
          const pointsEarned = Math.floor(Number(updated.totalAmount) * POINTS_PER_RUPEE);
          
          await addWhatsAppJob({
            phone: updated.customer.phone,
            billData: {
              invoiceNumber: updated.invoiceNumber,
              items: updated.items.map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
              subtotal: Number(updated.subtotal),
              taxAmount: Number(updated.taxAmount),
              discountAmount: Number(updated.discountAmount),
              totalAmount: Number(updated.totalAmount),
              paymentMethod: updated.paymentMethod,
              paymentStatus: 'PAID',
            },
            shopName: shop?.name || 'Our Shop',
            pointsEarned,
            currentLoyaltyPoints: customer?.loyaltyPoints
          });
        }
      } catch (e) { console.warn('WhatsApp bill queueing fails:', e); }
    }

    // Trigger dashboard update & notify clients
    try { 
      await addDashboardUpdateJob(req.user!.shopId); 
      emitToShop(req.user!.shopId, 'ORDER_UPDATED', updated);
    } catch (e) {}

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const resendWhatsApp = async (req: AuthRequest, res: Response) => {
  const order = await orderService.getOrderById(req.params.id, req.user!.shopId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!order.customer?.phone) return res.status(400).json({ error: 'Customer has no phone number' });

  const shop = await prisma.shop.findUnique({ where: { id: req.user!.shopId }, select: { name: true } });
  const customer = order.customerId ? (await prisma.customer.findUnique({ where: { id: order.customerId } })) as any : null;

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
    shopName: shop?.name || 'Our Shop',
    currentLoyaltyPoints: customer?.loyaltyPoints
  });

  res.json({ sent: true, queued: true, phone: order.customer.phone });
};

// ── Kitchen Display ──

export const getKitchenOrders = async (req: AuthRequest, res: Response) => {
  const orders = await orderService.getKitchenOrders(req.user!.shopId);
  res.json({ orders });
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const updated = await orderService.updateKitchenStatus(req.params.id, req.user!.shopId, status);
    
    try {
      emitToShop(req.user!.shopId, 'ORDER_UPDATED', updated);
    } catch (e) {}

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};
