import { Worker, Queue } from 'bullmq';
import { redisConnection } from './config';
import { whatsappProcessor } from './processors/whatsapp.processor';
import { dashboardProcessor } from './processors/dashboard.processor';
import { aiInsightsProcessor } from './processors/ai.processor';
import { analyticsAggregationProcessor } from './processors/analytics.processor';
import { adminAnalyticsProcessor } from './processors/adminAnalytics.processor';
import { logRedisError } from '../lib/redis';

/**
 * Initialize all Background Workers on server boot
 */
export const startWorkers = () => {
  console.log('[Queue] Starting Background Workers...');

  // 1. WhatsApp Bill Worker
  const whatsappWorker = new Worker('whatsapp_bill_queue', whatsappProcessor, {
    connection: redisConnection,
    concurrency: Number(process.env.QUEUE_CONCURRENCY_WHATSAPP || 2)
  });
  whatsappWorker.on('error', (err) => logRedisError('QueueWhatsApp', err));

  whatsappWorker.on('completed', (job) => {
    console.log(`[Queue] Job completed: ${job.name} (${job.id})`);
  });

  whatsappWorker.on('failed', (job, err) => {
    console.error(`[Queue] Job failed: ${job?.name} (${job?.id}). Error:`, err);
  });

  console.log('[Queue] WhatsApp Worker connected.');

  // 2. Dashboard Stats Worker
  const dashboardWorker = new Worker('dashboard_stats_queue', dashboardProcessor as any, {
    connection: redisConnection,
    concurrency: Number(process.env.QUEUE_CONCURRENCY_DASHBOARD || 1)
  });
  dashboardWorker.on('error', (err) => logRedisError('QueueDashboard', err));

  dashboardWorker.on('completed', (job) => {
    console.log(`[Queue] Dashboard Job completed for shop: ${job.data.shopId}`);
  });

  dashboardWorker.on('failed', (job, err) => {
    console.error(`[Queue] Dashboard Job failed for shop: ${job?.data.shopId}. Error:`, err);
  });

  console.log('[Queue] Dashboard Worker connected.');

  // 3. AI Insights Worker
  const aiWorker = new Worker('ai_insights', aiInsightsProcessor as any, {
    connection: redisConnection,
    concurrency: Number(process.env.QUEUE_CONCURRENCY_AI || 1)
  });
  aiWorker.on('error', (err) => logRedisError('QueueAI', err));

  aiWorker.on('completed', (job) => {
    console.log(`[Queue] AI Insight completed for shop: ${job.data.shopId}`);
  });

  aiWorker.on('failed', (job, err) => {
    console.error(`[Queue] AI Insight failed for shop: ${job?.data?.shopId || 'unknown'}. Error:`, err);
  });

  console.log('[Queue] AI Insights Worker connected.');

  // 4. Analytics Aggregation Worker 📊
  const analyticsWorker = new Worker('analytics_aggregate_queue', analyticsAggregationProcessor as any, {
    connection: redisConnection,
    concurrency: 1
  });
  analyticsWorker.on('error', (err) => logRedisError('QueueAnalytics', err));

  // Schedule Cron Job (Runs every 1 hour)
  const analyticsQueue = new Queue('analytics_aggregate_queue', { 
    connection: redisConnection,
    defaultJobOptions: { removeOnComplete: true, attempts: 2 }
  });
  analyticsQueue.on('error', (err) => logRedisError('QueueAnalyticsObj', err));
  analyticsQueue.add('periodic_agg', {}, {
    repeat: { every: 3600000 } // Every 1 hour in ms ⏰
  }).catch(e => console.error('[Queue] Failed to schedule analytics cron:', e));

  console.log('[Queue] Analytics Aggregation Worker connected & scheduled.');

  // 5. Global Admin Precomputation Worker 👑
  const adminWorker = new Worker('admin_precompute_queue', adminAnalyticsProcessor as any, {
    connection: redisConnection,
    concurrency: 1
  });
  adminWorker.on('error', (err) => logRedisError('QueueAdminPrecompute', err));

  const adminQueue = new Queue('admin_precompute_queue', { 
    connection: redisConnection,
    defaultJobOptions: { removeOnComplete: true }
  });
  adminQueue.add('periodic_admin_precompute', {}, {
    repeat: { every: 60000 } // Every 1 minute ⏰
  }).catch(e => console.error('[Queue] Failed to schedule admin precompute:', e));

  console.log('[Queue] Global Admin Precomputation Worker connected & scheduled.');
};
