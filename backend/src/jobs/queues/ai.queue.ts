import { Queue } from 'bullmq';
import { redisConnection, DEFAULT_JOB_OPTIONS } from '../config';

/**
 * Queue for controlling asynchronous OpenAI insight generation jobs.
 */
export const aiInsightsQueue = new Queue('ai_insights', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS
});

export const addAiInsightsJob = async (shopId: string) => {
  // Use shopId as an ID modifier to deduplicate jobs that might double trigger
  await aiInsightsQueue.add('generate_insights', { shopId }, { jobId: `ai_insight:${shopId}` });
};
