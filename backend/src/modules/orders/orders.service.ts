import { prisma } from '../../index';
import { logger } from '../../lib/logger';

// Loyalty constants removed - now fetched dynamically per-shop inside transactions

/**
 * Creates a new order with atomic stock deduction and loyalty points calculation.
 * Uses a database transaction with a 15s timeout to prevent race conditions.
 * 
 * @param shopId - Unique ID of the tenant shop
 * @param userId - ID of the staff member creating the order
 * @param data - Order details including items, customer, and payment info
 * @returns The created order including items, customer, and user context
 */
export const createOrder = async (shopId: string, userId: string, data: any) => {
  const { customerId, items, discountAmount = 0, redeemPoints = 0, paymentMethod, paymentStatus, notes } = data;

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Shop Settings for loyalty rates
      const shop = await tx.shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new Error('Shop configuration not found');
      
      const LOYALTY_RATE = Number((shop as any).loyaltyRate || 0.1);
      const REDEEM_VALUE = Number((shop as any).redeemRate || 10);
      
      const pointsDiscount = redeemPoints > 0 ? (redeemPoints / REDEEM_VALUE) : 0;
      const totalDiscount = discountAmount + pointsDiscount;
      // 1. Fetch products inside transaction to hold locks
      const products = await tx.product.findMany({
        where: { id: { in: items.map((i: any) => i.productId) } }
      });

      let subtotal = 0;
      let taxAmount = 0;

      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

        // OVERWRITE prices with DB values for protection!
        item.unitPrice = Number(product.sellingPrice);
        item.costPrice = Number(product.costPrice || 0);

        const itemSubtotal = item.unitPrice * item.quantity;
        subtotal += itemSubtotal;
        taxAmount += itemSubtotal * (item.taxRate / 100);
      }

      const totalAmount = Math.max(0, subtotal + taxAmount - totalDiscount);

      // 2. Invoice Generation LOCKED inside transaction
      const count = await tx.order.count({ where: { shopId } });
      const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;

      const newOrder = await tx.order.create({
        data: {
          shopId,
          userId,
          customerId: customerId || null,
          invoiceNumber,
          subtotal,
          taxAmount,
          discountAmount: totalDiscount,
          totalAmount,
          paidAmount: paymentStatus === 'PAID' ? totalAmount : 0,
          paymentMethod,
          paymentStatus,
          status: 'COMPLETED',
          notes: `[KITCHEN:PENDING] ${notes || ''}`,
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

      // 3. ATOMIC Stock Deduction
      for (const item of items) {
        const result = await tx.$executeRaw`
          UPDATE "Product" 
          SET stock = stock - ${item.quantity} 
          WHERE id = ${item.productId} AND stock >= ${item.quantity}
        `;
        
        if (result === 0) {
          throw new Error(`Atomic stock deduction failed for product ID: ${item.productId}. Possible race condition or insufficient stock.`);
        }

        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity,
            note: `Sale: ${invoiceNumber}`
          }
        });
      }

      // 4. Update customer loyalty points (Dynamic per-shop)
      if (customerId) {
        const shop = await tx.shop.findFirst({ where: { id: shopId } });
        const LOYALTY_RATE = Number((shop as any)?.loyaltyRate || 0.1);
        const pointsEarned = Math.floor(totalAmount * LOYALTY_RATE);
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalPurchases: { increment: totalAmount },
            loyaltyPoints: { increment: pointsEarned - redeemPoints },
            ...(paymentMethod === 'CREDIT' && { outstandingBalance: { increment: totalAmount } })
          } as any
        });
      }

      logger.info(`[ORDER] Created successfully: ${invoiceNumber} for Shop ${shopId}`);
      return newOrder;
    }, { timeout: 15000 });
  } catch (error: any) {
    logger.error(`[ORDER] Failed to create order: ${error.message}`, { shopId, userId });
    throw error;
  }
};

/**
 * Fetches paginated orders with optional filtering by date, customer, or status.
 */
export const getOrders = async (shopId: string, filters: {
  skip: number;
  take: number;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  status?: string;
  paymentStatus?: string;
  sort?: 'asc' | 'desc';
}) => {
  const where: any = {
    shopId,
    ...(filters.startDate && filters.endDate && {
      createdAt: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) }
    }),
    ...(filters.customerId && { customerId: filters.customerId }),
    ...(filters.status && { status: filters.status }),
    ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
  };

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: filters.skip, take: filters.take,
        include: { customer: true, items: true, user: { select: { name: true } } },
        orderBy: { createdAt: filters.sort || 'desc' }
      }),
      prisma.order.count({ where })
    ]);
    return { orders, total };
  } catch (error: any) {
    logger.error(`[ORDER] Failed to fetch orders: ${error.message}`, { shopId });
    throw error;
  }
};

