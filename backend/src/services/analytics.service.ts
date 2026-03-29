import { prisma } from '../index';
import { logger } from '../lib/logger';

export interface DailyProfit {
  date: string;
  revenue: number;
  cost: number;
  expenses: number;
  profit: number; // Net Profit (Revenue - Cost - Expenses)
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

      const [orders, expenses] = await Promise.all([
        prisma.order.findMany({
          where: { shopId, createdAt: { gte: startDate } },
          include: { items: true },
          orderBy: { createdAt: 'asc' }
        }),
        prisma.expense.findMany({
          where: { shopId, date: { gte: startDate } }
        })
      ]);

      const dailyData: Record<string, DailyProfit> = {};

      // 1. Process Orders
      orders.forEach(order => {
        const dateKey = order.createdAt.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { date: dateKey, revenue: 0, cost: 0, expenses: 0, profit: 0, orderCount: 0 };
        }

        const revenue = Number(order.totalAmount);
        let cost = 0;
        order.items.forEach(item => {
          cost += Number(item.costPrice) * item.quantity;
        });

        dailyData[dateKey].revenue += revenue;
        dailyData[dateKey].cost += cost;
        dailyData[dateKey].orderCount += 1;
      });

      // 2. Process Expenses
      expenses.forEach(exp => {
        const dateKey = exp.date.toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { date: dateKey, revenue: 0, cost: 0, expenses: 0, profit: 0, orderCount: 0 };
        }
        dailyData[dateKey].expenses += Number(exp.amount);
      });

      return Object.values(dailyData).map(d => ({
        ...d,
        revenue: Math.round(d.revenue * 100) / 100,
        cost: Math.round(d.cost * 100) / 100,
        expenses: Math.round(d.expenses * 100) / 100,
        profit: Math.round((d.revenue - d.cost - d.expenses) * 100) / 100
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
      // 0. Today's Bounds (Asia/Kolkata / IST aware)
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffset);
      const startOfIstToday = new Date(istNow);
      startOfIstToday.setUTCHours(0, 0, 0, 0); 
      const safeToday = new Date(startOfIstToday.getTime() - istOffset);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [
        revenueResult,
        totalOrders,
        totalCustomers,
        totalProducts,
        lowStockItems,
        todayOrdersData,
        topProductsData,
        monthlySalesData,
        categoriesData
      ] = await Promise.all([
        // 1. Revenue & Orders (Historical total)
        prisma.order.aggregate({
          where: { shopId, status: { not: 'CANCELLED' as any } },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        prisma.order.count({ where: { shopId, status: { not: 'CANCELLED' as any } } }),
        prisma.customer.count({ where: { shopId } }),
        prisma.product.count({ where: { shopId } }),
        prisma.product.count({ where: { shopId, stock: { lte: prisma.product.fields.lowStockAlert } } }),
        // 5. Today's orders for factual margin
        prisma.order.findMany({
          where: { shopId, createdAt: { gte: safeToday }, status: { not: 'CANCELLED' as any } },
          include: { items: true }
        }),
        // 6. Top Products
        prisma.orderItem.groupBy({
          by: ['productId', 'name'],
          _sum: { quantity: true, total: true },
          where: { order: { shopId, status: { not: 'CANCELLED' as any } } },
          orderBy: { _sum: { total: 'desc' } },
          take: 5
        }),
        // 7. Monthly Sales
        prisma.order.findMany({
          where: { shopId, createdAt: { gte: sixMonthsAgo }, status: { not: 'CANCELLED' as any } },
          include: { items: true }
        }),
        // 8. Category Breakdown
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

      let todayRevenue = 0;
      let todayCogs = 0;
      todayOrdersData.forEach(o => {
        todayRevenue += Number(o.totalAmount);
        o.items.forEach(i => {
          todayCogs += Number(i.costPrice || 0) * i.quantity;
        });
      });

      // Format Monthly Sales WITH COGS
      const monthlyMap: Record<string, { revenue: number, orders: number, cogs: number }> = {};
      monthlySalesData.forEach(o => {
        const month = o.createdAt.toLocaleString('default', { month: 'short' });
        if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, orders: 0, cogs: 0 };
        monthlyMap[month].revenue += Number(o.totalAmount);
        monthlyMap[month].orders += 1;
        o.items.forEach(i => {
          monthlyMap[month].cogs += Number(i.costPrice || 0) * i.quantity;
        });
      });
      const monthlySales = Object.entries(monthlyMap).map(([month, data]) => ({
        month, ...data, profit: data.revenue - data.cogs
      }));

      const totalRevenue = Number(revenueResult._sum.totalAmount || 0);
      const avgOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

      // 1. Format Top Products
      const topProducts = topProductsData.map(p => ({
        name: p.name,
        quantity: p._sum.quantity || 0,
        revenue: Number(p._sum.total || 0)
      }));

      // 2. Format Category Breakdown
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
        totalCustomers,
        totalProducts,
        avgOrderValue,
        todayRevenue,
        todayCogs,
        todayOrdersCount: todayOrdersData.length,
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
  },

  /**
   * Get Financial Summary (P&L)
   * Unified view of Revenue, COGS, and OpEx for total financial transparency.
   */
  getFinancialSummary: async (shopId: string, days = 30) => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [orders, expenses] = await Promise.all([
        prisma.order.findMany({
          where: { shopId, createdAt: { gte: startDate }, status: { not: 'CANCELLED' as any } },
          include: { items: true }
        }),
        prisma.expense.findMany({
          where: { shopId, date: { gte: startDate } }
        })
      ]);

      let totalRevenue = 0;
      let totalCOGS = 0;
      let totalOpEx = 0;

      orders.forEach(o => {
        totalRevenue += Number(o.totalAmount);
        o.items.forEach(i => {
          totalCOGS += Number(i.costPrice) * i.quantity;
        });
      });

      expenses.forEach(e => {
        totalOpEx += Number(e.amount);
      });

      const grossProfit = totalRevenue - totalCOGS;
      const netProfit = grossProfit - totalOpEx;

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        totalOpEx: Math.round(totalOpEx * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        marginPercent: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 10000) / 100 : 0,
        daysAnalyzed: days
      };
    } catch (error: any) {
      logger.error(`[ANALYTICS] Financial summary failed: ${error.message}`);
      throw error;
    }
  }
};

export const calculateDashboardStats = AnalyticsService.calculateDashboardStats;
