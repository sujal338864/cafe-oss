import { prisma } from '../../common/prisma';
import { redis } from '../../lib/redis';
import crypto from 'crypto';

const CACHE_TTL = 60; // 60 seconds (Short TTL for 'Lunch Rush' protection)

const invalidateProductCache = async (shopId: string) => {
  // Use a targeted DEL by pattern or simply let TTL expire to avoid blocking.
  // In a robust Prod setup, we'd use Redis tags or sets, but for simple MVP we just
  // let the short TTL naturally expire to prevent stock desync, OR we can flush the main keys if we know them.
  // Since we use hashed keys for filters, we'll rely heavily on the short 60s TTL acting as a Debounce.
  try {
    // Specifically clear the most requested 'POS' payload if we want immediate sync
    // For now, the 60s TTL prevents full table scans on every keystroke/pageload request
  } catch (e) {}
};

export const getProducts = async (shopId: string, filters: {
  skip: number;
  take: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
  available?: boolean;
  mode?: 'pos' | 'slim' | 'full'; // Added mode for egress optimization
}) => {
  const hashKey = crypto.createHash('md5').update(JSON.stringify(filters)).digest('hex');
  const cacheKey = `products:${shopId}:${hashKey}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const where: any = {
    shopId,
    isActive: true,
    ...(filters.available === true && { isAvailable: true }),
    ...(filters.available === false && { isAvailable: false }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
        { category: { name: { contains: filters.search, mode: 'insensitive' } } }
      ]
    }),
    ...(filters.category && { categoryId: filters.category }),
    ...(filters.lowStock && {
      stock: { lte: prisma.product.fields.lowStockAlert }
    })
  };

  // Egress Optimization: POS/Slim mode returns only minimal required fields
  const select: any = (filters.mode === 'pos' || filters.mode === 'slim') ? {
    id: true,
    name: true,
    sellingPrice: true,
    costPrice: true,
    taxRate: true,
    stock: true,
    lowStockAlert: true,
    unit: true,
    imageUrl: true,
    isAvailable: true,
    categoryId: true,
    category: { select: { name: true } }
  } : {
    include: { category: true }
  };

  const [dbProducts, total] = await Promise.all([
    (prisma.product as any).findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      ...(select.include ? { include: select.include } : { select: select }),
      orderBy: { name: 'asc' }
    }),
    prisma.product.count({ where })
  ]);

  // Phase 5: Dynamic "Happy Hour" Pricing Engine ⚡
  let products = dbProducts;
  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { pricingEnabled: true, pricingRules: true, timezone: true } });
    if (shop?.pricingEnabled && shop.pricingRules) {
      const rules = shop.pricingRules as any[];
      if (Array.isArray(rules) && rules.length > 0) {
        // Calculate local hours based on shop timezone (Fallback to IST)
        const d = new Date();
        const localTime = new Date(d.toLocaleString("en-US", {timeZone: shop.timezone || "Asia/Kolkata"}));
        const currentDay = localTime.getDay(); // 0-6 (Sunday is 0)
        const currentHour = localTime.getHours(); // 0-23

        products = products.map((p: any) => {
          let updatedPrice = Number(p.sellingPrice);
          let ruleApplied = null;
          let originalPrice = Number(p.sellingPrice);

          for (const rule of rules) {
            // Check day and time match
            if (!rule.days?.includes(currentDay)) continue;
            if (currentHour < rule.startHour || currentHour >= rule.endHour) continue;
            
            // Check category match
            if (rule.targetCategory === 'ALL' || p.categoryId === rule.targetCategory || p.category?.name === rule.targetCategory) {
               if (rule.type === 'DISCOUNT_PERCENT') {
                 updatedPrice -= updatedPrice * (rule.value / 100);
                 ruleApplied = rule.name || 'Happy Hour';
               } else if (rule.type === 'FIXED_PRICE') {
                 updatedPrice = rule.value;
                 ruleApplied = rule.name || 'Happy Hour';
               }
            }
          }

          if (ruleApplied && updatedPrice < originalPrice) {
             return { ...p, originalPrice, sellingPrice: updatedPrice, appliedRule: ruleApplied };
          }
          return p;
        });
      }
    }
  } catch (err) {
    console.error('[PricingEngine] Failed to apply rules:', err);
  }

  const result = { products, total };

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  } catch (e) {}

  return result;
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
  const prod = await prisma.product.create({
    data: { ...data, shopId },
    include: { category: true }
  });
  await invalidateProductCache(shopId);
  return prod;
};

export const updateProduct = async (id: string, data: any) => {
  const prod = await prisma.product.update({
    where: { id },
    data,
    include: { category: true }
  });
  await invalidateProductCache(prod.shopId);
  return prod;
};

export const softDeleteProduct = async (id: string) => {
  const prod = await prisma.product.update({
    where: { id },
    data: { isActive: false }
  });
  await invalidateProductCache(prod.shopId);
  return prod;
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
