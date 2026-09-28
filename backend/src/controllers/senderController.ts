import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { prisma } from '../config/db.js';
import { config } from '../config/env.js';
import { RateLimiterService } from '../services/rateLimiterService.js';
import { getOrCreateDefaultTransporter } from '../services/smtpService.js';
import { logger } from '../utils/logger.js';

export async function getSenders(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    let senders = await prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    // If user has no senders, auto-provision the default Ethereal sender
    if (senders.length === 0) {
      const etherealSetup = await getOrCreateDefaultTransporter();
      const defaultSender = await prisma.sender.create({
        data: {
          userId,
          name: 'Primary Ethereal Sender',
          emailAddress: etherealSetup.user,
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          smtpUsername: etherealSetup.user,
          encryptedSmtpPassword: 'auto_generated_ethereal',
          hourlyLimit: config.worker.maxEmailsPerHourPerSender,
        },
      });
      senders = [defaultSender];
    }

    // Attach real-time rate limit stats for each sender
    const sendersWithStats = await Promise.all(
      senders.map(async (s) => {
        const stats = await RateLimiterService.getSenderRateLimitStatus(s.id, s.hourlyLimit);
        return {
          id: s.id,
          name: s.name,
          emailAddress: s.emailAddress,
          smtpHost: s.smtpHost,
          smtpPort: s.smtpPort,
          hourlyLimit: s.hourlyLimit,
          sentThisHour: stats.count,
          remainingThisHour: stats.remaining,
        };
      })
    );

    return res.json({ success: true, senders: sendersWithStats });
  } catch (error: any) {
    logger.error('Error in getSenders:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function createSender(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { name, emailAddress, smtpHost, smtpPort, smtpUsername, smtpPassword, hourlyLimit } = req.body;

    if (!emailAddress || !name) {
      return res.status(400).json({ success: false, error: 'Name and emailAddress are required' });
    }

    const sender = await prisma.sender.create({
      data: {
        userId,
        name,
        emailAddress,
        smtpHost: smtpHost || 'smtp.ethereal.email',
        smtpPort: smtpPort ? parseInt(smtpPort, 10) : 587,
        smtpUsername: smtpUsername || emailAddress,
        encryptedSmtpPassword: smtpPassword || 'default_pass',
        hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : config.worker.maxEmailsPerHourPerSender,
      },
    });

    return res.status(201).json({ success: true, sender });
  } catch (error: any) {
    logger.error('Error in createSender:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
