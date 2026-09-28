import { Response } from 'express';
import axios from 'axios';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { prisma } from '../config/db.js';
import { config } from '../config/env.js';
import { sendSlackMessage } from '../services/slackService.js';
import { logger } from '../utils/logger.js';

export async function getSlackStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: {
        id: true,
        channelName: true,
        channelId: true,
        workspaceId: true,
        webhookUrl: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      connected: !!connection,
      connection: connection
        ? {
            channelName: connection.channelName || 'Webhook Channel',
            connectedAt: connection.createdAt,
            hasWebhook: !!connection.webhookUrl,
          }
        : null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function setSlackWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { webhookUrl, channelName } = req.body;

    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid Slack Incoming Webhook URL (starts with https://hooks.slack.com/).',
      });
    }

    const connection = await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        webhookUrl,
        channelName: channelName || '#general',
      },
      create: {
        userId,
        webhookUrl,
        channelName: channelName || '#general',
      },
    });

    // Send a live test message to confirm connection
    await sendSlackMessage({
      userId,
      text: '🎉 *ReachInbox Connected!* Your Slack channel is now linked to receive real-time rate limit alerts.',
    });

    return res.json({
      success: true,
      message: 'Slack connection verified and saved successfully!',
      connection,
    });
  } catch (error: any) {
    logger.error('Error in setSlackWebhook:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function connectSlackOAuth(req: AuthenticatedRequest, res: Response) {
  if (!config.slack.clientId) {
    return res.status(400).json({
      success: false,
      error: 'Slack Client ID is not configured in .env. Please connect via Incoming Webhook URL instead.',
    });
  }

  const scopes = 'chat:write,incoming-webhook';
  const url = `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(
    config.slack.callbackUrl
  )}&state=${req.user!.id}`;

  return res.json({ success: true, url });
}

export async function slackOAuthCallback(req: AuthenticatedRequest, res: Response) {
  const code = req.query.code as string;
  const stateUserId = req.query.state as string;

  if (!code || !stateUserId) {
    return res.redirect(`${config.frontendUrl}/?slack_error=missing_params`);
  }

  try {
    const tokenResponse = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        code,
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        redirect_uri: config.slack.callbackUrl,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const data = tokenResponse.data;
    if (!data.ok) {
      logger.error('Slack OAuth exchange failed:', data.error);
      return res.redirect(`${config.frontendUrl}/?slack_error=${data.error}`);
    }

    const botToken = data.access_token;
    const workspaceId = data.team?.id;
    const channelId = data.incoming_webhook?.channel_id;
    const channelName = data.incoming_webhook?.channel;
    const webhookUrl = data.incoming_webhook?.url;

    await prisma.slackConnection.upsert({
      where: { userId: stateUserId },
      update: {
        workspaceId,
        channelId,
        channelName,
        webhookUrl,
        encryptedBotToken: botToken,
      },
      create: {
        userId: stateUserId,
        workspaceId,
        channelId,
        channelName,
        webhookUrl,
        encryptedBotToken: botToken,
      },
    });

    // Send confirmation
    await sendSlackMessage({
      userId: stateUserId,
      text: '🚀 *Slack Connected!* ReachInbox will notify this channel when hourly sender limits are exceeded.',
    });

    return res.redirect(`${config.frontendUrl}/?slack=connected`);
  } catch (error: any) {
    logger.error('Slack callback exception:', error);
    return res.redirect(`${config.frontendUrl}/?slack_error=oauth_failed`);
  }
}

export async function testSlackNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const sent = await sendSlackMessage({
      userId,
      text: `🧪 *ReachInbox Test Notification*: This is a live test notification verifying your Slack integration!`,
    });

    if (!sent) {
      return res.status(400).json({
        success: false,
        error: 'Unable to send Slack notification. Please check if Slack is connected.',
      });
    }

    return res.json({ success: true, message: 'Live test notification sent to Slack successfully!' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function disconnectSlack(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.id;
    await prisma.slackConnection.deleteMany({
      where: { userId },
    });

    return res.json({ success: true, message: 'Slack disconnected successfully.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
