const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const email = 'admin@cafeosz.com';
  console.log(`🔍 FINDING ALL SHOPS FOR: ${email}`);
  try {
    const users = await prisma.user.findMany({
      where: { email },
      include: { shop: true }
    });
    
    console.log(`✅ Found ${users.length} user records:`);
    users.forEach(u => {
      console.log(`- Shop: ${u.shop.name} (ID: ${u.shopId}) - Role: ${u.role}`);
    });

    const memberships = await prisma.membership.findMany({
      where: { user: { email } },
      include: { shop: true }
    });
    console.log(`✅ Found ${memberships.length} memberships:`);
    memberships.forEach(m => {
      console.log(`- Member of: ${m.shop.name} (ID: ${m.shopId}) - Role: ${m.role}`);
    });

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}
check();
