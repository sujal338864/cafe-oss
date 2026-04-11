import { prisma } from '../../common/prisma';

export const getProducts = async (shopId: string, filters: {
  skip: number;
  take: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
}) => {
  const where: any = {
    shopId,
    isActive: true,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } }
      ]
    }),
    ...(filters.category && { categoryId: filters.category }),
    ...(filters.lowStock && {
      stock: { lte: prisma.product.fields.lowStockAlert }
    })
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      include: { category: true },
      orderBy: { name: 'asc' }
    }),
    prisma.product.count({ where })
  ]);

  return { products, total };
};

export const getProductById = async (id: string, shopId: string) => {
  return prisma.product.findFirst({
    where: { id, shopId },
    include: { category: true }
  });
};

export const getProductBySku = async (shopId: string, sku: string) => {
  return prisma.product.findFirst({
    where: { shopId, sku }
  });
};

export const createProduct = async (shopId: string, data: any) => {
  return prisma.product.create({
    data: {
      ...data,
      shopId
    },
    include: { category: true }
  });
};

export const updateProduct = async (id: string, data: any) => {
  return prisma.product.update({
    where: { id },
    data,
    include: { category: true }
  });
};

export const softDeleteProduct = async (id: string) => {
  return prisma.product.update({
    where: { id },
    data: { isActive: false }
  });
};

export const getStockHistory = async (productId: string, limit: number) => {
  return prisma.stockHistory.findMany({
    where: { productId },
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
};

export const adjustStock = async (productId: string, quantity: number, note?: string) => {
  return prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        stock: { increment: quantity }
      }
    });

    await tx.stockHistory.create({
      data: {
        productId,
        type: 'ADJUSTMENT',
        quantity,
        note: note || 'Manual adjustment'
      }
    });

    return updatedProduct;
  });
};
