const { PrismaClient } = require('@prisma/client');

// Using the direct database ref (not the pooler)
const URL = "postgresql://postgres.nxrremvvolgapdtlrwwl:xsv67nH%2BE%2AS%2FMRx@db.nxrremvvolgapdtlrwwl.supabase.co:5432/postgres?sslmode=require";

console.log('--- DB DIRECT URL TEST ---');
const prisma = new PrismaClient({
    datasources: { db: { url: URL } }
});

async function main() {
  console.log('Connecting to db.nxrremvvolgapdtlrwwl.supabase.co...');
  try {
    const start = Date.now();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ SUCCESS:', result);
    console.log(`⏱️ Latency: ${Date.now() - start}ms`);
  } catch (err) {
    console.error('❌ FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
