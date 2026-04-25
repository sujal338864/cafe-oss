import { RedisOptions } from 'ioredis';
import { URL } from 'url';

/**
 * Universal Redis connection configuration:
 * 1. Supports local (host/port)
 * 2. Supports Production REDIS_URL (rediss://, username, password)
 */
let connectionOptions: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
  lazyConnect: true, 
  enableOfflineQueue: false, // Prevents hanging when Redis is down
  retryStrategy: (times) => Math.min(times * 200, 3000), 
};

if (process.env.REDIS_URL) {
  try {
    const url = new URL(process.env.REDIS_URL);
    connectionOptions = {
      ...connectionOptions,
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      username: url.username || undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
    };
  } catch (e) {
    console.error('[Redis] Invalid REDIS_URL format:', e);
  }
}

export const redisConnection = connectionOptions;

/**
 * Standardized Dead-Letter-Queue (DLQ) Fallback Policy.
 * Hard limit of 200 failed jobs to prevent Redis Out-Of-Memory (OOM) crashes.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 500 }, // Expire successful jobs quickly
  removeOnFail: { age: 7 * 24 * 3600, count: 200 } // Hard cap on DLQ
};
