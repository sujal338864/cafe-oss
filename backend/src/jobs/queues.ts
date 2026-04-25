import { Queue } from 'bullmq';
import { redisConnection, DEFAULT_JOB_OPTIONS } from './config';

/**
 * Global Queues for central access
 * This file MUST NOT import processors or services.
 */

export const menuSyncQueue = new Queue('menu_sync_queue', { 
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS
});
