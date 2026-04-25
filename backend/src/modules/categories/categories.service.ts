import { prisma } from '../../common/prisma';
import { redis } from '../../lib/redis';

const CACHE_TTL = 300; // 5 minutes

const invalidateMenuCache = async (shopId: string) => {
  try { await redis.del(`categories:${shopId}`); } catch (e) {}
};

export const getCategories = async (shopId: string) => {
  const cacheKey = `categories:${shopId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const categories = await prisma.category.findMany({
    where: { shopId },
    include: { _count: { select: { products: true } } },
    orderBy: [
      { order: 'asc' },
      { name: 'asc' }
    ] as any
  });

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(categories));
  } catch (e) {}

  return categories;
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
  const category = await prisma.category.create({
    data: {
      shopId,
      ...data
    }
  });
  await invalidateMenuCache(shopId);
  return category;
};

export const updateCategory = async (id: string, data: any) => {
  const category = await prisma.category.update({
    where: { id },
    data
  });
  await invalidateMenuCache(category.shopId);
  return category;
};

export const deleteCategory = async (id: string) => {
  const category = await prisma.category.delete({
    where: { id }
  });
  await invalidateMenuCache(category.shopId);
  return category;
};
