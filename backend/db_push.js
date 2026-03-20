const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Add column direct to Postgres securely
    await prisma.$executeRawUnsafe(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "invoiceSettings" TEXT;`);
    console.log('✅ ALTER TABLE SUCCESS: Added "invoiceSettings" column to Shop table');
  } catch (e) {
    // Handle Already Exists generally
    if (e.message && e.message.includes('already exists')) {
      console.log('✅ Column already exists in DB layout.');
    } else {
      console.error('❌ SQL Execution failed:', e);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
