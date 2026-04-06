const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function promote() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true }
    });
    console.log('Current Users:');
    console.table(users);

    const adminEmail = users[0]?.email; // Promote the first user as a guess if they are alone
    if (adminEmail) {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'ADMIN' }
      });
      console.log(`\n✅ Promoted ${adminEmail} to ADMIN`);
    } else {
      console.log('\n❌ No users found in database');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

promote();
