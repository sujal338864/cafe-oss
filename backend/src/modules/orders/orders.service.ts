import { prisma } from '../../index';

const POINTS_PER_RUPEE = parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE || '0.1');
const POINTS_REDEEM_RATE = parseFloat(process.env.LOYALTY_REDEEM_RATE || '10');

export const createOrder = async (shopId: string, userId: string, data: any) => {
  const { customerId, items, discountAmount = 0, redeemPoints = 0, paymentMethod, paymentStatus, notes } = data;

  const pointsDiscount = redeemPoints > 0 ? (redeemPoints / 100) * POINTS_REDEEM_RATE : 0;
  const totalDiscount = discountAmount + pointsDiscount;

  return prisma.$transaction(async (tx) => {
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
        throw new Error(`Insufficient stock for product ID: ${item.productId}`);
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
};

export const getOrders = async (shopId: string, filters: {
  skip: number;
  take: number;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  status?: string;
  paymentStatus?: string;
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

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where, skip: filters.skip, take: filters.take,
      include: { customer: true, items: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.order.count({ where })
  ]);

  return { orders, total };
};

export const getOrderById = async (id: string, shopId: string) => {
  return prisma.order.findFirst({
    where: { id, shopId },
    include: { customer: true, items: true, user: { select: { name: true } } }
  });
};

export const cancelOrder = async (orderId: string, shopId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    include: { items: true }
  });
  if (!order) throw new Error('Order not found');
  if (order.status === 'CANCELLED') throw new Error('Order already cancelled');

  return prisma.$transaction(async (tx) => {
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
    return cancelledOrder;
  }, { timeout: 15000 });
};

export const updatePaymentStatus = async (orderId: string, shopId: string, paymentStatus: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId },
    include: { customer: true, items: true }
  });
  if (!order) throw new Error('Order not found');

  return prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: paymentStatus as any,
      paidAmount: paymentStatus === 'PAID' ? order.totalAmount : order.paidAmount
    },
    include: { items: true, customer: true }
  });
};

// ── Kitchen Display helpers ──

export const getKitchenOrders = async (shopId: string) => {
  // Catch BOTH:
  // 1. POS orders tagged with [KITCHEN:PENDING/PREPARING/READY] in notes
  // 2. Scanner/Menu orders that have status='PENDING' (no kitchen tag yet)
  const dbOrders = await prisma.order.findMany({
    where: {
      shopId,
      OR: [
        { notes: { contains: '[KITCHEN:' } },
        { status: { equals: 'PENDING' as any } },
      ],
      status: { not: 'CANCELLED' as any },
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
    const match = o.notes?.match(/\[KITCHEN:(PENDING|PREPARING|READY)\]/);
    // Priority: [KITCHEN:X] tag > order.status field
    let kitchenStatus: string;
    if (match) {
      kitchenStatus = match[1];
    } else if ((o.status as string) === 'PENDING') {
      kitchenStatus = 'PENDING'; // Scanner orders without tag
    } else {
      kitchenStatus = 'COMPLETED'; // Already done
    }
    return {
      ...o,
      status: kitchenStatus,
      notes: o.notes?.replace(/\[KITCHEN:[A-Z]+\]\s*/, '')
    };
  }).filter(o => ['PENDING', 'PREPARING', 'READY'].includes(o.status));
};

export const updateKitchenStatus = async (orderId: string, shopId: string, status: string) => {
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
  // else COMPLETED: notes have no tag, so it won't show in kitchen

  // Also update the order status field for scanner orders that used status='PENDING'
  const orderStatus = (status === 'COMPLETED') ? 'COMPLETED' : order.status;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { notes: newNotes, status: orderStatus as any },
    include: { items: true, customer: true }
  });

  return { ...updated, status, notes: rawNotes };
};
