import { Queue } from 'bullmq';
import { redisConnection, DEFAULT_JOB_OPTIONS } from '../config';

export const dashboardQueue = new Queue('dashboard_stats_queue', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS
});

export const addDashboardUpdateJob = async (shopId: string) => {
  try {
    await dashboardQueue.add(`update_dashboard_${shopId}_${Date.now()}`, { shopId });
    console.log(`[Queue] Added dashboard update job for shop: ${shopId}`);
  } catch (error) {
    console.error(`[Queue] Failed to add dashboard update job for shop ${shopId}:`, error);
  }
};
