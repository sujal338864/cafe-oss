import { prisma } from '../../index';

export const getSuppliers = async (shopId: string, filters: {
  skip: number;
  take: number;
  search?: string;
}) => {
  const where: any = {
    shopId,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } }
      ]
    })
  };

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { name: 'asc' }
    }),
    prisma.supplier.count({ where })
  ]);

  return { suppliers, total };
};

export const getSupplierById = async (id: string, shopId: string) => {
  return prisma.supplier.findFirst({
    where: { id, shopId }
  });
};

export const createSupplier = async (shopId: string, data: any) => {
  return prisma.supplier.create({
    data: {
      shopId,
      ...data
    }
  });
};

export const updateSupplier = async (id: string, data: any) => {
  return prisma.supplier.update({
    where: { id },
    data
  });
};

export const getSupplierPurchases = async (supplierId: string, shopId: string) => {
  return prisma.purchase.findMany({
    where: {
      supplierId,
      shopId
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
};
