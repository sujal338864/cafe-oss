import { prisma } from '../index';
import { logger } from '../lib/logger';

export interface DailyProfit {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  orderCount: number;
}

export interface InventoryForecast {
  productId: string;
  name: string;
  currentStock: number;
  avgDailySales: number;
  daysRemaining: number;
  status: 'CRITICAL' | 'LOW' | 'HEALTHY';
}

/**
 * Analytics Service: Handles business intelligence, forecasting, and staffing intelligence.
 * Designed for high-performance data aggregation and multi-tenant scalability.
 */
export const AnalyticsService = {
  /**
   * Get Daily Profit List
   * Calculates real-time margins by comparing revenue with item cost prices.
   * @param shopId The unique identifier of the restaurant
   * @param days Number of historical days to analyze (default 7)
   */
  getDailyProfit: async (shopId: string, days = 7): Promise<DailyProfit[]> => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const orders = await prisma.order.findMany({
        where: { shopId, createdAt: { gte: startDate } },
        include: { items: true },
        orderBy: { createdAt: 'asc' }
      });

      const dailyData: Record<string, DailyProfit> = {};

      orders.forEach(order => {
        const dateKey = order.createdAt.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { date: dateKey, revenue: 0, cost: 0, profit: 0, orderCount: 0 };
        }

        const revenue = Number(order.totalAmount);
        let cost = 0;
        order.items.forEach(item => {
          cost += Number(item.costPrice) * item.quantity;
        });

        dailyData[dateKey].revenue += revenue;
        dailyData[dateKey].cost += cost;
        dailyData[dateKey].profit += (revenue - cost);
        dailyData[dateKey].orderCount += 1;
      });

      return Object.values(dailyData).map(d => ({
        ...d,
        revenue: Math.round(d.revenue),
        cost: Math.round(d.cost),
        profit: Math.round(d.profit)
      }));
    } catch (error: any) {
      logger.error(`[ANALYTICS] Failed to fetch daily profit: ${error.message}`);
      throw error;
    }
  },

  /**
   * Get Inventory Forecasting
   * Predicts stockout dates based on historical sales velocity.
   * Helps prevent emergency shortages by giving proactive alerts.
   * @param shopId The unique identifier of the restaurant
   */
  getInventoryForecast: async (shopId: string): Promise<InventoryForecast[]> => {
    try {
      const windowDays = 14;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - windowDays);

      // 1. Get sales items for the last window
      const sales = await prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        where: { order: { shopId, createdAt: { gte: startDate } } }
      });

      // 2. Fetch current products
      const products = await prisma.product.findMany({
        where: { shopId, isActive: true },
        select: { id: true, name: true, stock: true }
      });

      return products.map(p => {
        const totalSold = sales.find(s => s.productId === p.id)?._sum?.quantity || 0;
        const avgDailySales = totalSold / windowDays;
        
        let daysRemaining = 999;
        if (avgDailySales > 0) {
          daysRemaining = Math.round((p.stock / avgDailySales) * 10) / 10;
        }

        let status: 'CRITICAL' | 'LOW' | 'HEALTHY' = 'HEALTHY';
        if (daysRemaining < 3) status = 'CRITICAL';
        else if (daysRemaining < 7) status = 'LOW';

        return {
          productId: p.id,
          name: p.name,
          currentStock: p.stock,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          daysRemaining,
          status
        };
      }).sort((a, b) => a.daysRemaining - b.daysRemaining);
    } catch (error: any) {
      logger.error(`[ANALYTICS] Forecasting failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Calculate Dashboard Stats
   * (Restored for legacy dashboard support)
   */
  calculateDashboardStats: async (shopId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRevenue, totalOrders, lowStockCount] = await Promise.all([
      prisma.order.aggregate({
        where: { shopId, createdAt: { gte: today } },
        _sum: { totalAmount: true }
      }),
      prisma.order.count({ where: { shopId, createdAt: { gte: today } } }),
      prisma.product.count({ where: { shopId, stock: { lte: prisma.product.fields.lowStockAlert } } })
    ]);

    return {
      revenueToday: Number(totalRevenue._sum.totalAmount || 0),
      ordersToday: totalOrders,
      lowStockAlerts: lowStockCount,
      timestamp: new Date()
    };
  },

  /**
   * Get Peak Hours Intelligence
   * Maps order volume across hours and days to help with staff scheduling.
   * Returns a 24/7 heatmap of order frequency.
   */
  getPeakHours: async (shopId: string) => {
    try {
      const orders = await prisma.order.findMany({
        where: { shopId },
        select: { createdAt: true },
        take: 2000,
        orderBy: { createdAt: 'desc' }
      });

      // 7 days x 24 hours grid
      const heatmap: Record<number, Record<number, number>> = {};
      for (let d = 0; d < 7; d++) {
        heatmap[d] = {};
        for (let h = 0; h < 24; h++) heatmap[d][h] = 0;
      }

      orders.forEach(order => {
        const d = order.createdAt.getDay(); // 0-6
        const h = order.createdAt.getHours(); // 0-23
        heatmap[d][h] += 1;
      });

      return heatmap;
    } catch (error: any) {
      logger.error(`[ANALYTICS] Peak hour calculation failed: ${error.message}`);
      throw error;
    }
  }
};

export const calculateDashboardStats = AnalyticsService.calculateDashboardStats;
