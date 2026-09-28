import { connectDB, prisma } from '../config/db.js';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

async function fix() {
  await connectDB();
  const testAccount = await nodemailer.createTestAccount();
  logger.info(`Generated verified Ethereal account: ${testAccount.user}`);

  await prisma.sender.updateMany({
    data: {
      emailAddress: testAccount.user,
      smtpUsername: testAccount.user,
      encryptedSmtpPassword: testAccount.pass,
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
    },
  });

  logger.info('Updated all senders with working Ethereal credentials.');
  await prisma.$disconnect();
}

fix();
