import { Queue } from 'bullmq';
import { redisConnection } from '../config';

/**
 * Define the WhatsApp background queue
 */
export const whatsappQueue = new Queue('whatsapp_bill_queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 5000 // Wait 5s before making second attempt
    },
    removeOnComplete: true, // Auto-cleanup completed jobs to save Redis memory
    removeOnFail: false    // Keep failed jobs for manual review dashboard triggers
  }
});

/**
 * Add job to WhatsApp Queue
 */
export const addWhatsAppJob = async (data: {
  phone: string;
  billData: any;
  shopName: string;
  pointsEarned?: number;
  currentLoyaltyPoints?: number;
}) => {
  return whatsappQueue.add('send_whatsapp_bill', data);
};
