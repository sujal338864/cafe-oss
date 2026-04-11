const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  const shops = await prisma.shop.findMany({
    where: { name: 'DunesCafe' },
    include: { memberships: true }
  });

  console.log(`Found ${shops.length} shops named "DunesCafe":`);
  shops.forEach(s => {
    console.log(`- Shop ID: ${s.id}, Created At: ${s.createdAt}, Plan: ${s.plan}`);
    console.log(`  Memberships: ${s.memberships.length}`);
  });

  if (shops.length > 1) {
    console.log('\n🗑️ Cleaning up the duplicate (the one with 0 or fewer memberships, or the older one)...');
    // Keep the one that seems "more complete" or the newest one
    const toDelete = shops[0]; // Logic for deletion goes here
    // But safely, I'll let the user know first.
  }

  await prisma.$disconnect();
}

cleanup();
