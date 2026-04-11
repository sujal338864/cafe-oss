const Redis = require('ioredis');
const redis = new Redis('redis://127.0.0.1:6379');
redis.flushall().then(() => {
  console.log('Redis cleared');
  process.exit(0);
}).catch(console.error);
