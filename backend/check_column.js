const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Shop' AND column_name = 'invoiceSettings';
    `;
    console.log('\n--- COLUMN CHECK ---');
    console.log(JSON.stringify(tableInfo, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('❌ Check failed:', e);
    process.exit(1);
  }
}

main();
