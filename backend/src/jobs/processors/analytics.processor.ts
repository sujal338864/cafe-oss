import { prisma } from '../../index';
import { redis } from '../../lib/redis';

/**
 * Processor running periodic batch aggregations for all shops.
 * Offloads heavy reporting from daytime API reads.
 */
export const analyticsAggregationProcessor = async () => {
  console.log('[Analytics-Cron] Starting periodic batch aggregation...');
  
  try {
    const shops = await prisma.shop.findMany({ select: { id: true } });

    for (const shop of shops) {
      const shopId = shop.id;
      
      // 1. Hourly Sales Profile (Last 24 Hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const items = await prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: { shopId, status: 'COMPLETED', createdAt: { gte: yesterday } } },
        _sum: { quantity: true, total: true },
        take: 5
      });

      const trendData = items.map(i => ({
        name: i.name,
        quantity: i._sum.quantity || 0,
        revenue: Number(i._sum.total || 0)
      }));

      // Cache safely in Redis
      await redis.set(`analytics_heavy:top_items_24h:${shopId}`, JSON.stringify(trendData), 'EX', 86400);
      
      console.log(`[Analytics-Cron] Aggregated shop: ${shopId}`);
    }

    console.log('[Analytics-Cron] Batch aggregation finished successfully.');
  } catch (err) {
    console.error('[Analytics-Cron] Error during aggregation:', err);
    throw err;
  }
};
