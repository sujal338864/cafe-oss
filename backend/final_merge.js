const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function clean() {
  console.log('--- Cleaning Duplicate 998cafe ---');
  const shops = await p.shop.findMany({
    where: { name: '998cafe' },
    orderBy: { createdAt: 'asc' }
  });

  if (shops.length > 1) {
    console.log(`Found ${shops.length} duplicates. Deleting the oldest one (ID: ${shops[0].id})...`);
    await p.membership.deleteMany({ where: { shopId: shops[0].id } });
    await p.user.deleteMany({ where: { shopId: shops[0].id } });
    await p.shop.delete({ where: { id: shops[0].id } });
    console.log('Master merge complete.');
  } else {
    console.log('No duplicates found.');
  }

  await p.$disconnect();
}

clean();
