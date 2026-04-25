import { Queue, QueueOptions } from 'bullmq';
import { redisConnection } from '../config';
import { logger } from '../../lib/logger';

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: { age: 24 * 3600 } 
  }
};

export const marketingBrainQueue = new Queue('MarketingBrain', queueOptions);

marketingBrainQueue.on('error', (err) => {
  logger.error(`[MARKETING BRAIN QUEUE] Error: ${err.message}`);
});

export const scheduleDailyMarketingBrain = async () => {
  logger.info('[MARKETING BRAIN QUEUE] Scheduling midnight AI cron job...');
  
  await marketingBrainQueue.add('generate-daily-intel', {}, {
    repeat: {
      pattern: '0 2 * * *' // Run every day at 2:00 AM
    }
  });
};
