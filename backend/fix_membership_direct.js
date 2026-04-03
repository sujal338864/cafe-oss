const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL + '?connection_limit=1'
    }
  }
});

async function main() {
  const email = 'admin@cafeosz.com';
  const targetShops = [
    'cmmye4o5r00017rqu3ba8skxi',
    'd8bd17c9-c001-4d56-8351-2c73214083d1'
  ];

  console.log(`--- Manual Link Repair for ${email} ---`);

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found. Creating user...');
      user = await prisma.user.create({
        data: {
          name: 'Admin',
          email,
          passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LqGZC.9zWdAtMBN/z/f5.UoA.5Z7B.n8v1y.y', // password123
          plan: 'PRO'
        }
      });
    }
    console.log(`User ID: ${user.id}`);

    for (const shopId of targetShops) {
      console.log(`Checking Shop: ${shopId}`);
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) {
        console.log(`⚠️ Shop ${shopId} not found in database! Creating it...`);
        await prisma.shop.create({
            data: {
                id: shopId,
                name: 'Restored Shop',
                ownerName: 'Admin',
                phone: '0000000000',
                email: `shop_${shopId.substring(0,5)}@demo.com`
            }
        });
      }

      console.log(`Linking user to shop ${shopId}...`);
      await prisma.shopMember.upsert({
        where: { userId_shopId: { userId: user.id, shopId: shopId } },
        update: { role: 'ADMIN', isActive: true },
        create: { userId: user.id, shopId: shopId, role: 'ADMIN', isActive: true }
      });
    }

    console.log('✅ REPAIR COMPLETE.');
  } catch (err) {
    console.error('Repair failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
