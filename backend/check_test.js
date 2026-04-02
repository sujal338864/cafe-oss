const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const shopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
  console.log('Checking Shop:', shopId);

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    console.error('❌ Shop NOT found in database!');
    return;
  }
  console.log('✅ Shop found:', shop.name);

  const productCount = await prisma.product.count({ where: { shopId } });
  console.log('Total Products for Shop:', productCount);

  const activeWithStock = await prisma.product.count({ 
    where: { shopId, isActive: true, stock: { gt: 0 } } 
  });
  console.log('Active Products with Stock > 0:', activeWithStock);

  if (activeWithStock === 0) {
    const samples = await prisma.product.findMany({ 
      where: { shopId }, 
      take: 5,
      select: { name: true, isActive: true, stock: true }
    });
    console.log('Sample Products (first 5):', JSON.stringify(samples, null, 2));
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
