const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  // 1. Revert admin@cafeosz.com to ADMIN
  await prisma.user.update({
    where: { email: 'admin@cafeosz.com' },
    data: { role: 'ADMIN' }
  });
  console.log('admin@cafeosz.com reverted to ADMIN');

  // 2. Create the real SUPER_ADMIN
  const superEmail = 'superadmin@shopos.com';
  const superPass = 'SuperPass123!@#'; // User should change this later
  const hash = await bcrypt.hash(superPass, 10);

  // We need a shop for the user record even if we are global (due to schema constraints)
  // Let's use a "System" shop or just use the first available shop
  const systemShop = await prisma.shop.findFirst({ where: { name: 'System' } }) 
                     || await prisma.shop.create({ 
                         data: { 
                           name: 'System', 
                           ownerName: 'Global Admin', 
                           email: 'system@shopos.com',
                           phone: '0000000000'
                         } 
                       });

  const superUser = await prisma.user.upsert({
    where: { email: superEmail },
    update: { role: 'SUPER_ADMIN' },
    create: {
      email: superEmail,
      name: 'Global Administrator',
      passwordHash: hash,
      role: 'SUPER_ADMIN',
      shopId: systemShop.id,
      isActive: true
    }
  });

  console.log(`\n--- NEW SUPER ADMIN CREATED ---`);
  console.log(`Email: ${superEmail}`);
  console.log(`Password: ${superPass}`);
  console.log(`-------------------------------\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
