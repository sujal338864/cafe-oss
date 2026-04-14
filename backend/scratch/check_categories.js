const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst({ where: { name: 'csfeosss' } });
  if (!shop) return;
  
  const categories = await prisma.category.findMany({
    where: { shopId: shop.id },
    include: { _count: { select: { products: true } } }
  });
  console.log('Categories found for shop:', categories.length);
  categories.forEach(c => console.log(`- ${c.name} (Products: ${c._count.products})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
