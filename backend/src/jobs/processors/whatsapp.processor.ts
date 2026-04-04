import { Job } from 'bullmq';
import { sendWhatsAppBill } from '../../lib/whatsapp';

export const whatsappProcessor = async (job: Job) => {
  const { phone, billData, shopName, pointsEarned, currentLoyaltyPoints } = job.data;

  console.log(`[Queue] Processing WhatsApp bill for job ${job.id} to ${phone}`);

  try {
    await sendWhatsAppBill(
      phone,
      billData,
      shopName,
      pointsEarned,
      currentLoyaltyPoints
    );
    console.log(`[Queue] WhatsApp bill sent successfully for job ${job.id}`);
  } catch (error) {
    console.error(`[Queue] WhatsApp bill failed for job ${job.id}:`, error);
    throw error; // Let BullMQ handle retry failures
  }
};
