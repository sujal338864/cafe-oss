const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Force dropping all tables surgically...');
  try {
    // Get all tables in public schema
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    
    console.log(`Found ${tables.length} tables to drop.`);
    
    // Disable triggers to avoid FK constraint issues during drop
    await prisma.$executeRawUnsafe('SET session_replication_role = "replica";');
    
    for (const { tablename } of tables) {
      console.log(`Dropping table "${tablename}"...`);
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."${tablename}" CASCADE;`);
    }
    
    // Delete migrations table if it exists to allow fresh prisma push
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."_prisma_migrations" CASCADE;`);
    
    await prisma.$executeRawUnsafe('SET session_replication_role = "origin";');
    
    console.log('All tables dropped! Now prisma db push should succeed without timeouts.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
