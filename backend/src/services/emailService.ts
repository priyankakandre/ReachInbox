import { prisma } from '../config/db.js';
import { addEmailJob } from '../queues/emailQueue.js';
import { SearchService } from './searchService.js';
import { logger } from '../utils/logger.js';
import { EmailStatus } from '@prisma/client';

export interface ScheduleEmailsInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string | Date;
  delaySeconds?: number;
  hourlyLimit?: number;
}

export class EmailService {
  /**
   * Schedules a batch of emails using BullMQ delayed jobs
   */
  public static async scheduleEmails(input: ScheduleEmailsInput) {
    const { userId, senderId, subject, body, recipients } = input;
    const delaySeconds = Math.max(0, input.delaySeconds ?? 2);
    const startMs = input.startTime ? new Date(input.startTime).getTime() : Date.now();
    const nowMs = Date.now();

    // Verify sender belongs to user or is available
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      throw new Error(`Sender not found with ID ${senderId}`);
    }

    if (input.hourlyLimit && input.hourlyLimit > 0) {
      // update sender hourly limit if customized
      await prisma.sender.update({
        where: { id: senderId },
        data: { hourlyLimit: input.hourlyLimit },
      });
    }

    const createdEmails = [];
    const jobs = [];

    // Calculate due times and insert records
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      // Formula: start time + (recipient position × delay)
      const scheduledMs = Math.max(startMs + i * delaySeconds * 1000, nowMs);
      const scheduledAt = new Date(scheduledMs);
      const delayMs = Math.max(0, scheduledMs - nowMs);

      // Create MySQL record
      const email = await prisma.email.create({
        data: {
          userId,
          senderId,
          recipient,
          subject,
          body,
          status: EmailStatus.SCHEDULED,
          scheduledAt,
        },
      });

      // Index in Elasticsearch
      await SearchService.indexEmail(email);

      // Create BullMQ delayed job with exact email.id as jobId
      const job = await addEmailJob(email.id, delayMs, {
        userId,
        senderId,
        recipient,
        index: i,
      });

      createdEmails.push(email);
      jobs.push(job);
    }

    logger.info(
      `[EmailService] Scheduled ${createdEmails.length} emails for sender '${sender.emailAddress}'. Delay between emails: ${delaySeconds}s`
    );

    return {
      scheduledCount: createdEmails.length,
      firstRunAt: createdEmails[0]?.scheduledAt,
      lastRunAt: createdEmails[createdEmails.length - 1]?.scheduledAt,
      emails: createdEmails,
    };
  }

  /**
   * Retrieves paginated emails with status filtering
   */
  public static async getEmails(params: {
    userId: string;
    status?: EmailStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId: params.userId };
    if (params.status) {
      where.status = params.status;
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          sender: {
            select: { id: true, name: true, emailAddress: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      emails,
    };
  }

  /**
   * Get email dashboard stats
   */
  public static async getEmailStats(userId: string) {
    const [scheduledCount, sentCount, failedCount, sendingCount, totalSenders] = await Promise.all([
      prisma.email.count({ where: { userId, status: EmailStatus.SCHEDULED } }),
      prisma.email.count({ where: { userId, status: EmailStatus.SENT } }),
      prisma.email.count({ where: { userId, status: EmailStatus.FAILED } }),
      prisma.email.count({ where: { userId, status: EmailStatus.SENDING } }),
      prisma.sender.count({ where: { userId } }),
    ]);

    return {
      scheduled: scheduledCount,
      sent: sentCount,
      failed: failedCount,
      sending: sendingCount,
      total: scheduledCount + sentCount + failedCount + sendingCount,
      totalSenders,
    };
  }
}
