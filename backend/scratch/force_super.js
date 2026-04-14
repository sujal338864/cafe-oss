const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@shopos.com';
  
  // 1. Force User Role
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'SUPER_ADMIN' }
  });
  console.log('User role forced to SUPER_ADMIN');

  // 2. Clear all existing tokens for this user by changing their lastLogin or just asking for re-login
  // Actually, just ensuring the DB is correct is enough for /me to catch up.
  
  // 3. Ensure they have a Membership with SUPER_ADMIN in the System shop
  const systemShop = await prisma.shop.findFirst({ where: { name: 'System' } });
  if (systemShop) {
    await prisma.membership.upsert({
      where: { userId_shopId: { userId: user.id, shopId: systemShop.id } },
      update: { role: 'SUPER_ADMIN' },
      create: {
        userId: user.id,
        shopId: systemShop.id,
        role: 'SUPER_ADMIN'
      }
    });
    console.log('Membership role forced to SUPER_ADMIN');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
