import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest } from '../middleware/auth';
import { sendWhatsAppBill } from '../lib/whatsapp';
import { emitToShop } from '../lib/socket';

const POINTS_PER_RUPEE = parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE || '0.1'); // 1 pt per Rs.10
const POINTS_REDEEM_RATE = parseFloat(process.env.LOYALTY_REDEEM_RATE || '10');      // 100 pts = Rs.10 off

const router = Router();

const orderSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    quantity: z.number().int().positive(),
    costPrice: z.number(),
    unitPrice: z.number().positive(),
    taxRate: z.number().min(0).max(100).default(0),
    discount: z.number().min(0).default(0)
  })).min(1, 'At least one item is required'),
  discountAmount: z.number().min(0).default(0),
  redeemPoints: z.number().int().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'UNPAID']).default('PAID'),
  notes: z.string().optional()
});

router.post(
  '/',
  authenticate,
  validateRequest(orderSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { customerId, items, discountAmount = 0, redeemPoints = 0, paymentMethod, paymentStatus, notes } = req.body;

    // Points redemption → extra discount (100 pts = Rs.POINTS_REDEEM_RATE)
    const pointsDiscount = redeemPoints > 0 ? (redeemPoints / 100) * POINTS_REDEEM_RATE : 0;
    const totalDiscount = discountAmount + pointsDiscount;

    let subtotal = 0;
    let taxAmount = 0;
    for (const item of items) {
      const itemSubtotal = item.unitPrice * item.quantity;
      subtotal += itemSubtotal;
      taxAmount += itemSubtotal * (item.taxRate / 100);
    }
    const totalAmount = Math.max(0, subtotal + taxAmount - totalDiscount);

    const count = await prisma.order.count({ where: { shopId: req.user!.shopId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          shopId: req.user!.shopId,
          userId: req.user!.id,
          customerId: customerId || null,
          invoiceNumber,
          subtotal,
          taxAmount,
          discountAmount: totalDiscount,
          totalAmount,
          paidAmount: paymentStatus === 'PAID' ? totalAmount : 0,
          paymentMethod,
          paymentStatus,
          status: 'PENDING' as any,
          notes,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              costPrice: item.costPrice,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0,
              discount: item.discount || 0,
              total: item.unitPrice * item.quantity
            }))
          }
        },
        include: { items: true, customer: true, user: { select: { name: true } } }
      });

      // Deduct stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity,
            note: `Sale: ${invoiceNumber}`
          }
        });
      }

      // Update customer loyalty points
      if (customerId) {
        const pointsEarned = Math.floor(totalAmount * POINTS_PER_RUPEE);
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalPurchases: { increment: totalAmount },
            loyaltyPoints: { increment: pointsEarned - redeemPoints },
            ...(paymentMethod === 'CREDIT' && { outstandingBalance: { increment: totalAmount } })
          } as any
        });
      }

      return newOrder;
    }, { timeout: 15000 });

    // Broadcast to Kitchen Display System instantly
    try { emitToShop(req.user!.shopId, 'ORDER_CREATED', order); } catch {}

    // Low stock check (non-critical)
    try {
      for (const item of items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (product && product.stock <= product.lowStockAlert) {
          // future: notify
        }
      }
    } catch (e) {
      console.warn('Low stock check failed (non-critical):', e);
    }

    // WhatsApp bill (non-critical)
    try {
      if ((order as any).customer?.phone && paymentStatus === 'PAID') {
        const shop = await prisma.shop.findUnique({ where: { id: req.user!.shopId }, select: { name: true } });
        const updatedCustomer = (await prisma.customer.findUnique({ where: { id: customerId! } })) as any;
        const pointsEarned = Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE);
        await sendWhatsAppBill(
          (order as any).customer.phone,
          {
            invoiceNumber: order.invoiceNumber,
            items: (order as any).items.map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
            subtotal: Number(order.subtotal),
            taxAmount: Number(order.taxAmount),
            discountAmount: Number(order.discountAmount),
            totalAmount: Number(order.totalAmount),
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
          },
          shop?.name || 'Our Shop',
          pointsEarned,
          updatedCustomer?.loyaltyPoints
        );
      }
    } catch (e) {
      console.warn('WhatsApp bill failed (non-critical):', e);
    }

    const pointsEarned = customerId ? Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE) : 0;
    res.status(201).json({ ...order, pointsEarned });
  })
);

