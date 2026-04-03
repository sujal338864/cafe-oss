import { Router } from 'express';
import { asyncHandler, AuthRequest } from '../middleware/auth';
import { ReportsService } from '../services/reports.service';
import { AnalyticsService } from '../services/analytics.service';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /api/reports/preview
 * Returns report data for the UI dashboard.
 */
router.get('/preview', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.shopId!;
  const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
  
  const data = await ReportsService.generateReport(shopId, period);
  res.json(data);
}));

/**
 * GET /api/reports/download
 * Generates and downloads a report file (PDF or CSV).
 */
router.get('/download', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.shopId!;
  const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
  const format = (req.query.format as 'pdf' | 'csv') || 'pdf';

  // 1. Subscription Guard
  const isPro = await AnalyticsService.checkProPlan(shopId);
  if (!isPro && period !== 'daily') {
    return res.status(403).json({ message: 'PRO plan required for non-daily report downloads.' });
  }

  // 2. Generate File
  try {
    if (format === 'csv') {
      const csv = await ReportsService.generateCSV(shopId, period);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=ShopOS_${period}_Report_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    } else {
      const pdf = await ReportsService.generatePDF(shopId, period);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ShopOS_${period}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      return res.send(pdf);
    }
  } catch (error: any) {
    logger.error(`[REPORT-ROUTER] Download failed: ${error.message}`);
    res.status(500).json({ message: 'Internal Server Error during report generation.' });
  }
}));

export default router;
