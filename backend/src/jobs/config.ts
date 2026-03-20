import { RedisOptions } from 'ioredis';
import { URL } from 'url';

/**
 * Global Redis connection configuration for BullMQ
 */
const connectionOptions: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
};

// Parse REDIS_URL on Production (Render) environments safely
if (process.env.REDIS_URL) {
  try {
    const parsed = new URL(process.env.REDIS_URL);
    connectionOptions.host = parsed.hostname;
    connectionOptions.port = parseInt(parsed.port || '6379');
    if (parsed.password) {
      connectionOptions.password = decodeURIComponent(parsed.password);
    }
  } catch (e) {
    console.error('[Redis] Failed to parse REDIS_URL config:', e);
  }
}

export const redisConnection = connectionOptions;
