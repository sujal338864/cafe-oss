import { prisma } from '../../index';

export const getCategories = async (shopId: string) => {
  return prisma.category.findMany({
    where: { shopId },
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' }
  });
};

export const getCategoryByName = async (shopId: string, name: string) => {
  return prisma.category.findFirst({
    where: { shopId, name }
  });
};

export const getCategoryById = async (id: string, shopId: string) => {
  return prisma.category.findFirst({
    where: { id, shopId }
  });
};

export const createCategory = async (shopId: string, data: { name: string; color?: string }) => {
  return prisma.category.create({
    data: {
      shopId,
      ...data
    }
  });
};

export const updateCategory = async (id: string, data: any) => {
  return prisma.category.update({
    where: { id },
    data
  });
};

export const deleteCategory = async (id: string) => {
  return prisma.category.delete({
    where: { id }
  });
};
