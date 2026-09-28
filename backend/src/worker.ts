import { config } from './config/env.js';
import { connectDB, prisma } from './config/db.js';
import { initElasticsearch } from './config/elasticsearch.js';
import { createEmailWorker } from './queues/emailWorker.js';
import { logger } from './utils/logger.js';

async function startWorker() {
  logger.info('=============================================');
  logger.info('   Starting ReachInbox Email Worker Process  ');
  logger.info(`   Concurrency: ${config.worker.concurrency} | Delay: ${config.worker.minSendDelayMs}ms`);
  logger.info(`   Hourly Limit: ${config.worker.maxEmailsPerHourPerSender} emails/hr`);
  logger.info('=============================================');

  await connectDB();
  await initElasticsearch();

  const worker = createEmailWorker();

  const shutdown = async () => {
    logger.info('Gracefully shutting down ReachInbox Email Worker...');
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker().catch((err) => {
  logger.error('Worker failed to start:', err);
  process.exit(1);
});
