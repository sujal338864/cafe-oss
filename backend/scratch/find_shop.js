const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst({
    where: { name: 'csfeosss' }
  });
  console.log('Shop details:', JSON.stringify(shop, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