/**
 * Detailed view of a single order.
 */
export const getOrderById = async (id: string, shopId: string) => {
  return prisma.order.findFirst({
    where: { id, shopId },
    include: { customer: true, items: true, user: { select: { name: true } } }
  });
};

/**
 * Cancels an order and restores stock atomically.
 */
export const cancelOrder = async (orderId: string, shopId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    include: { items: true }
  });
  if (!order) throw new Error('Order not found');
  if (order.status === 'CANCELLED') throw new Error('Order already cancelled');

  try {
    return await prisma.$transaction(async (tx) => {
      const cancelledOrder = await tx.order.update({
        where: { id: orderId },
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
      logger.info(`[ORDER] Cancelled: ${order.invoiceNumber}`);
      return cancelledOrder;
    }, { timeout: 15000 });
  } catch (error: any) {
    logger.error(`[ORDER] Failed to cancel order: ${error.message}`, { orderId, shopId });
    throw error;
  }
};

/**
 * Updates payment status (e.g., Unpaid -> Paid).
 */
export const updatePaymentStatus = async (orderId: string, shopId: string, paymentStatus: string) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, shopId },
      include: { customer: true, items: true }
    });
    if (!order) throw new Error('Order not found');

    return await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: paymentStatus as any,
        paidAmount: paymentStatus === 'PAID' ? order.totalAmount : order.paidAmount
      },
      include: { items: true, customer: true }
    });
  } catch (error: any) {
    logger.error(`[ORDER] Failed to update payment status: ${error.message}`, { orderId, shopId });
    throw error;
  }
};

/**
 * Fetches all orders currently in the kitchen pipeline.
 * Logic: Matches orders with [KITCHEN:] tag or status PENDING (online menu).
 */
export const getKitchenOrders = async (shopId: string) => {
  try {
    const dbOrders = await prisma.order.findMany({
      where: {
        shopId,
        OR: [
          { notes: { contains: '[KITCHEN:' } },
          { status: { in: ['PENDING', 'PREPARING', 'READY'] as any } },
        ],
        status: { not: { in: ['CANCELLED', 'COMPLETED'] as any } }, // Exclude done orders
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

    return dbOrders.map(o => {
      // 1. Give precedence to the tag if it exists (for POS/Staff overrides)
      const match = o.notes?.match(/\[KITCHEN:(PENDING|PREPARING|READY)\]/);
      
      let kitchenStatus: string;
      if (match) {
        kitchenStatus = match[1];
      } else if (['PENDING', 'PREPARING', 'READY'].includes(o.status as string)) {
        // 2. Use the main order status (for Online Scanner orders)
        kitchenStatus = o.status as string;
      } else {
        kitchenStatus = 'COMPLETED';
      }

      return {
        ...o,
        status: kitchenStatus,
        notes: o.notes?.replace(/\[KITCHEN:[A-Z]+\]\s*/, '')
      };
    }).filter(o => ['PENDING', 'PREPARING', 'READY'].includes(o.status));
  } catch (error: any) {
    logger.error(`[KITCHEN] Failed to fetch orders: ${error.message}`, { shopId });
    throw error;
  }
};

/**
 * Updates the kitchen-specific status of an order.
 * Syncs the main order status if completing a kitchen flow.
 */
export const updateKitchenStatus = async (orderId: string, shopId: string, status: string) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, shopId }
    });
    if (!order) throw new Error('Order not found');

    let rawNotes = order.notes || '';
    rawNotes = rawNotes.replace(/\[KITCHEN:[A-Z]+\]\s*/, ''); // strip old tag
    
    let newNotes = rawNotes;
    if (status === 'PENDING' || status === 'PREPARING' || status === 'READY') {
      newNotes = `[KITCHEN:${status}] ${rawNotes}`;
    }

    const orderStatus = (status === 'COMPLETED') ? 'COMPLETED' : order.status;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { notes: newNotes, status: orderStatus as any },
      include: { items: true, customer: true }
    });

    return { ...updated, status, notes: rawNotes };
  } catch (error: any) {
    logger.error(`[KITCHEN] Failed to update status: ${error.message}`, { orderId, shopId, status });
    throw error;
  }
};
