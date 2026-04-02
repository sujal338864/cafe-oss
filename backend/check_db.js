const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('=== DATABASE DIAGNOSTICS ===');
  
  // 1. List all shops
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true, _count: { select: { products: true } } }
  });
  console.log('\nAll Shops:');
  for (const s of shops) {
    console.log(`  Shop: "${s.name}" | ID: ${s.id} | Products: ${s._count.products}`);
  }

  // 2. Check target shop specifically
  const targetId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
  const targetShop = await prisma.shop.findUnique({ where: { id: targetId } });
  console.log('\nTarget Shop (from URL):', targetShop ? targetShop.name : 'NOT FOUND');

  // 3. Total products in system
  const totalProducts = await prisma.product.count();
  console.log('Total products in entire database:', totalProducts);

  // 4. Sample products
  if (totalProducts > 0) {
    const samples = await prisma.product.findMany({
      take: 5,
      select: { name: true, shopId: true, isActive: true, stock: true }
    });
    console.log('\nSample products:');
    for (const p of samples) {
      console.log(`  "${p.name}" | shopId: ${p.shopId} | active: ${p.isActive} | stock: ${p.stock}`);
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
