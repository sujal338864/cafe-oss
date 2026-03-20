import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

export const distributedRateLimiter = (maxRequests: number, windowSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${req.ip}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      const results = await redis.multi()
        .zremrangebyscore(key, 0, windowStart) // Remove old data
        .zadd(key, now, `${now}-${Math.random()}`) // Add new data with random suffix to prevent score duplicates 
        .expire(key, windowSeconds) // Set TTL
        .zcard(key) // Count total requests
        .exec();

      if (!results) {
        return next(); // Fail open if execution issues occur
      }

      // The count is the 4th command in the transaction Multi bundle!
      const count = results[3][1] as number;

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));

      if (count > maxRequests) {
        logger.warn(`[RateLimit] Blocked IP: ${req.ip} exceeded ${maxRequests} requests`);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.'
        });
      }

      next();
    } catch (err) {
      logger.error(`[RateLimit] Error processing key ${key}:`, err);
      next(); // Fail open so the request can still proceed if Redis is down!
    }
  };
};
