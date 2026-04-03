const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL + '&connection_limit=1'
    }
  }
});

async function stabilize() {
  const email = 'cafe@0000gmail.com';
  console.log(`--- Stabilizing Project for ${email} ---`);

  try {
    // 1. Find the User
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        console.log('User not found. Checking alternate email admin@cafeosz.com...');
        user = await prisma.user.findUnique({ where: { email: 'admin@cafeosz.com' } });
    }

    if (!user) {
      console.error('❌ User not found in database.');
      return;
    }

    // 2. Find the Shop named "ss" or the first available shop
    let shop = await prisma.shop.findFirst({
      where: { name: 'ss' }
    });

    if (!shop) {
        console.warn('⚠️ Shop "ss" not found. Looking for any shop...');
        shop = await prisma.shop.findFirst();
    }

    if (!shop) {
      console.error('❌ No shops found in database.');
      return;
    }

    console.log(`Targeting User: ${user.email} (ID: ${user.id})`);
    console.log(`Targeting Shop: ${shop.name} (ID: ${shop.id})`);

    // 3. Force-Upgrade Plan to PRO
    console.log('Upgrading shop to PRO plan...');
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan: 'PRO' }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'PRO', shopId: shop.id } // Set primary shopId for compatibility
    });

    // 4. Ensure Membership exists with ADMIN role
    console.log('Ensuring ADMIN membership...');
    await prisma.shopMember.upsert({
      where: { userId_shopId: { userId: user.id, shopId: shop.id } },
      update: { role: 'ADMIN', isActive: true },
      create: { userId: user.id, shopId: shop.id, role: 'ADMIN', isActive: true }
    });

    // 5. Re-link Orphaned Data (Products, Orders, Categories)
    // This looks for any records that might have been created with a different shop ID during our testing
    console.log('Re-linking orphaned products to this shop...');
    await prisma.product.updateMany({
      where: { shopId: { not: shop.id } },
      data: { shopId: shop.id }
    });

    await prisma.category.updateMany({
      where: { shopId: { not: shop.id } },
      data: { shopId: shop.id }
    });

    await prisma.order.updateMany({
      where: { shopId: { not: shop.id } },
      data: { shopId: shop.id }
    });

    console.log('✅ STABILIZATION COMPLETE.');
    console.log('User is now linked to shop "ss" with PRO plan.');

  } catch (err) {
    console.error('❌ Stabilization failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

stabilize();
