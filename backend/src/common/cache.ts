import { redis } from '../lib/redis';

/**
 * Get value from cache and parse from JSON
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`[Cache] Error getting key ${key}:`, error);
    return null;
  }
};

/**
 * Set value in cache with TTL (seconds)
 */
export const setCache = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
  try {
    const data = JSON.stringify(value);
    await redis.set(key, data, 'EX', ttlSeconds);
  } catch (error) {
    console.error(`[Cache] Error setting key ${key}:`, error);
  }
};

/**
 * Delete from cache
 */
export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`[Cache] Error deleting key ${key}:`, error);
  }
};
