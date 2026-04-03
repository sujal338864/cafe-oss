import { prisma } from '../../common/prisma';

export const getCustomers = async (shopId: string, filters: {
  skip: number;
  take: number;
  search?: string;
}) => {
  const where: any = {
    shopId,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } }
      ]
    })
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.customer.count({ where })
  ]);

  return { customers, total };
};

export const getCustomerById = async (id: string, shopId: string) => {
  return prisma.customer.findFirst({
    where: { id, shopId }
  });
};

export const getCustomerByPhone = async (shopId: string, phone: string) => {
  return prisma.customer.findFirst({
    where: { shopId, phone }
  });
};

export const lookupCustomer = async (shopId: string, phoneDigits: string) => {
  return prisma.customer.findFirst({
    where: {
      shopId,
      phone: { contains: phoneDigits }
    },
    include: {
      orders: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, totalAmount: true }
      }
    }
  });
};

export const createCustomer = async (shopId: string, data: any) => {
  return prisma.customer.create({
    data: {
      shopId,
      ...data
    }
  });
};

export const updateCustomer = async (id: string, data: any) => {
  return prisma.customer.update({
    where: { id },
    data
  });
};

export const getCustomerOrders = async (customerId: string, shopId: string) => {
  return prisma.order.findMany({
    where: {
      customerId,
      shopId
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
};
