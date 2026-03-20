import { Job } from 'bullmq';
import { calculateDashboardStats } from '../../services/analytics.service';
import { setCache } from '../../common/cache';

export const dashboardProcessor = async (job: Job) => {
  const { shopId } = job.data;
  console.log(`[Queue] Recalculating dashboard for shop: ${shopId}`);

  try {
    const stats = await calculateDashboardStats(shopId);
    await setCache(`dashboard:stats:${shopId}`, stats, 3600); // Cache for 1 hour
    console.log(`[Queue] Dashboard stats updated for shop: ${shopId}`);
  } catch (error) {
    console.error(`[Queue] Failed to update dashboard for shop ${shopId}:`, error);
    throw error;
  }
};
