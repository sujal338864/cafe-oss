import { Job } from 'bullmq';
import { prisma } from '../../common/prisma';
import { MarketingService } from '../../services/marketing.service';
import { logger } from '../../lib/logger';

export const marketingBrainProcessor = async (job: Job) => {
  logger.info(`[MARKETING BRAIN] Starting daily marketing plan computation...`);

  const shops = await prisma.shop.findMany({
    where: {
      isActive: true,
      // COST CONTROL: Only run AI marketing brain for PRO/ENTERPRISE shops.
      // STARTER shops do not have aiMarketing feature and should not incur OpenAI costs.
      plan: { in: ['PRO', 'ENTERPRISE'] as any }
    },
    select: { id: true, name: true }
  });

  for (const shop of shops) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day

      // Check if we already generated intel for today
      const existing = await (prisma as any).dailyMarketingIntel.findUnique({
        where: {
          shopId_date: { shopId: shop.id, date: today }
        }
      });

      if (existing) {
        continue; // Already generated
      }

      logger.info(`[MARKETING BRAIN] Building intel for Shop: ${shop.name}`);
      const intel = await MarketingService.generateDailyIntel(shop.id);
      if (!intel) {
        logger.warn(`[MARKETING BRAIN] No intel returned for shop ${shop.name}, skipping.`);
        continue;
      }

      await (prisma as any).dailyMarketingIntel.create({
        data: {
          shopId: shop.id,
          date: today,
          planText: intel.text,
          keyFocus: intel.keyFocus,
          actionItems: intel.actionItems || []
        }
      });
      
    } catch (e: any) {
      logger.error(`[MARKETING BRAIN] Failed for shop ${shop.id}: ${e.message}`);
    }
  }

  logger.info(`[MARKETING BRAIN] Global computation finished.`);
};
