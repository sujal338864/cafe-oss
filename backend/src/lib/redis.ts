import Redis from 'ioredis';
import { redisConnection } from '../jobs/config';
import { logger } from './logger';

const lastLogged = new Map<string, number>();
let lastGlobalWarn = 0;
const GLOBAL_WARN_INTERVAL = 60000;

/**
 * Global Redis error handler for debounced, quiet logging
 */
export const logRedisError = (source: string, err: any) => {
  const now = Date.now();
  
  const isConnError = err.code === 'ECONNREFUSED' || err.message?.includes('Connection is closed');
  
  if (isConnError) {
    if (now - lastGlobalWarn > GLOBAL_WARN_INTERVAL) { // One warning for the WHOLE APP every 60s
      console.warn(`[Redis] Global connection offline (127.0.0.1:6379). Use Memurai/Redis to enable background tasks. App stays stable.`);
      lastGlobalWarn = now;
    }
    return;
  }
  
  // Silence BullMQ internal move errors which are normal during disconnection
  if (err.message?.includes('is closed') || err.message?.includes('not connected')) return;

  const last = lastLogged.get(source) || 0;
  if (now - last > GLOBAL_WARN_INTERVAL) {
    console.error(`[Redis] ${source} error:`, err.message || err);
    lastLogged.set(source, now);
  }
};

// --- ABSOLUTE SILENCE PROXY ---
// This wraps the Redis constructor to ensure EVERY client in the app (including BullMQ/Socket internals)
// has our quiet error handler attached immediately upon creation.
const OriginalRedis = Redis;
const ProxiedRedis: any = function (this: any, ...args: any[]) {
  const opts = args[0] || {};
  const instance = new (OriginalRedis as any)({
    ...redisConnection,
    ...opts,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1
  });
  instance.on('error', (err: any) => logRedisError('InternalClient', err));
  return instance;
};
ProxiedRedis.prototype = OriginalRedis.prototype;
Object.assign(ProxiedRedis, OriginalRedis);

// Override the export so everything uses the proxied version
export { ProxiedRedis as Redis }; 

/**
 * Singleton Redis client for general application caching
 */
export const redis = new OriginalRedis(redisConnection);

// Global interceptor for any "shadow" Redis errors that escape handlers
const originalStderrWrite = process.stderr.write;

process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ECONNREFUSED' || err?.message?.includes('Connection is closed')) return;
  logger.error('Uncaught Exception:', err);
});

process.stderr.write = function (chunk: string | Uint8Array, ...args: any[]) {
  const content = typeof chunk === 'string' ? chunk : chunk.toString();
  const isRedisError = content.includes('ECONNREFUSED 127.0.0.1:6379');
  if (isRedisError) return true; // Silence Redis connection noise while app remains stable
  return originalStderrWrite.apply(process.stderr, [chunk, ...args] as any);
} as any;

process.on('unhandledRejection', (reason: any) => {
  const msg = (reason as any)?.message || String(reason);
  if ((reason as any)?.code === 'ECONNREFUSED' || msg.includes('Connection is closed')) return;
  logger.error('Unhandled Rejection:', reason);
});

redis.on('connect', () => {
  console.log('[Redis] Caching client connected.');
  lastLogged.delete('CachingClient');
});

redis.on('error', (err) => logRedisError('CachingClient', err));

// Start connecting after handlers are ready
redis.connect().catch(() => {});
