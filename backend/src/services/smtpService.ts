import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let defaultTransporter: Transporter | null = null;
let defaultAccount: { user: string; pass: string } | null = null;

export async function getOrCreateDefaultTransporter(): Promise<{ transporter: Transporter; user: string; pass: string }> {
  if (defaultTransporter && defaultAccount) {
    return { transporter: defaultTransporter, user: defaultAccount.user, pass: defaultAccount.pass };
  }

  if (config.ethereal.user && config.ethereal.pass) {
    defaultAccount = { user: config.ethereal.user, pass: config.ethereal.pass };
    defaultTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: defaultAccount.user,
        pass: defaultAccount.pass,
      },
    });
    logger.info(`Using configured Ethereal SMTP account: ${defaultAccount.user}`);
    return { transporter: defaultTransporter, user: defaultAccount.user, pass: defaultAccount.pass };
  }

  logger.info('No Ethereal credentials found in env. Creating a dynamic Ethereal test account...');
  const testAccount = await nodemailer.createTestAccount();
  defaultAccount = { user: testAccount.user, pass: testAccount.pass };
  defaultTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  logger.info(`Created new Ethereal test account: ${testAccount.user}`);
  return { transporter: defaultTransporter, user: defaultAccount.user, pass: defaultAccount.pass };
}


export function createSenderTransporter(sender: {
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername: string;
  encryptedSmtpPassword?: string;
}): Transporter {
  return nodemailer.createTransport({
    host: sender.smtpHost || 'smtp.ethereal.email',
    port: sender.smtpPort || 587,
    secure: false,
    auth: {
      user: sender.smtpUsername,
      pass: sender.encryptedSmtpPassword || '',
    },
  });
}

export async function sendEmailViaSMTP(params: {
  from?: string;
  to: string;
  subject: string;
  body: string;
  sender?: {
    emailAddress: string;
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    encryptedSmtpPassword: string;
  };
}): Promise<{ messageId: string; previewUrl: string | null }> {
  let transporter: Transporter;
  let fromAddress: string;

  const defaultSetup = await getOrCreateDefaultTransporter();

  if (
    params.sender &&
    params.sender.smtpUsername &&
    params.sender.encryptedSmtpPassword &&
    params.sender.encryptedSmtpPassword !== 'auto_generated_ethereal'
  ) {
    transporter = createSenderTransporter(params.sender);
    fromAddress = `"${params.sender.emailAddress}" <${params.sender.emailAddress}>`;
  } else {
    transporter = defaultSetup.transporter;
    fromAddress = params.from || `"${params.sender?.emailAddress || 'ReachInbox Outreach'}" <${defaultSetup.user}>`;
  }


  const info = await transporter.sendMail({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
      <h2 style="color: #6366f1;">${params.subject}</h2>
      <div style="margin-top: 15px; white-space: pre-wrap;">${params.body}</div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin-top: 30px;" />
      <p style="font-size: 12px; color: #9ca3af;">Sent via ReachInbox Email Scheduler &middot; Ethereal SMTP Testing</p>
    </div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  return {
    messageId: info.messageId,
    previewUrl,
  };
}
