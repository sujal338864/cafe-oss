const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDunes() {
  console.log('--- SCANNING FOR DunesCafe ---');
  const shops = await prisma.shop.findMany({
    where: { name: { contains: 'Dunes' } }
  });
  console.log(`Found ${shops.length} matches:`);
  shops.forEach(s => console.log(`ID: ${s.id}, Name: ${s.name}`));

  const memberships = await prisma.membership.findMany({
    where: { user: { email: 'admin@cafeosz.com' } },
    include: { shop: true }
  });
  console.log(`\n--- ALL MEMBERSHIPS FOR admin@cafeosz.com ---`);
  memberships.forEach(m => console.log(`User ID: ${m.userId}, Shop: ${m.shop.name} (${m.shopId})`));

  await prisma.$disconnect();
}
findDunes();
