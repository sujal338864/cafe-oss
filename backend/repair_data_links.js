const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
});

async function main() {
  const email = 'admin@cafeosz.com';
  console.log(`--- EMERGENCY DATA REPAIR FOR ${email} ---`);

  try {
    // 1. Find User
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('❌ User not found. Cannot repair.');
      return;
    }
    console.log(`✅ Found User: ${user.name} (${user.id})`);

    // 2. Find all Shops
    const shops = await prisma.shop.findMany();
    console.log(`✅ Found ${shops.length} total shops in database.`);

    if (shops.length === 0) {
      console.log('❌ No shops found in database. Please create a shop first.');
      return;
    }

    // 3. Link User to ALL Shops as ADMIN
    for (const shop of shops) {
      console.log(`Linking to shop: ${shop.name} (${shop.id}) ...`);
      await prisma.shopMember.upsert({
        where: { userId_shopId: { userId: user.id, shopId: shop.id } },
        update: { role: 'ADMIN', isActive: true },
        create: { userId: user.id, shopId: shop.id, role: 'ADMIN', isActive: true }
      });
      
      // Ensure shop is active too
      await prisma.shop.update({
        where: { id: shop.id },
        data: { isActive: true }
      });
    }

    console.log('✅ REPAIR COMPLETE. You are now an ADMIN of all shops.');
    console.log('Please refresh your dashboard and use the Shop Switcher if needed.');

  } catch (err) {
    console.error('Repair failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
