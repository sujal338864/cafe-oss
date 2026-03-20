import { RedisOptions } from 'ioredis';
import IORedis from 'ioredis';

/**
 * Global Redis connection configuration for BullMQ
 */
const connectionOptions: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
};

// Use REDIS_URL if present (Render/Production), fallback to discrete options (Local)
export const redisConnection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : connectionOptions;
