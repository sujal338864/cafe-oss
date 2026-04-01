// PASTE THIS INTO: C:\Users\Lenovo\Downloads\files\backend\src\routes\analytics.ts
// Fixes: too many parallel Prisma queries causing connection pool timeout

import { Router } from 'express';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';
import { getCache, setCache } from '../common/cache';
import { calculateDashboardStats } from '../services/analytics.service';
import { prisma } from '../index';

const router = Router();

router.get('/dashboard', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;

    // 2. Cache Miss -> Fallback to Calculate Inline
    // CACHE DISABLED: Ensuring real-time dashboard accuracy per user request
    const stats = await calculateDashboardStats(shopId);
  
    // Save to Cache (Short TTL 5s for performance during high traffic, but effectively real-time)
    try {
      await setCache(`dashboard:stats:${shopId}`, stats, 5);
    } catch (err) {
      console.error(`[Analytics] Cache write error for shop ${shopId}:`, err);
    }
  
    res.json(stats);
}));

/**
 * GET /api/analytics/mega-dashboard
 * The "Nuclear Option" for performance. Returns EVERYTHING in one call.
 */
router.get('/dashboard-mega', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const cacheKey = `mega_dashboard:${shopId}`;

  const cached = await getCache(cacheKey);
  if (cached) return res.json(cached);

  const { AnalyticsService } = await import('../services/analytics.service');
  
  // 30s timeout — never hang forever
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Dashboard timeout after 30s')), 30000));
  try {
    const data = await Promise.race([AnalyticsService.getMegaDashboardData(shopId), timeout]);
    await setCache(cacheKey, data, 10);
    res.json(data);
  } catch (err: any) {
    console.error(`[MEGA-DASHBOARD] Error: ${err.message}`);
    res.status(200).json({ stats: { totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalProducts: 0, lowStockItems: 0, avgOrderValue: 0, totalInventoryValue: 0, todayRevenue: 0, todayMargin: 0, todayOrdersCount: 0 }, recentOrders: { orders: [] }, profitList: { profitList: [] }, forecasting: { forecasting: [] }, heatmap: { heatmap: null }, financialSummary: { summary: null }, timestamp: new Date(), error: err.message });
  }
}));

/**
 * GET /api/analytics/financial-summary
 * Returns the true P&L (Profit & Loss) after subtracting COGS and OpEx.
 */
router.get('/financial-summary', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const days = parseInt(req.query.days as string) || 30;

  const { AnalyticsService } = await import('../services/analytics.service');
  const summary = await AnalyticsService.getFinancialSummary(shopId, days);

  res.json({ summary });
}));

/**
 * GET /api/analytics/daily-profit
 * Returns aggregated profit/revenue for the last N days.
 */
router.get('/daily-profit', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const days = parseInt(req.query.days as string) || 7;
  
  const { AnalyticsService } = await import('../services/analytics.service');
  const profitList = await AnalyticsService.getDailyProfit(shopId, days);
  
  res.json({ profitList });
}));

/**
 * GET /api/analytics/inventory-forecast
 * Returns stockout predictions based on sales velocity.
 */
router.get('/inventory-forecast', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  
  const { AnalyticsService } = await import('../services/analytics.service');
  const forecasting = await AnalyticsService.getInventoryForecast(shopId);
  
  res.json({ forecasting });
}));

/**
 * GET /api/analytics/peak-hours
 * Returns a 24/7 heatmap of order volume for staffing optimization.
 * Helps owners decide when to schedule more or fewer staff members.
 */
router.get('/peak-hours', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const { AnalyticsService } = await import('../services/analytics.service');
  const heatmap = await AnalyticsService.getPeakHours(shopId);
  res.json({ heatmap });
}));

// Recent activity
router.get('/recent', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const orders = await prisma.order.findMany({
    where: { shopId },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, invoiceNumber: true, totalAmount: true, paymentMethod: true, paymentStatus: true, createdAt: true,
      customer: { select: { name: true } }
    }
  });
  res.json({ orders });
}));

export default router;