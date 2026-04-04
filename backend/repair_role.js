const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync('repair_role_log.txt', line);
  console.log(msg);
}

async function main() {
  if (fs.existsSync('repair_role_log.txt')) fs.unlinkSync('repair_role_log.txt');
  log('Starting role and shopId repair...');
  try {
    // 1. Check User columns
    log('Checking User columns...');
    const userCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User'`;
    const userColNames = userCols.map(c => c.column_name);
    log('Current User columns: ' + JSON.stringify(userColNames));

    if (!userColNames.includes('shopId')) {
      log('Adding shopId to User...');
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "shopId" TEXT`);
      } catch (e) { log('Add shopId failed (maybe exists): ' + e.message); }
    }

    if (!userColNames.includes('role')) {
      log('Adding role to User...');
      // We'll add it as TEXT for maximum compatibility during repair, 
      // Prisma will map it to the Role enum if the values match.
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "role" TEXT DEFAULT 'EMPLOYEE'`);
      } catch (e) { log('Add role failed: ' + e.message); }
    }

    // 2. Check Role enum in DB (Postgres specific)
    log('Checking native types...');
    try {
        const types = await prisma.$queryRaw`SELECT typname FROM pg_type WHERE typname = 'Role'`;
        log('Native Role type: ' + JSON.stringify(types));
    } catch (e) { log('Check types failed: ' + e.message); }

    log('REPAIR COMPLETED');
    
    // Final verification
    const finalCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User'`;
    log('Final User columns: ' + JSON.stringify(finalCols.map(c => c.column_name)));

  } catch (e) {
    log('REPAIR CRITICAL ERROR: ' + e.message);
    log(e.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
