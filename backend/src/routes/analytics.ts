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

  // 1. Try Cache
  try {
    const cachedStats = await getCache<any>(`dashboard:stats:${shopId}`);
    if (cachedStats) {
      return res.json(cachedStats);
    }
  } catch (err) {
    console.error(`[Analytics] Cache read error for shop ${shopId}:`, err);
  }

  // 2. Cache Miss -> Fallback to Calculate Inline
  console.warn(`[Analytics] Cache miss for shop ${shopId}. Calculating inline...`);
  const stats = await calculateDashboardStats(shopId);

  // 3. Save to Cache
  try {
    await setCache(`dashboard:stats:${shopId}`, stats, 3600); // 1 hour TTL
  } catch (err) {
    console.error(`[Analytics] Cache write error for shop ${shopId}:`, err);
  }

  res.json(stats);
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
    include: { customer: true, items: true }
  });
  res.json({ orders });
}));

export default router;