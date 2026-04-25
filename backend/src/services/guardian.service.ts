
import { prisma } from '../common/prisma';
import { logger } from '../lib/logger';

/**
 * Guardian Worker: Cleans up "Ghost Jobs" and stale system states.
 */
export const GuardianService = {
  /**
   * Identifies and fails stuck Menu Sync jobs.
   * Stale = PROCESSING status for > 15 minutes.
   */
  cleanupStuckSyncJobs: async () => {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

    const staleJobs = await (prisma as any).menuSyncJob.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: fifteenMinsAgo }
      }
    });

    if (staleJobs.length === 0) return;

    logger.warn(`[GUARDIAN] Found ${staleJobs.length} stale sync jobs. Setting to FAILED.`);

    await (prisma as any).menuSyncJob.updateMany({
      where: { id: { in: staleJobs.map(j => j.id) } },
      data: { 
        status: 'FAILED', 
        error: 'Job timed out or worker crashed during processing.' 
      }
    });
  }
};
