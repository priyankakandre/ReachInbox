import { Queue, QueueEvents } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours for monitoring
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
    },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`[Queue] Job ${jobId} completed successfully.`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`[Queue] Job ${jobId} failed: ${failedReason}`);
});

export async function addEmailJob(
  emailId: string,
  delayMs: number,
  metadata?: Record<string, any>
) {
  // Using emailId as BullMQ jobId ensures idempotency
  return await emailQueue.add(
    'send-email',
    { emailId, ...metadata },
    {
      jobId: emailId,
      delay: Math.max(0, delayMs),
    }
  );
}
