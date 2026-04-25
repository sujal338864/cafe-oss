import { prisma } from '../../common/prisma';
import { logger } from '../../lib/logger';
import { MenuSyncService } from '../../services/menuSync.service';

/**
 * BullMQ Processor for Menu Template Sync
 * Payload: { jobId, orgId, templateId, branchIds, mode }
 */
export const menuSyncProcessor = async (job: any) => {
  const { jobId, orgId, templateId, branchIds, mode } = job.data;
  const start = Date.now();

  logger.info(`[MenuSync] Starting Job ${jobId} for Org ${orgId}. Target Branches: ${branchIds.length}`);

  try {
    // 1. Update job to processing
    await (prisma as any).menuSyncJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' }
    });

    // 2. Fetch Template
    const template = await (prisma as any).menuTemplate.findFirst({
      where: { id: templateId, organizationId: orgId }
    });

    if (!template) throw new Error('Menu template no longer exists');

    const summary: any = {
      branchesProcessed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      details: []
    };

    // 3. Process each branch sequentially to save DB connection pool
    for (const branchId of branchIds) {
      try {
        const result = await MenuSyncService.syncToSingleBranch(branchId, template, mode);
        summary.branchesProcessed++;
        summary.totalCreated += result.created;
        summary.totalUpdated += result.updated;
        summary.details.push({ branchId, ...result, success: true });
      } catch (branchErr: any) {
        summary.details.push({ branchId, error: branchErr.message, success: false });
      }
    }

    // 4. Finalize Job
    await (prisma as any).menuSyncJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        result: summary,
        completedAt: new Date()
      }
    });

    // 5. Update Template timestamp
    await (prisma as any).menuTemplate.update({
      where: { id: templateId },
      data: { lastSyncedAt: new Date() }
    });

    logger.info(`[MenuSync] Job ${jobId} finished in ${Date.now() - start}ms. Branches: ${summary.branchesProcessed}`);
    return summary;

  } catch (err: any) {
    logger.error(`[MenuSync] Fatal Job Failure ${jobId}: ${err.message}`);
    await (prisma as any).menuSyncJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: err.message, completedAt: new Date() }
    });
    throw err;
  }
};
