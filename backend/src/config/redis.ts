import { Redis, RedisOptions } from 'ioredis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

export const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  logger.info(`Connected to Redis at ${config.redis.host}:${config.redis.port}`);
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

export function createRedisConnection(): Redis {
  return new Redis(redisOptions);
}
