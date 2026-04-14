const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst({ where: { name: 'csfeosss' } });
  if (!shop) {
    console.log('Shop not found');
    return;
  }
  console.log('Shop ID:', shop.id);
  
  const products = await prisma.product.findMany({
    where: { shopId: shop.id },
    include: { category: true }
  });
  console.log('Products found:', products.length);
  products.forEach(p => console.log(`- ${p.name} (Active: ${p.isActive}, Available: ${p.isAvailable}, CategoryId: ${p.categoryId})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
