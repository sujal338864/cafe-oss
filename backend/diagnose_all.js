const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, plan: true, shopId: true }
    });
    console.log('--- ALL USERS ---');
    console.table(users);

    const shops = await prisma.shop.findMany({
      select: { id: true, name: true, plan: true, ownerName: true }
    });
    console.log('\n--- ALL SHOPS ---');
    console.table(shops);

    const memberships = await prisma.shopMember.findMany({
      include: {
        user: { select: { email: true } },
        shop: { select: { name: true } }
      }
    });
    console.log('\n--- ALL MEMBERSHIPS ---');
    console.table(memberships.map(m => ({
      user: m.user.email,
      shop: m.shop.name,
      role: m.role,
      isActive: m.isActive
    })));

  } catch (err) {
    console.error('Diagnosis failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
