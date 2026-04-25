import { Worker, Queue } from 'bullmq';
import { redisConnection, DEFAULT_JOB_OPTIONS } from './config';
import { whatsappProcessor } from './processors/whatsapp.processor';
import { dashboardProcessor } from './processors/dashboard.processor';
import { aiInsightsProcessor } from './processors/ai.processor';
import { analyticsAggregationProcessor } from './processors/analytics.processor';
import { adminAnalyticsProcessor } from './processors/adminAnalytics.processor';
import { logRedisError } from '../lib/redis';
import { emailWorker } from './workers/email.worker';
import { scheduleDailyMarketingBrain } from './queues/marketing.queue';
import { marketingBrainWorker } from './workers/marketing.worker';

import { menuSyncQueue } from './queues';
import { menuSyncProcessor } from './processors/menuSync.processor';

/**
 * Initialize all Background Workers on server boot
 */
export const startWorkers = () => {

  console.log('[Queue] Starting Background Workers...');

  // 1. WhatsApp Bill Worker
  const whatsappWorker = new Worker('whatsapp_bill_queue', whatsappProcessor, {
    connection: redisConnection,
    concurrency: 1 
  });
  whatsappWorker.on('error', (err) => logRedisError('QueueWhatsApp', err));

  // 2. Dashboard Stats Worker
  const dashboardWorker = new Worker('dashboard_stats_queue', dashboardProcessor as any, {
    connection: redisConnection,
    concurrency: 1
  });
  dashboardWorker.on('error', (err) => logRedisError('QueueDashboard', err));

  // 3. AI Insights Worker
  const aiWorker = new Worker('ai_insights', aiInsightsProcessor as any, {
    connection: redisConnection,
    concurrency: 1
  });
  aiWorker.on('error', (err) => logRedisError('QueueAI', err));

  // 4. Analytics Aggregation Worker 📊
  const analyticsWorker = new Worker('analytics_aggregate_queue', analyticsAggregationProcessor as any, {
    connection: redisConnection,
    concurrency: 1
  });
  analyticsWorker.on('error', (err) => logRedisError('QueueAnalytics', err));

  const analyticsQueue = new Queue('analytics_aggregate_queue', { 
    connection: redisConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS
  });
  analyticsQueue.add('periodic_agg', {}, {
    repeat: { every: 7200000 } 
  }).catch(e => console.error('[Queue] Failed to schedule analytics cron:', e));

  // 5. Global Admin Precomputation Worker 👑
  const adminWorker = new Worker('admin_precompute_queue', adminAnalyticsProcessor as any, {
    connection: redisConnection,
    concurrency: 1
  });
  adminWorker.on('error', (err) => logRedisError('QueueAdminPrecompute', err));

  const adminQueue = new Queue('admin_precompute_queue', { 
    connection: redisConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS
  });
  adminQueue.add('periodic_admin_precompute', {}, {
    repeat: { every: 900000 } 
  }).catch(e => console.error('[Queue] Failed to schedule admin precompute:', e));

  // 6. Menu Template Sync Worker 🔄
  const menuSyncWorker = new Worker('menu_sync_queue', menuSyncProcessor as any, {
    connection: redisConnection,
    concurrency: 1
  });
  menuSyncWorker.on('error', (err) => logRedisError('MenuSync', err));
  console.log('[Queue] Menu Sync Worker connected.');

  // 7. Email Campaign Worker 📧
  console.log('[Queue] Email Campaign Worker connected.');

  // 8. Auto Marketing Brain (AI Cron) 🧠
  scheduleDailyMarketingBrain().catch(e => console.error('[Queue] Failed to schedule AI Brain:', e));
  marketingBrainWorker.on('error', (err) => logRedisError('MarketingBrain', err));
  console.log('[Queue] Marketing Brain Worker connected & cron scheduled.');

  // 9. Weekly Growth Reports 📈
  const { weeklyGrowthReportProcessor } = require('./processors/weeklyGrowthReport.processor');
  const { scheduleWeeklyGrowthReport } = require('./queues/growth.queue');
  
  const growthReportWorker = new Worker('weekly_growth_report_queue', weeklyGrowthReportProcessor, {
    connection: redisConnection,
    concurrency: 1
  });
  growthReportWorker.on('error', (err) => logRedisError('QueueGrowthReport', err));
  
  scheduleWeeklyGrowthReport().catch(e => console.error('[Queue] Failed to schedule Weekly Report:', e));
  console.log('[Queue] Weekly Growth Report Worker connected & cron scheduled.');
};

