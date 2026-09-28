import axios from 'axios';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

export interface SlackRateLimitAlertData {
  userId: string;
  senderEmail: string;
  senderId: string;
  limit: number;
  currentCount: number;
  nextAvailableWindow: Date;
}

export async function sendSlackMessage(params: {
  userId: string;
  text: string;
  blocks?: any[];
}): Promise<boolean> {
  try {
    const slackConn = await prisma.slackConnection.findUnique({
      where: { userId: params.userId },
    });

    if (!slackConn) {
      logger.info(`[Slack] No Slack connection configured for user ${params.userId}. Skipping notification.`);
      return false;
    }

    // 1. If webhookUrl is available, send via incoming webhook
    if (slackConn.webhookUrl) {
      await axios.post(slackConn.webhookUrl, {
        text: params.text,
        blocks: params.blocks,
      });
      logger.info(`[Slack] Live alert sent via Webhook to user ${params.userId}`);
      return true;
    }

    // 2. If bot token is available, send via Slack chat.postMessage API
    if (slackConn.encryptedBotToken && slackConn.channelId) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: slackConn.channelId,
          text: params.text,
          blocks: params.blocks,
        },
        {
          headers: {
            Authorization: `Bearer ${slackConn.encryptedBotToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      logger.info(`[Slack] Live alert sent via Slack Web API to channel ${slackConn.channelId}`);
      return true;
    }

    logger.warn(`[Slack] Connection exists for user ${params.userId} but missing both webhookUrl and token.`);
    return false;
  } catch (error: any) {
    const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    logger.error(`[Slack] Failed to send Slack notification for user ${params.userId}:`, msg);
    return false;
  }
}

export async function notifyRateLimitHit(data: SlackRateLimitAlertData): Promise<boolean> {
  const alertText = `🚨 *ReachInbox Rate Limit Alert*: Sender \`${data.senderEmail}\` reached its hourly limit of ${data.limit} emails.`;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚠️ ReachInbox: Hourly Rate Limit Exceeded',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Sender:*\n${data.senderEmail}`,
        },
        {
          type: 'mrkdwn',
          text: `*Hourly Limit:*\n${data.limit} emails / hour`,
        },
        {
          type: 'mrkdwn',
          text: `*Attempts:* \n${data.currentCount} attempts in current window`,
        },
        {
          type: 'mrkdwn',
          text: `*Next Send Window:*\n${data.nextAvailableWindow.toUTCString()}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🛡️ *Idempotent Scheduler Action:* Remaining emails have been delayed to the next window. No jobs were dropped.',
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  return sendSlackMessage({
    userId: data.userId,
    text: alertText,
    blocks,
  });
}
