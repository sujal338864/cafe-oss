import dotenv from 'dotenv';
dotenv.config();

import { redis } from './src/lib/redis';

async function clear() {
  try {
    const shopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
    await redis.del(`ai_insights:${shopId}`);
    console.log('--- CACHE CLEARED ---');
    process.exit(0);
  } catch (e) {
    console.error('Failed to clear cache:', e);
    process.exit(1);
  }
}

clear();
