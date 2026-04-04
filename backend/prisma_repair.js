const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync('repair_log.txt', line);
  console.log(msg);
}

async function main() {
  if (fs.existsSync('repair_log.txt')) fs.unlinkSync('repair_log.txt');
  log('Starting diagnostic and repair...');
  try {
    // 1. Check Shop columns
    log('Checking Shop columns...');
    const shopCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Shop'`;
    const shopColNames = shopCols.map(c => c.column_name);
    log('Current Shop columns: ' + JSON.stringify(shopColNames));

    if (!shopColNames.includes('invoiceSettings')) {
      log('Adding invoiceSettings to Shop...');
      await prisma.$executeRawUnsafe(`ALTER TABLE "Shop" ADD COLUMN "invoiceSettings" JSONB DEFAULT '{}'`);
    }

    // 2. Check User columns
    log('Checking User columns...');
    const userCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User'`;
    const userColNames = userCols.map(c => c.column_name);
    log('Current User columns: ' + JSON.stringify(userColNames));

    if (!userColNames.includes('shopId')) {
      log('Adding shopId to User...');
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "shopId" TEXT`);
    }

    log('REPAIR COMPLETED SUCCESSFULLY');
  } catch (e) {
    log('REPAIR FAILED: ' + e.message);
    log(e.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

