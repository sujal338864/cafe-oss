import { prisma } from '../index';
import { logger } from '../lib/logger';

/**
 * Optimized Analytics Logic with IST Timezone Awareness
 * (Matches legacy dashboard logic for accuracy)
 */
export const AnalyticsServiceV2 = {
  getDailyReport: async (shopId: string, date: Date) => {
    try {
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(date.getTime() + (date.getTimezoneOffset() === 0 ? istOffset : 0));
      const startOfIst = new Date(istDate);
      startOfIst.setUTCHours(0, 0, 0, 0);
      const start = new Date(startOfIst.getTime() - istOffset);
      const end = new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1);

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

      const [orderStats, expenseStats] = await Promise.all([
        prisma.order.aggregate({
          where: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: start, lte: endDate } },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        prisma.expense.aggregate({
          where: { shopId, date: { gte: start, lte: endDate } },
          _sum: { amount: true }
        })
      ]);

      const orders = await prisma.order.findMany({
        where: { shopId, status: { not: 'CANCELLED' as any }, createdAt: { gte: start, lte: endDate } },
        select: { totalAmount: true, createdAt: true }
      });

      const breakdownMap: Record<string, { revenue: number, orders: number }> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        breakdownMap[d.toISOString().split('T')[0]] = { revenue: 0, orders: 0 };
      }

      orders.forEach(o => {
        const key = o.createdAt.toISOString().split('T')[0];
        if (breakdownMap[key]) {
          breakdownMap[key].revenue += Number(o.totalAmount);
          breakdownMap[key].orders += 1;
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
