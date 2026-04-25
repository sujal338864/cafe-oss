import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config';
import { logger } from '../../lib/logger';
import { prisma } from '../../common/prisma';
import { EmailService } from '../../services/email.service';
import { EmailJobData } from '../queues/email.queue';

export const emailWorker = new Worker('EmailQueue', async (job: Job<EmailJobData>) => {
  logger.info(`[EMAIL WORKER] Processing Campaign ${job.data.campaignId} with ${job.data.recipients.length} recipients`);
  
  const { campaignId, shopName, subject, htmlContent, recipients } = job.data;
  let sentCount = 0;

  // Process serially or in small batches to respect SMTP limits
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    
    const personalizedHtml = htmlContent.replace('{{name}}', recipient.name || 'Customer');
    const success = await EmailService.sendEmail(recipient.email, subject, personalizedHtml, shopName);
    
    if (success) sentCount++;
    
    // Add artificial delay of 50ms between sends to prevent hitting rapid rate limits of SMTP
    await new Promise(res => setTimeout(res, 50));
  }

  // Once completely done, update Campaign status in DB!
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'COMPLETED',
      sentCount: { increment: sentCount }
    }
  }).catch(e => logger.error(`[EMAIL WORKER] Failed to update campaign ${campaignId} status: ${e.message}`));

  logger.info(`[EMAIL WORKER] Campaign ${campaignId} finished. Sent ${sentCount}/${recipients.length}`);

}, {
  connection: redisConnection,
  concurrency: 2 // Maximum 2 concurrent mass campaigns at once
});

emailWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error(`[EMAIL WORKER] Job ${job?.id} failed: ${err.message}`);
});
