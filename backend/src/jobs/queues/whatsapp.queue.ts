import { Queue } from 'bullmq';
import { redisConnection, DEFAULT_JOB_OPTIONS } from '../config';

/**
 * Define the WhatsApp background queue
 */
export const whatsappQueue = new Queue('whatsapp_bill_queue', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS
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
