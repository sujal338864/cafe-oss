const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Dropping Membership table and Role_old if necessary...');
  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "Membership" CASCADE;`);
    console.log('Dropped Membership table. Now prisma db push should succeed.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
