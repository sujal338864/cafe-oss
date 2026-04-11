const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const targetShopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
  console.log(`🔍 CHECKING DATA FOR TARGET SHOP: ${targetShopId}`);
  try {
    const shop = await prisma.shop.findUnique({ where: { id: targetShopId } });
    if (!shop) {
        console.log('❌ Shop not found by ID!');
        // Try finding by name or owner
        const search = await prisma.shop.findFirst({ where: { OR: [{ email: 'admin@cafeosz.com' }, { ownerName: 'Admin' }] } });
        console.log('🕵️ Search result by email/owner:', search ? JSON.stringify(search, null, 2) : 'NOT FOUND');
    } else {
        console.log('✅ Shop found:', JSON.stringify(shop, null, 2));
    }

    const pCount = await prisma.product.count({ where: { shopId: targetShopId } });
    const oCount = await prisma.order.count({ where: { shopId: targetShopId } });
    const uCount = await prisma.user.count({ where: { shopId: targetShopId } });
    
    console.log(`📦 Products: ${pCount}`);
    console.log(`🧾 Orders: ${oCount}`);
    console.log(`👤 Users: ${uCount}`);

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}
check();
