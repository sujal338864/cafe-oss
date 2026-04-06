const Redis = require('ioredis');
const dotenv = require('dotenv');
dotenv.config();

console.log('--- REDIS CONNECTION TEST ---');
console.log('URL:', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000 // 5s timeout
});

redis.on('error', (err) => console.error('❌ REDIS ERROR:', err.message));

async function main() {
    console.log('Attemping to ping Redis...');
    try {
        const start = Date.now();
        const result = await redis.ping();
        const end = Date.now();
        console.log('✅ SUCCESS:', result);
        console.log(`⏱️ Latency: ${end - start}ms`);
    } catch (err) {
        console.error('❌ FAILED:', err.message);
    } finally {
        redis.disconnect();
    }
}

main();
