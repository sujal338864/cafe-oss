import { Queue, QueueOptions } from 'bullmq';
import { redisConnection } from '../config';
import { logger } from '../../lib/logger';

const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,                   // Automatically retry transient failures
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600 }, // Keep success logs for 1 hour
    removeOnFail: { age: 86400 * 3 } // Keep failure logs for 3 days
  }
};

export const emailQueue = new Queue('EmailQueue', queueOptions);

export interface EmailJobData {
  campaignId: string;
  shopName: string;
  subject: string;
  htmlContent: string;
  recipients: { email: string; name: string }[];
}

export const dispatchCampaignBatch = async (data: EmailJobData) => {
  try {
    // Send standard job, but handle dispatch looping inside the worker to prevent DB crashes
    await emailQueue.add('send_campaign_batch', data);
  } catch (error: any) {
    logger.error(`[EMAIL QUEUE] Failed to add job: ${error.message}`);
  }
};
