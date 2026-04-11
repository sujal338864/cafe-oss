const Redis = require('ioredis');
const dotenv = require('dotenv');
dotenv.config();

const redis = new Redis(process.env.REDIS_URL);

async function unlockAll() {
  console.log('🔓 Clearing all login locks and rate limits from Redis...');
  try {
    const keys = await redis.keys('login_*');
    const rateKeys = await redis.keys('rate_limit:*');
    const allKeys = [...keys, ...rateKeys];

    if (allKeys.length === 0) {
      console.log('✨ No active locks found.');
    } else {
      await redis.del(...allKeys);
      console.log(`✅ Successfully cleared ${allKeys.length} security keys.`);
    }
    process.exit(0);
  } catch (e) {
    console.error('❌ Failed to clear locks:', e);
    process.exit(1);
  }
}

unlockAll();
