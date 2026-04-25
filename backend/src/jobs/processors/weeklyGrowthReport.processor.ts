import { prisma } from '../../common/prisma';
import { logger } from '../../lib/logger';
import { GrowthService } from '../../services/growth.service';
import { EmailService } from '../../services/email.service';

/**
 * Weekly Growth Report Processor
 * Dispatches performance summaries to all active shop owners.
 */
export const weeklyGrowthReportProcessor = async () => {
  logger.info('[GROWTH REPORT] Starting weekly bulk dispatch...');

  try {
    const shops = await prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true }
    });

    logger.info(`[GROWTH REPORT] Found ${shops.length} active shops to process.`);

    for (const shop of shops) {
      try {
        // 1. Fetch KPIs
        const kpis = await GrowthService.getGrowthKPIs(shop.id);

        // 2. Dispatch Email
        const success = await EmailService.sendWeeklyReport(shop.name, shop.email, kpis);

        if (success) {
          logger.info(`[GROWTH REPORT] Sent successfully to ${shop.name} (${shop.email})`);
        }
        
        // Anti-spam/Rate-limit pause
        await new Promise(r => setTimeout(r, 200));

      } catch (shopErr: any) {
        logger.error(`[GROWTH REPORT] Failed for shop ${shop.id}: ${shopErr.message}`);
      }
    }

    logger.info('[GROWTH REPORT] Bulk dispatch completed.');
  } catch (error: any) {
    logger.error(`[GROWTH REPORT] Fatal error in processor: ${error.message}`);
    throw error;
  }
};
