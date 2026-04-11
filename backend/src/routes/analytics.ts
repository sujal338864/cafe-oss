// PASTE THIS INTO: C:\Users\Lenovo\Downloads\files\backend\src\routes\analytics.ts
// Fixes: too many parallel Prisma queries causing connection pool timeout

import { Router } from 'express';
import { authenticate, authorize, asyncHandler, AuthRequest } from '../middleware/auth';
import { getCache, setCache } from '../common/cache';
import { calculateDashboardStats, AnalyticsService } from '../services/analytics.service';
import { AnalyticsServiceV2 } from '../services/analytics.service.v2';
import { prisma } from '../common/prisma';

const router = Router();

router.get('/dashboard', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
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
 * GET /api/analytics/dashboard/stats
 * FAST: Instant summary stats.
 */
router.get('/dashboard/stats', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const stats = await AnalyticsService.getDashboardStats(shopId);
  res.json(stats);
}));

/**
 * GET /api/analytics/dashboard/charts
 * HEAVY: Periodic/Group-by calculations for visualizations.
 */
router.get('/dashboard/charts', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const charts = await AnalyticsService.getDashboardCharts(shopId);
  res.json(charts);
}));

/**
 * GET /api/analytics/mega-dashboard (Legacy Bridge)
 * Still maintained for backward compatibility.
 */
router.get('/dashboard-mega', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const data = await AnalyticsService.getMegaDashboardData(shopId);
  res.json(data);
}));

/**
 * GET /api/analytics/financial-summary
 * Returns the true P&L (Profit & Loss) after subtracting COGS and OpEx.
 */
router.get('/financial-summary', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
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
router.get('/daily-profit', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
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
router.get('/inventory-forecast', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
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
router.get('/peak-hours', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const { AnalyticsService } = await import('../services/analytics.service');
  const heatmap = await AnalyticsService.getPeakHours(shopId);
  res.json({ heatmap });
}));

// Recent activity
router.get('/recent', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
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

// --- NEW REPORTS API (V2) ---

/**
 * GET /api/analytics/reports/daily?date=YYYY-MM-DD
 */
router.get('/reports/daily', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const dateStr = req.query.date as string;
  const date = dateStr ? new Date(dateStr) : new Date();

  const report = await AnalyticsServiceV2.getDailyReport(shopId, date);
  res.json(report);
}));

/**
 * GET /api/analytics/reports/weekly?endDate=YYYY-MM-DD
 */
router.get('/reports/weekly', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const dateStr = req.query.endDate as string;
  const date = dateStr ? new Date(dateStr) : new Date();

  const report = await AnalyticsServiceV2.getWeeklyReport(shopId, date);
  res.json(report);
}));

/**
 * GET /api/analytics/reports/monthly?month=MM&year=YYYY
 */
router.get('/reports/monthly', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const month = parseInt(req.query.month as string) || new Date().getMonth(); // 0-11

  const report = await AnalyticsServiceV2.getMonthlyReport(shopId, year, month);
  res.json(report);
}));

/**
 * GET /api/analytics/debug/db-stats
 * (Public health check with counts only)
 */
/**
 * GET /api/analytics/debug/db-stats
 * (Admin-only health check — counts per resource)
 */
router.get('/debug/db-stats', authenticate, authorize('ADMIN'), asyncHandler(async (req, res) => {
  const [orders, products, shops, users] = await Promise.all([
    prisma.order.count(),
    prisma.product.count(),
    prisma.shop.count(),
    prisma.user.count()
  ]);
  res.json({
    status: 'ok',
    counts: { orders, products, shops, users }
    // Note: database host intentionally omitted for security
  });
}));

export default router;