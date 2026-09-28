import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { EmailService } from '../services/emailService.js';
import { SearchService } from '../services/searchService.js';
import { RateLimiterService } from '../services/rateLimiterService.js';
import { parseLeads } from '../utils/csvParser.js';
import { EmailStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

const scheduleSchema = z.object({
  senderId: z.string().min(1, 'Sender ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email()).optional(),
  leadsRaw: z.string().optional(),
  startTime: z.string().optional(),
  delaySeconds: z.number().min(0).default(2),
  hourlyLimit: z.number().min(1).optional(),
});

export async function scheduleEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const bodyData = scheduleSchema.parse(req.body);

    let recipients: string[] = [];

    if (bodyData.recipients && bodyData.recipients.length > 0) {
      recipients = Array.from(new Set(bodyData.recipients.map((r) => r.toLowerCase().trim())));
    } else if (bodyData.leadsRaw) {
      recipients = parseLeads(bodyData.leadsRaw);
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid recipient email addresses provided.',
      });
    }

    const result = await EmailService.scheduleEmails({
      userId,
      senderId: bodyData.senderId,
      subject: bodyData.subject,
      body: bodyData.body,
      recipients,
      startTime: bodyData.startTime,
      delaySeconds: bodyData.delaySeconds,
      hourlyLimit: bodyData.hourlyLimit,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully scheduled ${result.scheduledCount} emails`,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error in scheduleEmails:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const statusQuery = req.query.status as string;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);

    let statusEnum: EmailStatus | undefined;
    if (statusQuery) {
      const upper = statusQuery.toUpperCase();
      if (upper === 'SCHEDULED') statusEnum = EmailStatus.SCHEDULED;
      else if (upper === 'SENT') statusEnum = EmailStatus.SENT;
      else if (upper === 'FAILED') statusEnum = EmailStatus.FAILED;
      else if (upper === 'SENDING') statusEnum = EmailStatus.SENDING;
    }

    const result = await EmailService.getEmails({
      userId,
      status: statusEnum,
      page,
      limit,
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error in getEmails:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEmailStats(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const stats = await EmailService.getEmailStats(userId);
    return res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Error in getEmailStats:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function searchEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const q = (req.query.q as string) || '';
    const status = (req.query.status as string) || undefined;

    const results = await SearchService.searchEmails({
      userId,
      query: q,
      status: status ? status.toUpperCase() : undefined,
    });

    return res.json({ success: true, data: results, count: results.length });
  } catch (error: any) {
    logger.error('Error in searchEmails:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function reindexEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const count = await SearchService.reindexAll();
    return res.json({ success: true, message: `Reindexed ${count} emails in Elasticsearch.` });
  } catch (error: any) {
    logger.error('Error in reindexEmails:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function resetRateLimit(req: AuthenticatedRequest, res: Response) {
  try {
    const senderId = req.body.senderId;
    if (!senderId) {
      return res.status(400).json({ success: false, error: 'senderId is required' });
    }
    await RateLimiterService.resetRateLimit(senderId);
    return res.json({ success: true, message: `Rate limit reset for sender ${senderId}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function loadTestSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const sender = await prisma.sender.findFirst({ where: { userId } });
    if (!sender) {
      return res.status(400).json({ success: false, error: 'No sender found for user.' });
    }

    const count = parseInt(req.body.count || '1000', 10);
    const mockRecipients = [];
    for (let i = 1; i <= count; i++) {
      mockRecipients.push(`loadtest_user_${i}@example.com`);
    }

    logger.info(`[LoadTest] Enqueuing ${count} simulated email jobs for testing rate limits & queue persistence...`);

    const result = await EmailService.scheduleEmails({
      userId,
      senderId: sender.id,
      subject: `High Load Benchmark Email`,
      body: `Testing system under load of ${count} emails.`,
      recipients: mockRecipients,
      delaySeconds: 1,
      hourlyLimit: sender.hourlyLimit,
    });

    return res.status(201).json({
      success: true,
      message: `Enqueued ${count} jobs into BullMQ. Inspect the live queue at /queues`,
      data: {
        totalEnqueued: result.scheduledCount,
        firstRunAt: result.firstRunAt,
        lastRunAt: result.lastRunAt,
      },
    });
  } catch (error: any) {
    logger.error('Load test error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
