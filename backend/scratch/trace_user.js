const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@cafeosz.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('User Current Shop ID:', user.shopId);
  
  const shop = await prisma.shop.findUnique({ where: { id: user.shopId } });
  console.log('Current Shop Name:', shop?.name);
  
  const products = await prisma.product.findMany({
    where: { shopId: user.shopId, isActive: true },
    include: { category: true }
  });
  console.log('Products for this ID:', products.length);
  products.forEach(p => console.log(`- ${p.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
