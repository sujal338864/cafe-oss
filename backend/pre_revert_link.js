const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL + '&connection_limit=1'
    }
  }
});

async function restore() {
  const email = 'cafe@0000gmail.com';
  const targetShopId = 'cmmye4o5r00017rqu3ba8skxi';

  console.log(`--- REVERTING TO SINGLE-TENANT FOR ${email} ---`);

  try {
    // 1. Find the User
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        user = await prisma.user.findUnique({ where: { email: 'admin@cafeosz.com' } });
    }

    if (!user) {
      console.error('❌ User not found.');
      return;
    }

    // 2. Link User directly to ShopId (Prisma will need this for the single-tenant schema)
    console.log(`Setting direct shopId ${targetShopId} on user ${user.id}...`);
    await prisma.user.update({
      where: { id: user.id },
      data: { shopId: targetShopId }
    });

    console.log('✅ PRE-REVERSION LINK COMPLETE.');
    console.log('You are now safe to revert the schema.prisma file.');

  } catch (err) {
    console.error('❌ Link restoration failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

restore();
