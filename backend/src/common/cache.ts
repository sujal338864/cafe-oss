import { redis } from '../lib/redis';

/**
 * Check if Redis is actually connected before trying to use it.
 * ioredis queues commands when offline, causing infinite hangs.
 */
const isRedisReady = (): boolean => {
  try {
    return redis.status === 'ready';
  } catch {
    return false;
  }
};

/**
 * Get value from cache and parse from JSON
 * Returns null immediately if Redis is offline (never hangs)
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisReady()) return null; // Skip cache when Redis is offline
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    return null;
  }
};

/**
 * Set value in cache with TTL (seconds)
 * No-ops silently if Redis is offline
 */
export const setCache = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
  if (!isRedisReady()) return; // Skip cache when Redis is offline
  try {
    const data = JSON.stringify(value);
    await redis.set(key, data, 'EX', ttlSeconds);
  } catch (error) {
    // Silently fail — cache is optional
  }
};

/**
 * Delete from cache
 */
export const deleteCache = async (key: string): Promise<void> => {
  if (!isRedisReady()) return;
  try {
    await redis.del(key);
  } catch (error) {
    // Silently fail
  }
};
