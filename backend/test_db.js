const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config();

console.log('--- DB CONNECTION TEST ---');
console.log('URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function main() {
  console.log('Attemping to connect...');
  try {
    const start = Date.now();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    const end = Date.now();
    console.log('✅ SUCCESS:', result);
    console.log(`⏱️ Latency: ${end - start}ms`);
  } catch (err) {
    console.error('❌ FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
