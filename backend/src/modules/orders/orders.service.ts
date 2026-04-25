import { prisma } from '../../common/prisma';
import { logger } from '../../lib/logger';
import { Idempotency } from '../../common/idempotency';

/**
 * Creates a new order with atomic stock deduction and loyalty points calculation.
 * Hardened for production:
 * - Idempotency Guard: Prevents duplicate orders from double-clicks or retries.
 * - Non-Blocking Invoicing: Sequence generation moved to prevent Shop-level row deadlocks.
 * - Atomic Stock Guard: Ensures raw SQL checks for over-selling.
 */
export const createOrder = async (shopId: string, userId: string, data: any) => {
  const { requestId, customerId, items, discountAmount = 0, redeemPoints = 0, paymentMethod, paymentStatus, notes, couponCode } = data;

  // 1. Idempotency Guard (The "Shield")
  if (requestId) {
    const cached = await Idempotency.get(`order:${shopId}:${requestId}`);
    if (cached) {
      logger.info(`[IDEMPOTENCY] HIT for Order Request ${requestId}. Returning cached result.`);
      return cached;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 2. Fetch Context (Read-Only)
      const shop = await tx.shop.findUnique({ where: { id: shopId }, select: { id: true, loyaltyRate: true, redeemRate: true } });
      if (!shop) throw new Error('Shop configuration not found');
      
      const LOYALTY_RATE = Number(shop.loyaltyRate || 0.1);
      const REDEEM_VALUE = Number(shop.redeemRate || 10);
      
      const comboIds = items.filter((i: any) => i.comboId).map((i: any) => i.comboId);
      const combos = comboIds.length > 0 ? await tx.combo.findMany({
        where: { id: { in: comboIds } },
        include: { items: { include: { product: true } } }
      }) : [];

      const productIds = items.filter((i: any) => i.productId).map((i: any) => i.productId);
      const products = productIds.length > 0 ? await tx.product.findMany({
        where: { id: { in: productIds } }
      }) : [];

      let subtotal = 0;
      let taxAmount = 0;

      for (const item of items) {
        if (item.comboId) {
          const combo = combos.find(c => c.id === item.comboId);
          if (!combo) throw new Error(`Combo not found: ${item.comboId}`);
          
          item.unitPrice = Number(combo.fixedPrice);
          // Calculate cost price as sum of component cost prices
          item.costPrice = combo.items.reduce((sum, ci) => sum + Number(ci.product.costPrice || 0) * ci.quantity, 0);
          
          // Verify stock for each component
          for (const ci of combo.items) {
            if (ci.product.stock < ci.quantity * item.quantity) {
              throw new Error(`Insufficient stock for ${ci.product.name} in combo ${combo.name}`);
            }
          }
        } else {
          const product = products.find(p => p.id === item.productId);
          if (!product) throw new Error(`Product not found: ${item.productId}`);
          if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

          item.unitPrice = Number(product.sellingPrice);
          item.costPrice = Number(product.costPrice || 0);
        }

        const itemSubtotal = item.unitPrice * item.quantity;
        subtotal += itemSubtotal;
        taxAmount += itemSubtotal * (item.taxRate / 100);
      }

      // 3. Loyalty & Coupon (Short Read/Update)
      if (redeemPoints > 0) {
        if (!customerId) throw new Error('Customer ID is required to redeem points');
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new Error('Customer not found');
        if (customer.loyaltyPoints < redeemPoints) throw new Error('Insufficient points');
      }

      let couponId = null;
      let calculatedCouponDiscount = 0;

      if (couponCode) {
        const coupon = await (tx as any).coupon.findFirst({
          where: { shopId, code: couponCode.toUpperCase().trim(), isActive: true }
        });

        if (coupon) {
          if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) throw new Error('Coupon expired');
          if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new Error('Coupon limit reached');

          calculatedCouponDiscount = coupon.type === 'PERCENTAGE' ? (subtotal * (Number(coupon.value) / 100)) : Number(coupon.value);
          couponId = coupon.id;
          
          await (tx as any).coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } }
          });
        }
      }

      const totalDiscount = calculatedCouponDiscount + (redeemPoints / REDEEM_VALUE || 0);
      const totalAmount = Math.max(0, subtotal + taxAmount - totalDiscount);

      // 4. ATOMIC Invoice Gen (Prevent Deadlocks on Shop table)
      // We use a raw increment and sequence to avoid SELECT FOR UPDATE bottlenecks
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: { invoiceCount: { increment: 1 } },
        select: { invoiceCount: true }
      });
      const invoiceNumber = `INV-${String(updatedShop.invoiceCount).padStart(6, '0')}`;

      // 5. Order Creation
      const newOrder = await tx.order.create({
        data: {
          shopId, userId, customerId: customerId || null,
          invoiceNumber, subtotal, taxAmount, discountAmount: totalDiscount,
          totalAmount, paidAmount: paymentStatus === 'PAID' ? totalAmount : 0,
          paymentMethod, paymentStatus, status: 'COMPLETED', kitchenStatus: 'PENDING', notes: notes || null,
          couponId, couponDiscount: calculatedCouponDiscount,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId || null,
              comboId: item.comboId || null,
              name: item.name, 
              quantity: item.quantity,
              costPrice: item.costPrice, 
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0, 
              total: item.unitPrice * item.quantity
            }))
          }
        },
        include: { items: { include: { product: true, combo: { include: { items: { include: { product: true } } } } } }, customer: true, user: { select: { name: true } } }
      });

      // 6. ATOMIC Stock Deduction (The "Chaos Proof" Step)
      for (const item of items) {
        if (item.comboId) {
          const combo = combos.find(c => c.id === item.comboId);
          for (const ci of combo!.items) {
            const totalToDeduct = ci.quantity * item.quantity;
            const res = await tx.$executeRaw`
              UPDATE "Product" SET stock = stock - ${totalToDeduct} 
              WHERE id = ${ci.productId} AND stock >= ${totalToDeduct}
            `;
            if (res === 0) throw new Error(`Stock mismatch for ${ci.product.name} in combo`);
            await tx.stockHistory.create({
              data: { productId: ci.productId, type: 'SALE', quantity: -totalToDeduct, note: `Combo Sale: ${invoiceNumber}` }
            });
          }
        } else {
          const res = await tx.$executeRaw`
            UPDATE "Product" SET stock = stock - ${item.quantity} 
            WHERE id = ${item.productId} AND stock >= ${item.quantity}
          `;
          if (res === 0) throw new Error(`Stock mismatch for ${item.name}`);
          await tx.stockHistory.create({
            data: { productId: item.productId, type: 'SALE', quantity: -item.quantity, note: `Sale: ${invoiceNumber}` }
          });
        }
      }

      // 7. Credits & Loyalty
      if (customerId) {
        const pts = Math.floor(totalAmount * LOYALTY_RATE);
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalPurchases: { increment: totalAmount },
            loyaltyPoints: { increment: pts - redeemPoints },
            ...(paymentMethod === 'CREDIT' && { outstandingBalance: { increment: totalAmount } })
          } as any
        });
      }

      return newOrder;
    }, { timeout: 15000 });

    // 8. Cache Result for Idempotency
    if (requestId) {
      await Idempotency.set(`order:${shopId}:${requestId}`, result);
    }

    return result;
  } catch (error: any) {
    logger.error(`[ORDER] Failed: ${error.message}`, { shopId, requestId });
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
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          subtotal: true,
          taxAmount: true,
          discountAmount: true,
          paymentMethod: true,
          paymentStatus: true,
          status: true,
          notes: true,
          createdAt: true,
          customer: { select: { id: true, name: true, phone: true } },
          user: { select: { name: true } },
          _count: { select: { items: true } }
        },
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
    include: { 
      customer: true, 
      items: true, 
      user: { select: { name: true } },
      shop: { select: { name: true } }
    }
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
        if (item.comboId) {
          const combo = await tx.combo.findUnique({
            where: { id: item.comboId },
            include: { items: true }
          });
          if (combo) {
            for (const ci of combo.items) {
              const totalToRestore = ci.quantity * item.quantity;
              await tx.product.update({
                where: { id: ci.productId },
                data: { stock: { increment: totalToRestore } }
              });
              await tx.stockHistory.create({
                data: { productId: ci.productId, type: 'RETURN', quantity: totalToRestore, note: `Cancelled Combo: ${order.invoiceNumber}` }
              });
            }
          }
        } else if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
          await tx.stockHistory.create({
            data: { productId: item.productId, type: 'RETURN', quantity: item.quantity, note: `Cancelled: ${order.invoiceNumber}` }
          });
        }
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
        kitchenStatus: { in: ['PENDING', 'PREPARING', 'READY'] as any }
      },
      select: {
        id: true, invoiceNumber: true, status: true, kitchenStatus: true,
        totalAmount: true, createdAt: true, paymentMethod: true,
        paymentStatus: true, notes: true,
        customer: { select: { name: true, phone: true } },
        items: { select: { name: true, quantity: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    return dbOrders.map(o => ({
      ...o,
      status: o.kitchenStatus, // Expose kitchenStatus as status for frontend compatibility
      notes: o.notes
    }));
  } catch (error: any) {
    logger.error(`[KITCHEN] Failed to fetch orders: ${error.message}`, { shopId });
    throw error;
  }
};

/**
 * Updates the kitchen-specific status of an order.
 */
export const updateKitchenStatus = async (orderId: string, shopId: string, status: string) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, shopId }
    });
    if (!order) throw new Error('Order not found');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { kitchenStatus: status as any },
      include: { items: true, customer: true }
    });

    return { ...updated, status: updated.kitchenStatus, notes: updated.notes };
  } catch (error: any) {
    logger.error(`[KITCHEN] Failed to update status: ${error.message}`, { orderId, shopId, status });
    throw error;
  }
};
