const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Force dropping all tables in public schema...');
  try {
    const tableNames = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    
    console.log(`Found ${tableNames.length} tables to drop.`);
    
    for (const { tablename } of tableNames) {
      if (tablename.startsWith('_')) continue; // Skip prisma internal if needed, but usually we want to drop all
      console.log(`Dropping table "${tablename}"...`);
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."${tablename}" CASCADE;`);
    }
    
    console.log('All tables dropped! Now prisma db push should work without reset timeouts.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
