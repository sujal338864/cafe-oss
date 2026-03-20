import dotenv from 'dotenv';
dotenv.config();

import { redis } from './src/lib/redis';

async function test() {
  try {
    const shopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
    const c = await redis.get(`ai_insights:${shopId}`);
    console.log('--- REDIS CACHE CONTENT ---');
    console.log(c);
    console.log('---------------------------');
    process.exit(0);
  } catch (e) {
    console.error('Test script crashed:', e);
    process.exit(1);
  }
}

test();
