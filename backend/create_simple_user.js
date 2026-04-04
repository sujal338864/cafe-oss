const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  try {
    const shop = await prisma.shop.findFirst({ where: { name: 'cafeoss' } });
    if (!shop) {
      console.log('No shop with name cafeoss found, taking first shop.');
    }
    const targetShop = shop || (await prisma.shop.findFirst());
    if (!targetShop) {
      console.log('❌ No shops found in Database!');
      return;
    }

    const email = 'temp@admin.com';
    const password = 'password123';
    const hash = await bcrypt.hash(password, 12);

    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hash, shopId: targetShop.id } });
      console.log('✅ Updated existing user temp@admin.com');
    } else {
      await prisma.user.create({
        data: { name: 'Temp Admin', email, passwordHash: hash, role: 'ADMIN', shopId: targetShop.id }
      });
      console.log('✅ Created new backup user temp@admin.com');
    }
    
    console.log(`\n--- 🔑 USE THESE CREDENTIALS ---`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Linked to Shop: ${targetShop.name} (${targetShop.id})`);

  } catch (e) {
    console.error('❌ Failed to create backup user:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
