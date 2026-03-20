import { Queue } from 'bullmq';
import { redisConnection } from '../config';

export const dashboardQueue = new Queue('dashboard_stats_queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  }
});

export const addDashboardUpdateJob = async (shopId: string) => {
  try {
    await dashboardQueue.add(`update_dashboard_${shopId}_${Date.now()}`, { shopId });
    console.log(`[Queue] Added dashboard update job for shop: ${shopId}`);
  } catch (error) {
    console.error(`[Queue] Failed to add dashboard update job for shop ${shopId}:`, error);
  }
};
