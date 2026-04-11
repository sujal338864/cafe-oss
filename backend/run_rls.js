const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  try {
    const sql = fs.readFileSync('prisma/rls_migration.sql', 'utf8');
    // Prisma executeRaw requires a template literal or executeRawUnsafe
    await prisma.$executeRawUnsafe(sql);
    console.log('Successfully executed RLS migration!');
    process.exit(0);
  } catch(e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}
run();
