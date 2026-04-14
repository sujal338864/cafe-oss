import { prisma, directPrisma } from '../../common/prisma';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';

/**
 * Advanced Aggregator for Global Admin Dashboard
 * Targeted for <500ms delivery by precomputing platform state
 */
export const adminAnalyticsProcessor = async () => {
  const start = Date.now();
  logger.info('[AdminAnalytics] Precomputing platform state...');

  /**
   * Safe execution with simple retry for transient DB hiccups
   */
  const executeWithRetry = async (fn: () => Promise<any>, retries = 2): Promise<any> => {
    try {
      return await fn();
    } catch (err: any) {
      const isTransient = err.code === 'P1001' || err.message?.includes('Can\'t reach database');
      if (isTransient && retries > 0) {
        logger.warn(`[AdminAnalytics] Transient DB error. Retrying... (${retries} left)`);
        await new Promise(r => setTimeout(r, 2000));
        return executeWithRetry(fn, retries - 1);
      }
      throw err;
    }
  };

  try {
    const [counts, revenueResult, topShops, recentUsers] = await executeWithRetry(() => Promise.all([
      // 1. Basic Counts
      prisma.$transaction([
        prisma.shop.count(),
        prisma.user.count(),
        prisma.order.count(),
        prisma.product.count()
      ]),

      // 2. Global Revenue (Aggregated)
      directPrisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Last 30 days
      }),

      // 3. Top Shops by Revenue (Complex join-less aggregation)
      directPrisma.order.groupBy({
        by: ['shopId'],
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 5
      }),

      // 4. Recent Active Users
      prisma.user.findMany({
        take: 10,
        orderBy: { lastLogin: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLogin: true,
          shop: { select: { name: true } }
        }
      })
    ]));

    // Fetch shop names for the top IDs and map them
    const shopNames = await prisma.shop.findMany({
      where: { id: { in: topShops.map(s => s.shopId) } },
      select: { id: true, name: true }
    });

    const enrichedTopShops = topShops.map(s => ({
      ...s,
      name: shopNames.find(n => n.id === s.shopId)?.name || 'Unknown',
      revenue: Number(s._sum.totalAmount || 0)
    }));

    const result = {
      metrics: {
        totalShops: counts[0],
        totalUsers: counts[1],
        totalOrders: counts[2],
        totalProducts: counts[3],
        monthlyRevenue: Number(revenueResult._sum.totalAmount || 0)
      },
      topShops: enrichedTopShops,
      recentUsers,
      precomputedAt: new Date().toISOString(),
      computeDurationMs: Date.now() - start
    };

    await redis.set('admin:global:mega:dashboard', JSON.stringify(result), 'EX', 120);
    logger.info(`[AdminAnalytics] Completed in ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    logger.error('[AdminAnalytics] Precomputation failed:', error);
    throw error;
  }
};
