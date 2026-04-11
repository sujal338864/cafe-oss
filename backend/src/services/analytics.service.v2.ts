import { prisma } from '../common/prisma';
import { logger } from '../lib/logger';

/**
 * Optimized Analytics Logic with IST Timezone Awareness
 * (Matches legacy dashboard logic for accuracy)
 */
export const AnalyticsServiceV2 = {
  getDailyReport: async (shopId: string, date: Date) => {
    try {
      // IST = UTC+5:30. Calculate day boundaries in IST, store as UTC.
      // This is server-timezone-agnostic (works whether server is UTC or IST).
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      // Parse date as IST midnight
      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
      // IST start-of-day in UTC = midnight IST - 5h30m = previous day 18:30 UTC
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

      // Aggregations using Prisma native features
      const [orderStats, expenseStats, topItems] = await Promise.all([
        prisma.order.aggregate({
          where: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: start, lte: end } },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        prisma.expense.aggregate({
          where: { shopId, date: { gte: start, lte: end } },
          _sum: { amount: true }
        }),
        prisma.orderItem.groupBy({
          by: ['productId', 'name'],
          where: { order: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: start, lte: end } } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5
        })
      ]);

      const revenue = Number(orderStats._sum.totalAmount || 0);
      const expenses = Number(expenseStats._sum.amount || 0);

      return {
        revenue,
        orders: orderStats._count.id,
        expenses,
        netProfit: revenue - expenses,
        topItems: topItems.map(item => ({
          name: item.name,
          quantity: item._sum.quantity || 0,
          revenue: Number(item._sum.total || 0)
        })),
        dateRange: { start, end }
      };
    } catch (error: any) {
      logger.error(`[ANALYTICS V2] Daily report failed: ${error.message}`);
      throw error;
    }
  },

  getWeeklyReport: async (shopId: string, endDate: Date) => {
    try {
      const start = new Date(endDate);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      // Single query for aggregate + daily breakdown (replaces findMany loop)
      const [orderStats, expenseStats, dailyOrders] = await Promise.all([
        prisma.order.aggregate({
          where: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: start, lte: endDate } },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        prisma.expense.aggregate({
          where: { shopId, date: { gte: start, lte: endDate } },
          _sum: { amount: true }
        }),
        // groupBy date gives us daily breakdown in ONE query instead of fetching all rows
        prisma.$queryRaw<{ date: string; revenue: number; orders: number }[]>`
          SELECT 
            TO_CHAR("createdAt" AT TIME ZONE 'IST', 'YYYY-MM-DD') as date,
            SUM("totalAmount")::float as revenue,
            COUNT("id")::int as orders
          FROM "Order"
          WHERE "shopId" = ${shopId}
            AND status != 'CANCELLED'
            AND "createdAt" >= ${start}
            AND "createdAt" <= ${endDate}
          GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'IST', 'YYYY-MM-DD')
          ORDER BY date ASC
        `
      ]);

      // Build 7-day map (fills in zeros for days with no orders)
      const breakdownMap: Record<string, { revenue: number; orders: number }> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        breakdownMap[d.toISOString().split('T')[0]] = { revenue: 0, orders: 0 };
      }
      dailyOrders.forEach((row: any) => {
        if (breakdownMap[row.date]) {
          breakdownMap[row.date] = { revenue: Number(row.revenue), orders: Number(row.orders) };
        }
      });

      const totalRevenue = Number(orderStats._sum.totalAmount || 0);
      const totalExpenses = Number(expenseStats._sum.amount || 0);

      return {
        totalRevenue,
        totalOrders: orderStats._count.id,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        breakdown: Object.entries(breakdownMap).map(([date, data]) => ({ date, ...data }))
      };
    } catch (error: any) {
      logger.error(`[ANALYTICS V2] Weekly report failed: ${error.message}`);
      throw error;
    }
  },

  getMonthlyReport: async (shopId: string, year: number, month: number) => {
    try {
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const [stats, expenseStats, topItems] = await Promise.all([
        prisma.order.aggregate({
          where: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: start, lte: end } },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        prisma.expense.aggregate({
          where: { shopId, date: { gte: start, lte: end } },
          _sum: { amount: true }
        }),
        prisma.orderItem.groupBy({
          by: ['productId', 'name'],
          where: { order: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: start, lte: end } } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 5
        })
      ]);

      const totalRevenue = Number(stats._sum.totalAmount || 0);
      const totalExpenses = Number(expenseStats._sum.amount || 0);

      return {
        totalRevenue,
        totalOrders: stats._count.id,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        topItems: topItems.map(item => ({
          name: item.name,
          quantity: item._sum.quantity || 0,
          revenue: Number(item._sum.total || 0)
        })),
        month: start.toLocaleString('default', { month: 'long', year: 'numeric' })
      };
    } catch (error: any) {
      logger.error(`[ANALYTICS V2] Monthly report failed: ${error.message}`);
      throw error;
    }
  }
};
