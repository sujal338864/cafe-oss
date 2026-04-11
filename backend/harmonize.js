const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function mergeAll() {
  const email = 'cafe999@gmail.com';
  console.log(`--- Harmonizing shops for ${email} ---`);
  
  const memberships = await p.membership.findMany({
    where: { user: { email } },
    include: { shop: true },
    orderBy: { createdAt: 'desc' }
  });

  const nameMap = {};
  for (const m of memberships) {
    const shopName = m.shop.name;
    if (!nameMap[shopName]) {
      nameMap[shopName] = m.shopId;
      console.log(`Keeping primary: ${shopName} (${m.shopId})`);
    } else if (nameMap[shopName] !== m.shopId) {
      console.log(`Merging duplicate found: ${shopName} (${m.shopId})`);
      // Surgical removal of ghost shop
      await p.membership.deleteMany({ where: { shopId: m.shopId } });
      await p.user.deleteMany({ where: { shopId: m.shopId } });
      await p.shop.delete({ where: { id: m.shopId } });
    }
  }

  console.log('Harmonization complete.');
  await p.$disconnect();
}

mergeAll().catch(err => {
  console.error(err);
  process.exit(1);
});
