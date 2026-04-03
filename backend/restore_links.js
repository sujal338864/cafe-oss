const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL + '&connection_limit=1'
    }
  }
});

async function main() {
  const email = 'admin@cafeosz.com';
  const targetShopId = 'cmmye4o5r00017rqu3ba8skxi';

  console.log(`--- FORCE PROJECT RESTORATION FOR ${email} ---`);

  try {
    // 1. Ensure User exists and set their PRIMARY shopId
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found. Creating user...');
      user = await prisma.user.create({
        data: {
          name: 'Admin',
          email,
          passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LqGZC.9zWdAtMBN/z/f5.UoA.5Z7B.n8v1y.y',
          plan: 'PRO',
          shopId: targetShopId // RESTORE COMPATIBILITY
        }
      });
    } else {
      console.log('Updating existing user with compatibility shopId...');
      await prisma.user.update({
        where: { id: user.id },
        data: { shopId: targetShopId }
      });
    }

    // 2. Ensure Shop exists
    const shop = await prisma.shop.findUnique({ where: { id: targetShopId } });
    if (!shop) {
      console.warn(`⚠️ Shop ${targetShopId} not found. Creating placeholder to prevent 404...`);
      await prisma.shop.create({
        data: {
          id: targetShopId,
          name: 'Restored Shop',
          ownerName: 'Admin',
          phone: '0000000000',
          email: 'restored@demo.com'
        }
      });
    }

    // 3. Ensure Membership exists
    console.log(`Linking user ${user.id} to shop ${targetShopId} in multi-tenant table...`);
    await prisma.shopMember.upsert({
      where: { userId_shopId: { userId: user.id, shopId: targetShopId } },
      update: { role: 'ADMIN', isActive: true },
      create: { userId: user.id, shopId: targetShopId, role: 'ADMIN', isActive: true }
    });

    console.log('✅ PROJECT LINKS RESTORED.');
  } catch (err) {
    console.error('Restoration failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
