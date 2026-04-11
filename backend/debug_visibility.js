const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('🔍 DEEP VISIBILITY INSPECTION...');
  try {
    const totalProducts = await prisma.product.count();
    console.log('📦 Total Products in DB:', totalProducts);
    
    const uniqueShops = await prisma.product.groupBy({
      by: ['shopId'],
      _count: true
    });
    console.log('🏢 Distribution of Products across Shops:', JSON.stringify(uniqueShops, null, 2));

    const allShops = await prisma.shop.findMany({ select: { id: true, name: true } });
    console.log('🏛️ Shops registered in system:', JSON.stringify(allShops, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}
check();
