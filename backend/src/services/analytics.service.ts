import { prisma } from '../common/prisma';
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
          select: { totalAmount: true, createdAt: true, items: { select: { costPrice: true, quantity: true } } },
          orderBy: { createdAt: 'asc' }
        }),
        prisma.expense.findMany({
          where: { shopId, date: { gte: startDate } },
          select: { amount: true, date: true }
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

      const results = products.map(p => {
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

      // Egress Optimization: Only return top 15 critical items for dashboard overview
      return results.slice(0, 15);
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

      // SEQUENTIAL: Save connection pool to avoid "MaxClientsInSessionMode"
      const revenueResult = await prisma.order.aggregate({
          where: { shopId, status: { not: 'CANCELLED' as any } },
          _sum: { totalAmount: true },
          _count: { id: true }
      });
      const totalOrders = await prisma.order.count({ where: { shopId, status: { not: 'CANCELLED' as any } } });
      const totalCustomers = await prisma.customer.count({ where: { shopId } });
      const totalProducts = await prisma.product.count({ where: { shopId, isActive: true } });
      const lowStockResult = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint as count FROM "Product" WHERE "shopId" = ${shopId} AND "isActive" = true AND "stock" <= "lowStockAlert"`;
      const todayOrdersData = await prisma.order.findMany({
          where: { shopId, createdAt: { gte: safeToday }, status: { not: 'CANCELLED' as any } },
          select: { totalAmount: true, items: { select: { costPrice: true, quantity: true } } }
      });
      const inventoryValueResult = await prisma.$queryRaw<{ sum: number }[]>`SELECT SUM("stock" * CAST("costPrice" AS numeric)) as sum FROM "Product" WHERE "shopId" = ${shopId} AND "isActive" = true`;
      const topProductsData = await prisma.orderItem.groupBy({
          by: ['productId', 'name'],
          _sum: { quantity: true, total: true },
          where: { order: { shopId, status: { not: 'CANCELLED' as any } } },
          orderBy: { _sum: { total: 'desc' } },
          take: 5
      });
      const monthlySalesData = await prisma.order.findMany({
          where: { shopId, createdAt: { gte: sixMonthsAgo }, status: { not: 'CANCELLED' as any } },
          select: { totalAmount: true, createdAt: true, items: { select: { costPrice: true, quantity: true } } }
      });
      const categorySalesResult = await prisma.$queryRaw<any[]>`
          SELECT c.name as "categoryName", SUM(oi.total) as "totalAmount"
          FROM "Category" c
          JOIN "Product" p ON p."categoryId" = c.id
          JOIN "OrderItem" oi ON oi."productId" = p.id
          JOIN "Order" o ON oi."orderId" = o.id
          WHERE c."shopId" = ${shopId} AND o.status != 'CANCELLED'
          GROUP BY c.name
      `;
      const lowStockItems = Number(lowStockResult?.[0]?.count || 0);

      const categorySales: Record<string, number> = {};
      categorySalesResult.forEach(row => {
        categorySales[row.categoryName] = Number(row.totalAmount || 0);
      });

      const totalInventoryValue = Number(inventoryValueResult?.[0]?.sum || 0);

      let todayRevenue = 0;
      let todayCogs = 0;
      todayOrdersData.forEach(o => {
        todayRevenue += Number(o.totalAmount);
        o.items.forEach(i => {
          todayCogs += Number(i.costPrice || 0) * i.quantity;
        });
      });

      const todayMargin = todayRevenue - todayCogs;

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

      const totalRevenueValue = Number(revenueResult?._sum?.totalAmount || 0);
      const avgOrderValue = totalOrders > 0 ? Math.round((totalRevenueValue / totalOrders) * 100) / 100 : 0;

      // 1. Format Top Products
      const topProducts = (topProductsData || []).map(p => ({
        name: p.name || 'Unknown',
        quantity: p._sum?.quantity || 0,
        revenue: Number(p._sum?.total || 0)
      }));

      // 2. Format Category Breakdown
      const categoryBreakdown = Object.entries(categorySales || {}).map(([name, revenue]) => ({
        name, revenue: Number(revenue || 0)
      }));

      return {
        totalRevenue: totalRevenueValue,
        totalOrders: totalOrders || 0,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        avgOrderValue,
        todayRevenue: todayRevenue || 0,
        todayCogs: todayCogs || 0,
        todayMargin: todayMargin || 0,
        totalInventoryValue: totalInventoryValue || 0,
        todayOrdersCount: (todayOrdersData || []).length,
        lowStockItems: lowStockItems || 0,
        topProducts,
        monthlySales: monthlySales || [],
        categoryBreakdown,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error(`[ANALYTICS] Stats calculation failed: ${error.message}`);
      // Return zeroed stats instead of throwing to keep UI alive
      return {
        totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalProducts: 0,
        avgOrderValue: 0, todayRevenue: 0, todayCogs: 0, todayMargin: 0,
        totalInventoryValue: 0, todayOrdersCount: 0, lowStockItems: 0,
        topProducts: [], monthlySales: [], categoryBreakdown: [],
        timestamp: new Date(), error: error.message
      };
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
      // Return empty heatmap as fail-safe
      const heatmap: Record<number, Record<number, number>> = {};
      for (let d = 0; d < 7; d++) {
        heatmap[d] = {};
        for (let h = 0; h < 24; h++) heatmap[d][h] = 0;
      }
      return heatmap;
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

      // SEQUENTIAL: Save connection pool
      const orders = await prisma.order.findMany({
        where: { shopId, createdAt: { gte: startDate }, status: { not: 'CANCELLED' as any } },
        select: { totalAmount: true, items: { select: { costPrice: true, quantity: true } } }
      });
      const expenses = await prisma.expense.findMany({
        where: { shopId, date: { gte: startDate } }
      });

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
      return {
        totalRevenue: 0, totalCOGS: 0, totalOpEx: 0,
        grossProfit: 0, netProfit: 0, marginPercent: 0,
        daysAnalyzed: days
      };
    }
  },

  /**
   * Split Analytics Phase 4: Fast Stats
   */
  getDashboardStats: async (shopId: string) => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const startOfIstToday = new Date(istNow);
    startOfIstToday.setUTCHours(0, 0, 0, 0); 
    const safeToday = new Date(startOfIstToday.getTime() - istOffset);

    const cacheKey = `analytics:stats:${shopId}`;
    try {
      const { redis } = await import('../lib/redis');
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}

    const raw = await prisma.$queryRaw<any[]>`
      WITH stats AS (
        SELECT 
          COUNT(id)::int as total_orders,
          COALESCE(SUM("totalAmount"), 0)::float as total_revenue,
          (SELECT COUNT(*)::int FROM "Customer" WHERE "shopId" = ${shopId}) as total_customers,
          (SELECT COUNT(*)::int FROM "Product" WHERE "shopId" = ${shopId} AND "isActive" = true) as total_products,
          (SELECT COUNT(*)::int FROM "Product" WHERE "shopId" = ${shopId} AND "isActive" = true AND "stock" <= "lowStockAlert") as low_stock_items
        FROM "Order" 
        WHERE "shopId" = ${shopId} AND "status" != 'CANCELLED'
      ),
      today AS (
        SELECT 
          COUNT(id)::int as count,
          COALESCE(SUM("totalAmount"), 0)::float as revenue,
          COALESCE(SUM((SELECT SUM("costPrice" * "quantity") FROM "OrderItem" WHERE "orderId" = o.id)), 0)::float as cogs
        FROM "Order" o
        WHERE "shopId" = ${shopId} AND "createdAt" >= ${safeToday} AND "status" != 'CANCELLED'
      ),
      inventory AS (
        SELECT COALESCE(SUM("stock" * CAST("costPrice" AS numeric)), 0)::float as val
        FROM "Product"
        WHERE "shopId" = ${shopId} AND "isActive" = true
      ),
      finance_30d AS (
        SELECT 
          COALESCE(SUM("totalAmount"), 0)::float as rev,
          COALESCE(SUM((SELECT SUM("costPrice" * "quantity") FROM "OrderItem" WHERE "orderId" = o.id)), 0)::float as cogs
        FROM "Order" o
        WHERE "shopId" = ${shopId} AND "createdAt" >= CURRENT_DATE - INTERVAL '30 days' AND "status" != 'CANCELLED'
      ),
      opex_30d AS (
        SELECT COALESCE(SUM(amount), 0)::float as val
        FROM "Expense"
        WHERE "shopId" = ${shopId} AND "date" >= CURRENT_DATE - INTERVAL '30 days'
      )
      SELECT 
        row_to_json(stats) as stats, 
        row_to_json(today) as today, 
        (SELECT val FROM inventory) as inventory_val,
        row_to_json(finance_30d) as finance,
        (SELECT val FROM opex_30d) as opex
      FROM stats, today, finance_30d
    `;

    const r = raw[0];
    const result = {
      totalRevenue: r.stats.total_revenue,
      totalOrders: r.stats.total_orders,
      totalCustomers: r.stats.total_customers,
      totalProducts: r.stats.total_products,
      avgOrderValue: r.stats.total_orders > 0 ? r.stats.total_revenue / r.stats.total_orders : 0,
      todayRevenue: r.today.revenue,
      todayCogs: r.today.cogs,
      todayMargin: r.today.revenue - r.today.cogs,
      todayOrdersCount: r.today.count,
      lowStockItems: r.stats.low_stock_items,
      totalInventoryValue: r.inventory_val,
      financialSummary: {
        totalRevenue: r.finance.rev,
        totalCOGS: r.finance.cogs,
        totalOpEx: r.opex,
        netProfit: r.finance.rev - r.finance.cogs - r.opex
      }
    };

    try {
      const { redis } = await import('../lib/redis');
      await redis.setex(cacheKey, 30, JSON.stringify(result));
    } catch (e) {}
    
    return result;
  },

  /**
   * Split Analytics Phase 4: Heavy Charts
   */
  getDashboardCharts: async (shopId: string) => {
    const cacheKey = `analytics:charts:${shopId}`;
    try {
      const { redis } = await import('../lib/redis');
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}

    const raw = await prisma.$queryRaw<any[]>`
      WITH RECURSIVE last_7_days AS (
        SELECT CURRENT_DATE - INTERVAL '6 days' as date
        UNION ALL
        SELECT date + INTERVAL '1 day' FROM last_7_days WHERE date < CURRENT_DATE
      ),
      daily_pulse AS (
        SELECT 
          d.date::date as day,
          COALESCE(SUM(o."totalAmount"), 0)::float as revenue,
          COALESCE(SUM((SELECT SUM("costPrice" * "quantity") FROM "OrderItem" WHERE "orderId" = o.id)), 0)::float as cogs
        FROM last_7_days d
        LEFT JOIN "Order" o ON o."createdAt"::date = d.date AND o."shopId" = ${shopId} AND o.status != 'CANCELLED'
        GROUP BY d.date
        ORDER BY d.date ASC
      ),
      top_products AS (
        SELECT name, SUM(quantity)::int as q, SUM(total)::float as r
        FROM "OrderItem"
        JOIN "Order" ON "Order".id = "OrderItem"."orderId"
        WHERE "Order"."shopId" = ${shopId} AND "Order".status != 'CANCELLED'
        GROUP BY name ORDER BY r DESC LIMIT 5
      ),
      peak_hours AS (
        SELECT EXTRACT(DOW FROM "createdAt") as dow, EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*)::int as c
        FROM "Order" WHERE "shopId" = ${shopId} GROUP BY dow, hour
      )
      SELECT 
        (SELECT json_agg(pulse) FROM daily_pulse pulse) as profit_pulse,
        (SELECT json_agg(tp) FROM top_products tp) as top_products,
        (SELECT json_agg(ph) FROM peak_hours ph) as heatmap
    `;

    const r = raw[0];
    
    // Build Heatmap
    const heatMapGrid: any = {};
    for (let d = 0; d < 7; d++) {
      heatMapGrid[d] = {};
      for (let h = 0; h < 24; h++) heatMapGrid[d][h] = 0;
    }
    (r.heatmap || []).forEach((row: any) => {
      heatMapGrid[Number(row.dow)][Number(row.hour)] = row.c;
    });

    const result = {
      profitPulse: (r.profit_pulse || []).map((p: any) => ({ name: p.day, revenue: p.revenue, profit: p.revenue - p.cogs })),
      topProducts: r.top_products || [],
      heatmap: heatMapGrid
    };

    try {
      const { redis } = await import('../lib/redis');
      await redis.setex(cacheKey, 60, JSON.stringify(result));
    } catch (e) {}

    return result;
  },

  /**
   * Mega Dashboard Data (Legacy/Bridge)
   */
  getMegaDashboardData: async (shopId: string) => {
    try {
      const stats = await AnalyticsService.getDashboardStats(shopId);
      const charts = await AnalyticsService.getDashboardCharts(shopId);
      return { stats, ...charts, timestamp: new Date() };
    } catch (error: any) {
      logger.error(`[MEGA-DASHBOARD] Fallback failed: ${error.message}`);
      return { stats: { totalRevenue: 0 }, timestamp: new Date() };
    }
  },

  /**
   * Sequential Safe Mode (Fallback)
   * Runs stats and charts sequentially to avoid connection pool exhaustion.
   */
  getMegaDashboardDataSequential: async (shopId: string) => {
    try {
      const stats = await AnalyticsService.getDashboardStats(shopId);
      const charts = await AnalyticsService.getDashboardCharts(shopId);
      return { stats, ...charts, timestamp: new Date() };
    } catch (error: any) {
      logger.error(`[SEQUENTIAL-DASHBOARD] Failed: ${error.message}`);
      return {
        stats: { totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalProducts: 0,
                 avgOrderValue: 0, todayRevenue: 0, todayCogs: 0, todayMargin: 0,
                 todayOrdersCount: 0, lowStockItems: 0, totalInventoryValue: 0 },
        timestamp: new Date(),
        error: error.message
      };
    }
  }
};

export const calculateDashboardStats = AnalyticsService.calculateDashboardStats;
