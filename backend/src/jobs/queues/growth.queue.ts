import { Queue } from 'bullmq';
import { redisConnection, DEFAULT_JOB_OPTIONS } from '../config';

export const growthReportQueue = new Queue('weekly_growth_report_queue', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS
});

/**
 * Schedule the Weekly Growth Report for Monday at 9 AM
 */
export const scheduleWeeklyGrowthReport = async () => {
  // Remove existing repeatable jobs to avoid duplicates on restart
  const repeatableJobs = await growthReportQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await growthReportQueue.removeRepeatableByKey(job.key);
  }

  // Monday 9:00 AM Indian Standard Time (approx UTC 3:30 AM)
  await growthReportQueue.add('weekly_dispatch', {}, {
    repeat: { pattern: '0 9 * * 1' } 
  });
};
