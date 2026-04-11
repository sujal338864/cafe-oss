const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const targetShopId = 'cmnlfu5y30000wyttsnlr9qsd';
  console.log(`🔍 CHECKING DATA FOR SHOP: ${targetShopId}`);
  try {
    const pCount = await prisma.product.count({ where: { shopId: targetShopId } });
    const oCount = await prisma.order.count({ where: { shopId: targetShopId } });
    
    console.log(`📦 Products for this shop: ${pCount}`);
    console.log(`🧾 Orders for this shop: ${oCount}`);

    if (pCount === 0) {
        console.log('⚠️ ALERT: This shop actually has NO PRODUCTS in the database.');
        const otherShops = await prisma.product.groupBy({ by: ['shopId'], _count: true });
        console.log('🕵️ Distribution across other shops:', JSON.stringify(otherShops, null, 2));
    }

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}
check();
