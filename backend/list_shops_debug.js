const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shops = await prisma.shop.findMany({
    include: {
      _count: {
        select: { orders: true, products: true, users: true }
      }
    }
  });

  console.log('--- SHOPS DATA ---');
  shops.forEach(s => {
    console.log(`Shop: ${s.name} (${s.id})`);
    console.log(`  Orders:   ${s._count.orders}`);
    console.log(`  Products: ${s._count.products}`);
    console.log(`  Users:    ${s._count.users}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
