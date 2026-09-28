import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { prisma } from '../config/db.js';
import { config } from '../config/env.js';
import { getOrCreateDefaultTransporter } from '../services/smtpService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

function generateToken(user: { id: string; email: string }) {
  return jwt.sign({ id: user.id, email: user.email }, config.jwt.secret, {
    expiresIn: '7d',
  });
}

export async function demoLogin(req: Request, res: Response) {
  try {
    const demoEmail = 'reachinbox.lead@example.com';
    let user = await prisma.user.findUnique({
      where: { email: demoEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: 'demo-google-id-001',
          name: 'ReachInbox Demo User',
          email: demoEmail,
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
      });
    }

    // Ensure default sender exists
    const senderCount = await prisma.sender.count({
      where: { userId: user.id },
    });

    if (senderCount === 0) {
      const etherealSetup = await getOrCreateDefaultTransporter();
      await prisma.sender.create({
        data: {
          userId: user.id,
          name: 'Primary Ethereal Sender',
          emailAddress: etherealSetup.user,
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          smtpUsername: etherealSetup.user,
          encryptedSmtpPassword: etherealSetup.pass,
          hourlyLimit: config.worker.maxEmailsPerHourPerSender,
        },
      });
    }


    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // local dev
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    logger.error('Demo login error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getGoogleAuthUrl(req: Request, res: Response) {
  if (!config.google.clientId) {
    return res.status(400).json({
      success: false,
      error: 'Google Client ID is not configured. Please use Demo Login or set GOOGLE_CLIENT_ID.',
    });
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: config.google.callbackUrl,
    client_id: config.google.clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const qs = new URLSearchParams(options);
  return res.json({ success: true, url: `${rootUrl}?${qs.toString()}` });
}

export async function googleCallback(req: Request, res: Response) {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${config.frontendUrl}/login?error=no_code`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.callbackUrl,
        grant_type: 'authorization_code',
      },
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    // Fetch user profile from Google
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const googleUser = profileResponse.data;

    let user = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: googleUser.id,
          name: googleUser.name,
          email: googleUser.email,
          avatarUrl: googleUser.picture,
        },
      });

      // Create default Ethereal sender for this new user
      const etherealSetup = await getOrCreateDefaultTransporter();
      await prisma.sender.create({
        data: {
          userId: user.id,
          name: `${user.name} Outreach`,
          emailAddress: etherealSetup.user,
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          smtpUsername: etherealSetup.user,
          encryptedSmtpPassword: 'auto_generated_ethereal',
          hourlyLimit: config.worker.maxEmailsPerHourPerSender,
        },
      });
    }

    const token = generateToken(user);
    res.cookie('token', token, { maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.redirect(`${config.frontendUrl}/?token=${token}`);
  } catch (error: any) {
    logger.error('Google OAuth callback error:', error.message);
    return res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      senders: true,
      slackConnection: {
        select: { id: true, channelName: true, webhookUrl: true, createdAt: true },
      },
    },
  });

  return res.json({ success: true, user });
}

export function logout(req: Request, res: Response) {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully' });
}
