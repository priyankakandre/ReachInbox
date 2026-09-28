import { redisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { notifyRateLimitHit } from './slackService.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterMs?: number;
  nextAvailableWindow?: Date;
}

export class RateLimiterService {
  /**
   * Returns the current hourly window string, e.g. "2026-09-28-16"
   */
  public static getHourWindowKey(timestampMs: number = Date.now()): string {
    const d = new Date(timestampMs);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hour = String(d.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
  }

  /**
   * Calculates the exact millisecond timestamp when the next hourly window starts.
   */
  public static getNextHourStartMs(timestampMs: number = Date.now()): number {
    const d = new Date(timestampMs);
    d.setUTCMinutes(0, 0, 0);
    return d.getTime() + 60 * 60 * 1000;
  }

  /**
   * Atomically checks and consumes a send quota for the given sender in the current hour.
   * If limit is reached, returns allowed: false, plus retryAfterMs.
   */
  public static async checkAndConsumeRateLimit(
    senderId: string,
    userId: string,
    senderEmail: string,
    limit: number
  ): Promise<RateLimitCheckResult> {
    const windowKey = this.getHourWindowKey();
    const redisKey = `ratelimit:sender:${senderId}:${windowKey}`;
    const notificationKey = `ratelimit:notified:${senderId}:${windowKey}`;

    // Lua script to check and increment atomically
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return {0, tonumber(current)}
      else
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], 7200) -- expire in 2 hours
        end
        return {1, count}
      end
    `;

    try {
      const result = (await redisClient.eval(luaScript, 1, redisKey, limit)) as [number, number];
      const allowed = result[0] === 1;
      const currentCount = result[1];

      if (!allowed) {
        const nextHourMs = this.getNextHourStartMs();
        const retryAfterMs = Math.max(nextHourMs - Date.now() + 2000, 5000); // 2 seconds into next hour

        logger.warn(
          `[RateLimit] Sender '${senderEmail}' (${senderId}) reached hourly limit (${currentCount}/${limit}). Rescheduling to next window.`
        );

        // Check if we should send a Slack notification (once per hour per sender)
        const alreadyNotified = await redisClient.set(notificationKey, '1', 'EX', 7200, 'NX');
        if (alreadyNotified === 'OK') {
          // Send live Slack notification asynchronously
          notifyRateLimitHit({
            userId,
            senderEmail,
            senderId,
            limit,
            currentCount,
            nextAvailableWindow: new Date(nextHourMs),
          }).catch((err) => {
            logger.error('[RateLimit] Slack notification failed:', err.message);
          });
        }

        return {
          allowed: false,
          currentCount,
          limit,
          retryAfterMs,
          nextAvailableWindow: new Date(nextHourMs),
        };
      }

      return {
        allowed: true,
        currentCount,
        limit,
      };
    } catch (error: any) {
      logger.error('[RateLimit] Redis error in checkAndConsumeRateLimit:', error.message);
      // Fallback: allow to avoid losing jobs on temporary Redis glitch, but log
      return {
        allowed: true,
        currentCount: 1,
        limit,
      };
    }
  }

  /**
   * Resets rate limit for a sender (useful for testing & demo)
   */
  public static async resetRateLimit(senderId: string): Promise<void> {
    const windowKey = this.getHourWindowKey();
    const redisKey = `ratelimit:sender:${senderId}:${windowKey}`;
    const notificationKey = `ratelimit:notified:${senderId}:${windowKey}`;
    await redisClient.del(redisKey, notificationKey);
    logger.info(`[RateLimit] Reset rate limit for sender: ${senderId}`);
  }

  /**
   * Get current rate limit stats for a sender
   */
  public static async getSenderRateLimitStatus(senderId: string, limit: number): Promise<{ count: number; limit: number; remaining: number }> {
    const windowKey = this.getHourWindowKey();
    const redisKey = `ratelimit:sender:${senderId}:${windowKey}`;
    const countStr = await redisClient.get(redisKey);
    const count = countStr ? parseInt(countStr, 10) : 0;
    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  }
}
