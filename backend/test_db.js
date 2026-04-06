const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log('Testing connection to:', process.env.DATABASE_URL.replace(/:.*@/, ':****@'));
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('SUCCESS:', result);
  } catch (e) {
    console.error('FAILURE:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
