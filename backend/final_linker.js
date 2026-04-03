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

  console.log(`--- UNIVERSAL LINKER FOR ${email} ---`);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('❌ Admin user not found in database.');
      return;
    }

    const shops = await prisma.shop.findMany();
    console.log(`✅ Found ${shops.length} total shops.`);

    for (const shop of shops) {
      process.stdout.write(`Linking to ${shop.name} (${shop.id})... `);
      await prisma.shopMember.upsert({
        where: { 
          userId_shopId: { 
            userId: user.id, 
            shopId: shop.id 
          } 
        },
        update: { role: 'ADMIN', isActive: true },
        create: { 
          userId: user.id, 
          shopId: shop.id, 
          role: 'ADMIN', 
          isActive: true 
        }
      });
      console.log('Done.');
    }

    // Also update any existing memberships for this user to ADMIN/Active
    await prisma.shopMember.updateMany({
      where: { userId: user.id },
      data: { role: 'ADMIN', isActive: true }
    });

    console.log('✅ ALL SHOPS LINKED SUCCESSFULLY.');
  } catch (err) {
    console.error('❌ Error during linker:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
