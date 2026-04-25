
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

/**
 * Idempotency Utility: Prevents double-processing of critical requests (Checkout, Sync).
 */
export const Idempotency = {
  /**
   * Check if a request has been processed.
   * key should be: `idempotency:${shopId}:${requestId}`
   */
  get: async (key: string) => {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Save the result of a successful request.
   * TTL default: 1 hour (enough to cover lag/retries)
   */
  set: async (key: string, result: any, ttl = 3600) => {
    try {
      await redis.setex(key, ttl, JSON.stringify(result));
    } catch (e) {
      logger.error(`[IDEMPOTENCY] Cache write failed: ${e.message}`);
    }
  }
};
