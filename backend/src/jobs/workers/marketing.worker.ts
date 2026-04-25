import { Worker } from 'bullmq';
import { redisConnection } from '../config';
import { marketingBrainProcessor } from '../processors/marketing.processor';
import { logger } from '../../lib/logger';

export const marketingBrainWorker = new Worker('MarketingBrain', marketingBrainProcessor, {
  connection: redisConnection,
  concurrency: 1 // Run one heavy marketing calculation block at a time to save memory
});

marketingBrainWorker.on('completed', (job) => {
  logger.info(`[MARKETING BRAIN WORKER] Completed job ${job.id}`);
});

marketingBrainWorker.on('failed', (job, err) => {
  logger.error(`[MARKETING BRAIN WORKER] Job ${job?.id} failed: ${err.message}`);
});
