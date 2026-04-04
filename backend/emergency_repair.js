const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- RESTORING MISSING COLUMNS ---');
  try {
    // 1. ADD shopId TO User
    console.log('Adding "shopId" column to "User"...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopId" TEXT;`);
    
    // 2. Ensuring indexes exist
    console.log('Restoring unique constraints...');
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_shopId_key" ON "User"("email", "shopId");`);

    console.log('DONE! Database should now be compatible with single-tenant code.');
  } catch (error) {
    console.error('FAILED TO RESTORE SCHEMA:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
