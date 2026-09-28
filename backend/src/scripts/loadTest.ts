import { connectDB, prisma } from '../config/db.js';
import { EmailService } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

async function run() {
  await connectDB();
  logger.info('Starting 1000+ Email Load Test...');

  // Find or create test user and sender
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Load Test User',
        email: 'loadtest@example.com',
      },
    });
  }

  let sender = await prisma.sender.findFirst({ where: { userId: user.id } });
  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        userId: user.id,
        name: 'Benchmark Sender',
        emailAddress: 'benchmark@ethereal.email',
        smtpUsername: 'benchmark@ethereal.email',
        encryptedSmtpPassword: 'pass',
        hourlyLimit: 10,
      },
    });
  }

  const TOTAL_JOBS = 1000;
  const mockRecipients = [];
  for (let i = 1; i <= TOTAL_JOBS; i++) {
    mockRecipients.push(`candidate_${i}@reachinbox-loadtest.com`);
  }

  logger.info(`Enqueuing ${TOTAL_JOBS} delayed jobs into BullMQ with MySQL persistence...`);
  const startTime = Date.now();

  const result = await EmailService.scheduleEmails({
    userId: user.id,
    senderId: sender.id,
    subject: 'High Volume Scalability Test',
    body: 'Verifying BullMQ Redis persistence and atomic rate limiting under 1000+ jobs load.',
    recipients: mockRecipients,
    delaySeconds: 1,
    hourlyLimit: sender.hourlyLimit,
  });

  const duration = (Date.now() - startTime) / 1000;
  logger.info(`Successfully scheduled ${result.scheduledCount} jobs in ${duration.toFixed(2)}s!`);
  logger.info(`First job scheduled at: ${result.firstRunAt}`);
  logger.info(`Last job scheduled at: ${result.lastRunAt}`);

  await prisma.$disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error('Load test script failed:', err);
  process.exit(1);
});
