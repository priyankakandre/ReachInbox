import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { connectDB, prisma } from './config/db.js';
import { initElasticsearch } from './config/elasticsearch.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/authRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import senderRoutes from './routes/senderRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import { queueRouter } from './routes/queueRoutes.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: [config.frontendUrl, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'reachinbox-scheduler-backend',
    timestamp: new Date().toISOString(),
    config: {
      concurrency: config.worker.concurrency,
      minSendDelayMs: config.worker.minSendDelayMs,
      maxEmailsPerHour: config.worker.maxEmailsPerHourPerSender,
    },
  });
});

// Bull-Board Queue Dashboard
app.use('/queues', queueRouter);

// API Routes
app.use('/auth', authRoutes);
app.use('/emails', emailRoutes);
app.use('/senders', senderRoutes);
app.use('/slack', slackRoutes);

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled server error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

async function bootstrap() {
  try {
    await connectDB();
    await initElasticsearch();

    const server = app.listen(config.port, () => {
      logger.info('====================================================');
      logger.info(`🚀 ReachInbox Scheduler API is listening on port ${config.port}`);
      logger.info(`📊 BullMQ Dashboard: http://localhost:${config.port}/queues`);
      logger.info(`🔗 Health Check: http://localhost:${config.port}/health`);
      logger.info('====================================================');
    });

    const shutdown = async () => {
      logger.info('Shutting down API server...');
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
