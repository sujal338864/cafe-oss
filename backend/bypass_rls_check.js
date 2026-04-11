const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

async function check() {
  console.log('🔓 ATTEMPTING RAW DB ACCESS (BYPASSING RLS)...');
  try {
    // Try to count products using direct SQL to see if they exist
    const count = await prisma.$queryRawUnsafe('SELECT COUNT(*) FROM "Product";');
    console.log('✅ Found Products in DB (RAW):', JSON.stringify(count, null, 2));
    
    const sample = await prisma.$queryRawUnsafe('SELECT "shopId", name FROM "Product" LIMIT 5;');
    console.log('📦 Sample Data shopIds:', JSON.stringify(sample, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}
check();
