const { PrismaClient } = require('@prisma/client');
// Use the direct URL to ensure we can kill other sessions
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

async function kill() {
  console.log('🔫 Killing background database sessions to release locks...');
  try {
    const result = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid() 
        AND datname = current_database()
        AND usename = current_user;
    `);
    console.log(`✅ Killed sessions. Result count: ${result}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Failed to kill sessions:', e);
    process.exit(1);
  }
}
kill();
