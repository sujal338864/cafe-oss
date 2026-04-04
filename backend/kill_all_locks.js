const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- FORCING TERMINATION OF ALL OTHER CONNECTIONS ---');
    
    // Kill everything else except this current connected script
    await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = 'postgres' AND pid <> pg_backend_pid();
    `);
    console.log('✅ Older connections terminated successfully.');

    // Wait 2 seconds to let Postgres release ports
    await new Promise(r => setTimeout(r, 2000));

    // NOW execute the crucial Alter Query
    console.log('--- RUNNING ALTER TABLE ---');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "invoiceSettings" TEXT;`);
    console.log('✅ SQL ALTER TABLE SUCCESS: ADDED "invoiceSettings" COLUMN!');
    
    process.exit(0);
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
       console.log('✅ Column already exists in DB structures.');
       process.exit(0);
    }
    console.error('❌ emergency reset failed:', e);
    process.exit(1);
  }
}

main();
