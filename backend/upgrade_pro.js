const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.shop.updateMany({ data: { plan: 'PRO' } });
  console.log('✅ DB UPGRADE SUCCESS. Upgraded Shops:', res.count);
  process.exit(0);
}

main().catch(e => {
  console.error('❌ UPGRADE FAILED:', e);
  process.exit(1);
});
