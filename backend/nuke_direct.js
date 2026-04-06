const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.nxrremvvolgapdtlrwwl:xsv67nH%2BE%2AS%2FMRx@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?connection_limit=1'
      }
    }
  });

  console.log('Force dropping all tables via DIRECT_URL...');
  try {
    const tableNames = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    
    console.log(`Found ${tableNames.length} tables to drop.`);
    
    // Disable triggers to avoid FK constraint issues during drop
    await prisma.$executeRawUnsafe('SET session_replication_role = "replica";');
    
    for (const { tablename } of tableNames) {
      if (tablename.startsWith('_')) continue;
      console.log(`Dropping table "${tablename}"...`);
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."${tablename}" CASCADE;`);
    }
    
    // Delete migrations table
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."_prisma_migrations" CASCADE;`);
    
    await prisma.$executeRawUnsafe('SET session_replication_role = "origin";');
    
    console.log('All tables dropped via DIRECT_URL! Now prisma db push should work.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
