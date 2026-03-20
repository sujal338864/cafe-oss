import { Request, Response, NextFunction } from 'express';
import { getCache, setCache } from '../common/cache';
import { logger } from '../lib/logger';

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.header('x-idempotency-key');
  const timestampStr = req.header('x-timestamp');

  if (!key) {
    return next(); // Skip if no key provided
  }

  // 1. Replay Attack Mitigation: Verify Timestamp ⏰
  if (timestampStr) {
    const requestTime = parseInt(timestampStr, 10);
    const now = Date.now();
    const toleranceMs = 5 * 60 * 1000; // 5 minutes tolerance

    if (isNaN(requestTime) || Math.abs(now - requestTime) > toleranceMs) {
      logger.warn(`[Idempotency] Expired or invalid timestamp for key: ${key}. RequestTime: ${requestTime}, Now: ${now}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request timestamp is invalid or expired. Potential replay attack blocked.'
      });
    }
  }

  const cacheKey = `idempotency:${key}`;

  try {
    const cachedResponse = await getCache<any>(cacheKey);
    if (cachedResponse) {
      logger.info(`[Idempotency] Cache hit for key: ${key}`);
      res.setHeader('x-idempotent-replayed', 'true');
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    // Monkeypatch res.json to capture response before sending!
    const originalJson = res.json;
    
    res.json = function (body: any) {
      res.json = originalJson; // Restore original

      // Only cache successful status codes to avoid caching transient failures!
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(cacheKey, { status: res.statusCode, body }, 86400) // 24 Hours TTL
          .catch(err => logger.error(`[Idempotency] Cache write fail for key ${key}:`, err));
      }

      return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    logger.error(`[Idempotency] Error processing key ${key}:`, err);
    next(); // Fail open so the request can still proceed if Redis is down!
  }
};
