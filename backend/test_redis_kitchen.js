const Redis = require('ioredis');
const redis = new Redis({ host: '127.0.0.1', port: 6379 });

async function check() {
  const shopId = 'cmmsvsnt100108k4xuw75nlgb';
  const activeOrders = await redis.hgetall(`shop:${shopId}:kitchen`);
  console.log('REDIS ACTIVE ORDERS:', activeOrders);
  process.exit(0);
}
check().catch(console.error);
