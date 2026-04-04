const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING LIVE REPAIR ---');
  try {
    console.log('Adding Shop.invoiceSettings...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "invoiceSettings" JSONB DEFAULT '{}'`);
    
    console.log('Adding User.shopId...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shopId" TEXT`);

    console.log('Adding Shop.pricingEnabled...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pricingEnabled" BOOLEAN DEFAULT false`);

    console.log('Adding Shop.pricingRules...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pricingRules" JSONB DEFAULT '{}'`);

    console.log('Verifying Shop columns...');
    const cols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Shop'`;
    console.log('Columns in Shop:', cols.map(c => c.column_name));

    console.log('REPAIR COMPLETED');
  } catch (e) {
    console.error('REPAIR FAILED:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

