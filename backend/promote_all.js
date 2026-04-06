const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promoteAll() {
  try {
    const updated = await prisma.user.updateMany({
      data: { role: 'ADMIN' }
    });
    console.log(`✅ Promoted ${updated.count} users to ADMIN`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

promoteAll();