// ── Lightweight Kitchen Display endpoint (minimal payload, saves ~1GB/month egress) ──
router.get(
  '/kitchen',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const orders = await prisma.order.findMany({
      where: {
        shopId: req.user!.shopId,
        status: { in: ['PENDING', 'PREPARING', 'READY'] as any }
      },
      select: {
        id: true, invoiceNumber: true, status: true,
        totalAmount: true, createdAt: true, paymentMethod: true,
        paymentStatus: true, notes: true,
        customer: { select: { name: true, phone: true } },
        items: { select: { name: true, quantity: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 50
    });
    res.json({ orders });
  })
);

router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { page = '1', limit = '20', startDate, endDate, customerId, status, paymentStatus } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 20);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      shopId: req.user!.shopId,
      ...(startDate && endDate && { createdAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) } }),
      ...(customerId && { customerId: customerId as string }),
      ...(status && { status: status as string }),
      ...(paymentStatus && { paymentStatus: paymentStatus as string }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip, take: limitNum,
        include: { customer: true, items: true, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ]);

    res.json({ orders, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId },
      include: { customer: true, items: true, user: { select: { name: true } } }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  })
);

router.put(
  '/:id/cancel',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId },
      include: { items: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Order is already cancelled' });

    const updated = await prisma.$transaction(async (tx) => {
      const cancelledOrder = await tx.order.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
        include: { items: true }
      });
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
        await tx.stockHistory.create({
          data: { productId: item.productId, type: 'RETURN', quantity: item.quantity, note: `Cancelled: ${order.invoiceNumber}` }
        });
      }
      return cancelledOrder;
    }, { timeout: 15000 });

    res.json(updated);
  })
);

router.put(
  '/:id/payment',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { paymentStatus } = req.body;
    if (!['PAID', 'PARTIAL', 'UNPAID'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId },
      include: { customer: true, items: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        paymentStatus,
        paidAmount: paymentStatus === 'PAID' ? order.totalAmount : order.paidAmount
      },
      include: { items: true, customer: true }
    });

    // When marking PAID, award loyalty points + send WhatsApp
    if (paymentStatus === 'PAID' && order.paymentStatus !== 'PAID') {
      try {
        if (order.customerId) {
          const pointsEarned = Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE);
          await prisma.customer.update({
            where: { id: order.customerId },
            data: { loyaltyPoints: { increment: pointsEarned } } as any
          });
        }
      } catch (e) { console.warn('Loyalty points update failed:', e); }

      try {
        if (order.customer?.phone) {
          const shop = await prisma.shop.findUnique({ where: { id: req.user!.shopId }, select: { name: true } });
          const customer = order.customerId ? (await prisma.customer.findUnique({ where: { id: order.customerId } })) as any : null;
          const pointsEarned = Math.floor(Number(order.totalAmount) * POINTS_PER_RUPEE);
          await sendWhatsAppBill(
            order.customer.phone,
            {
              invoiceNumber: order.invoiceNumber,
              items: order.items.map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
              subtotal: Number(order.subtotal),
              taxAmount: Number(order.taxAmount),
              discountAmount: Number(order.discountAmount),
              totalAmount: Number(order.totalAmount),
              paymentMethod: order.paymentMethod,
              paymentStatus: 'PAID',
            },
            shop?.name || 'Our Shop',
            pointsEarned,
            customer?.loyaltyPoints
          );
        }
      } catch (e) { console.warn('WhatsApp bill on mark-paid failed:', e); }
    }

    res.json(updated);
  })
);
// Kitchen workflow — update order status (PENDING → PREPARING → READY → COMPLETED)
router.put(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { items: true, customer: true }
    });

    // Broadcast via WebSocket for real-time KDS + customer tracking
    try { emitToShop(req.user!.shopId, 'ORDER_UPDATED', updated); } catch {}

    res.json(updated);
  })
);

// Manual WhatsApp resend — used by POS "Send on WhatsApp" button
router.post(
  '/:id/whatsapp',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId },
      include: { customer: true, items: true }
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.customer?.phone) return res.status(400).json({ error: 'Customer has no phone number' });

    const shop = await prisma.shop.findUnique({ where: { id: req.user!.shopId }, select: { name: true } });
    const customer = order.customerId ? (await prisma.customer.findUnique({ where: { id: order.customerId } })) as any : null;

    const sent = await sendWhatsAppBill(
      order.customer.phone,
      {
        invoiceNumber: order.invoiceNumber,
        items: order.items.map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: Number(i.total) })),
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        discountAmount: Number(order.discountAmount),
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      },
      shop?.name || 'Our Shop',
      undefined,
      customer?.loyaltyPoints
    );

    res.json({ sent, phone: order.customer.phone });
  })
);

export default router;
