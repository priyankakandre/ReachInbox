import { Worker, Job, DelayedError } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { config } from '../config/env.js';
import { prisma } from '../config/db.js';
import { RateLimiterService } from '../services/rateLimiterService.js';
import { sendEmailViaSMTP } from '../services/smtpService.js';
import { SearchService } from '../services/searchService.js';
import { logger } from '../utils/logger.js';
import { EMAIL_QUEUE_NAME } from './emailQueue.js';

export function createEmailWorker(): Worker {
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job: Job, token?: string) => {
      const emailId = job.data.emailId || job.id;
      logger.info(`[Worker] Processing email job ${job.id} (Email ID: ${emailId})`);

      // 1. Fetch email record from MySQL
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: { sender: true, user: true },
      });

      if (!email) {
        logger.warn(`[Worker] Email ${emailId} not found in database. Skipping.`);
        return;
      }

      // 2. Idempotency Check: Don't resend if already sent
      if (email.status === 'SENT') {
        logger.info(`[Worker] Email ${emailId} is already marked as SENT. Skipping send.`);
        return;
      }

      const sender = email.sender;
      const hourlyLimit = sender.hourlyLimit || config.worker.maxEmailsPerHourPerSender;

      // 3. Hourly Rate Limit Check (Redis-backed counter)
      const rateCheck = await RateLimiterService.checkAndConsumeRateLimit(
        sender.id,
        email.userId,
        sender.emailAddress,
        hourlyLimit
      );

      if (!rateCheck.allowed) {
        const retryAfterMs = rateCheck.retryAfterMs || 60000;
        const nextWindow = rateCheck.nextAvailableWindow || new Date(Date.now() + retryAfterMs);

        logger.warn(
          `[Worker] Sender '${sender.emailAddress}' hit rate limit (${rateCheck.currentCount}/${hourlyLimit}). Rescheduling job ${job.id} for ${nextWindow.toISOString()}`
        );

        // Update database scheduled time and keep as SCHEDULED
        await prisma.email.update({
          where: { id: emailId },
          data: {
            scheduledAt: nextWindow,
            status: 'SCHEDULED',
          },
        });

        await SearchService.updateEmailStatus(emailId, 'SCHEDULED');

        // Delay job in BullMQ to the next hour window
        if (token) {
          await job.moveToDelayed(Date.now() + retryAfterMs, token);
          throw new DelayedError();
        }
        return;
      }


      // 4. Mark status as SENDING
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'SENDING' },
      });

      // 5. Minimum delay between individual email sends (provider throttling mimic)
      const delayMs = config.worker.minSendDelayMs;
      if (delayMs > 0) {
        logger.debug(`[Worker] Applying provider throttling delay of ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // 6. Send email via SMTP (Ethereal Email)
      try {
        const sendResult = await sendEmailViaSMTP({
          to: email.recipient,
          subject: email.subject,
          body: email.body,
          sender: {
            emailAddress: sender.emailAddress,
            smtpHost: sender.smtpHost,
            smtpPort: sender.smtpPort,
            smtpUsername: sender.smtpUsername,
            encryptedSmtpPassword: sender.encryptedSmtpPassword,
          },
        });

        const sentAt = new Date();

        // 7. Update MySQL to SENT
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            previewUrl: sendResult.previewUrl,
            error: null,
          },
        });

        // 8. Update Elasticsearch
        await SearchService.updateEmailStatus(emailId, 'SENT', sentAt, sendResult.previewUrl);

        logger.info(
          `[Worker] Email ${emailId} successfully sent to ${email.recipient}! Preview: ${sendResult.previewUrl || 'N/A'}`
        );
      } catch (sendError: any) {
        logger.error(`[Worker] Failed to send email ${emailId}:`, sendError.message);

        // Update MySQL to FAILED
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            error: sendError.message,
          },
        });

        await SearchService.updateEmailStatus(emailId, 'FAILED');
        throw sendError;
      }
    },
    {
      connection: redisOptions,
      concurrency: config.worker.concurrency,
    }
  );

  worker.on('ready', () => {
    logger.info(`[Worker] Email Worker is ready with concurrency=${config.worker.concurrency}`);
  });

  worker.on('error', (err) => {
    logger.error('[Worker] Email Worker error:', err.message);
  });

  return worker;
}
