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
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [
        revenueResult,
        totalOrders,
        lowStockItems,
        topProductsData,
        monthlySalesData,
        categoriesData
      ] = await Promise.all([
        // 1. Revenue & Orders (Historical total for insights)
        prisma.order.aggregate({
          where: { shopId, status: { not: 'CANCELLED' as any } },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        // 2. Orders (Already included in above but keep it explicit if needed)
        prisma.order.count({ where: { shopId, status: { not: 'CANCELLED' as any } } }),
        // 3. Low Stock Items
        prisma.product.count({ where: { shopId, stock: { lte: prisma.product.fields.lowStockAlert } } }),
        // 4. Top Products
        prisma.orderItem.groupBy({
          by: ['productId', 'name'],
          _sum: { quantity: true },
          where: { order: { shopId } },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5
        }),
        // 5. Monthly Sales
        prisma.order.findMany({
          where: { shopId, createdAt: { gte: sixMonthsAgo }, status: { not: 'CANCELLED' as any } },
          select: { totalAmount: true, createdAt: true }
        }),
        // 6. Category Breakdown
        prisma.product.findMany({
          where: { shopId },
          select: { 
            category: { select: { name: true } },
            orderItems: {
              where: { order: { status: { not: 'CANCELLED' as any } } },
              select: { total: true }
            }
          }
        })
      ]);

      const totalRevenue = Number(revenueResult._sum.totalAmount || 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Format Top Products
      const topProducts = topProductsData.map(p => ({
        name: p.name,
        quantity: p._sum.quantity || 0
      }));

      // Format Monthly Sales
      const monthlyMap: Record<string, { revenue: number, orders: number }> = {};
      monthlySalesData.forEach(o => {
        const month = o.createdAt.toLocaleString('default', { month: 'short' });
        if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, orders: 0 };
        monthlyMap[month].revenue += Number(o.totalAmount);
        monthlyMap[month].orders += 1;
      });
      const monthlySales = Object.entries(monthlyMap).map(([month, data]) => ({
        month, ...data
      }));

      // Format Category Breakdown
      const catMap: Record<string, number> = {};
      categoriesData.forEach(p => {
        const catName = p.category?.name || 'Uncategorized';
        const revenue = p.orderItems.reduce((sum, item) => sum + Number(item.total), 0);
        catMap[catName] = (catMap[catName] || 0) + revenue;
      });
      const categoryBreakdown = Object.entries(catMap).map(([name, revenue]) => ({
        name, revenue
      }));

      return {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        lowStockItems,
        topProducts,
        monthlySales,
        categoryBreakdown,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error(`[ANALYTICS] Stats calculation failed: ${error.message}`);
      throw error;
    }
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
