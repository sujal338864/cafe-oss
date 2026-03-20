import { Queue } from 'bullmq';
import { redisConnection } from '../config';

/**
 * Queue for controlling asynchronous OpenAI insight generation jobs.
 */
export const aiInsightsQueue = new Queue('ai_insights', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 }, // Keep last 100 jobs history
  }
});

export const addAiInsightsJob = async (shopId: string) => {
  // Use shopId as an ID modifier to deduplicate jobs that might double trigger
  await aiInsightsQueue.add('generate_insights', { shopId }, { jobId: `ai_insight:${shopId}` });
};
