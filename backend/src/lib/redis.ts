import Redis from 'ioredis';
import { redisConnection } from '../jobs/config';

/**
 * Singleton Redis client for general application caching
 */
export const redis = new Redis({
  host: redisConnection.host,
  port: redisConnection.port,
  password: redisConnection.password,
});

redis.on('connect', () => {
  console.log('[Redis] Caching client connected.');
});

redis.on('error', (err) => {
  console.error('[Redis] Caching client error:', err);
});
