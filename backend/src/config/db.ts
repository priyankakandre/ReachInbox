import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB() {
  try {
    await prisma.$connect();
    logger.info('Connected to MySQL Database via Prisma');
  } catch (error) {
    logger.error('Failed to connect to MySQL database:', error);
    throw error;
  }
}
