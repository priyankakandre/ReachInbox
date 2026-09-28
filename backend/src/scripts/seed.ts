import { connectDB, prisma } from '../config/db.js';
import { getOrCreateDefaultTransporter } from '../services/smtpService.js';
import { logger } from '../utils/logger.js';

async function seed() {
  await connectDB();
  logger.info('Seeding database with demo user and Ethereal sender...');

  const demoEmail = 'reachinbox.lead@example.com';
  let user = await prisma.user.findUnique({ where: { email: demoEmail } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: 'google-oauth-demo-101',
        name: 'Mitrajit Demo',
        email: demoEmail,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
    });
    logger.info(`Created demo user: ${user.name} (${user.email})`);
  }

  const existingSender = await prisma.sender.findFirst({ where: { userId: user.id } });
  if (!existingSender) {
    const etherealSetup = await getOrCreateDefaultTransporter();
    const sender = await prisma.sender.create({
      data: {
        userId: user.id,
        name: 'ReachInbox Outreach (Ethereal)',
        emailAddress: etherealSetup.user,
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUsername: etherealSetup.user,
        encryptedSmtpPassword: etherealSetup.pass,
        hourlyLimit: 5, // default to 5 so rate-limiting is easily observable
      },
    });

    logger.info(`Created default sender: ${sender.emailAddress}`);
  }

  logger.info('Seed completed successfully!');
  await prisma.$disconnect();
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed error:', err);
  process.exit(1);
});
