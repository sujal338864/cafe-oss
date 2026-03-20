import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

export class CircuitBreaker {
  private key: string;
  private threshold: number;
  private timeoutSeconds: number;

  constructor(name: string, threshold = 3, timeoutSeconds = 60) {
    this.key = `circuit:${name}`;
    this.threshold = threshold;
    this.timeoutSeconds = timeoutSeconds;
  }

  async execute<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      const state = await redis.get(`${this.key}:state`);

      if (state === 'OPEN') {
        logger.warn(`[CircuitBreaker] ${this.key} is OPEN. Executing fallback.`);
        return fallback();
      }

      try {
        const result = await fn();
        // On success, reset failures count!
        await redis.del(`${this.key}:failures`);
        return result;
      } catch (err) {
        const failures = await redis.incr(`${this.key}:failures`);
        await redis.expire(`${this.key}:failures`, this.timeoutSeconds);

        logger.error(`[CircuitBreaker] ${this.key} failure (${failures}/${this.threshold}):`, err);

        if (failures >= this.threshold) {
          // Trip OPEN
          await redis.set(`${this.key}:state`, 'OPEN', 'EX', this.timeoutSeconds);
          logger.error(`[CircuitBreaker] ${this.key} TRIPPED OPEN.`);
        }

        return fallback();
      }
    } catch (err) {
      logger.error(`[CircuitBreaker] Redis error on ${this.key}:`, err);
      // Fail open to standard execution just in case Redis itself fails!
      return fn().catch(() => fallback());
    }
  }
}
