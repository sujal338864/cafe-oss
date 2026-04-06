
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  try {
    const email = 'admin@kiranaking.com';
    const pass = 'admin123';
    const hash = await bcrypt.hash(pass, 12);

    const user = await prisma.user.findFirst({ where: { email }, include: { shop: true } });
    if (!user) {
      console.log(`❌ ERROR: User ${email} not found in database!`);
      const all = await prisma.user.findMany({ select: { email: true } });
      console.log('Available emails:', all.map(u => u.email));
      return;
    }

    console.log(`Found user: ${user.email} in shop ${user.shop.name}`);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, role: 'ADMIN', isActive: true }
    });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    const isMatch = await bcrypt.compare(pass, updated.passwordHash);

    console.log(`✅ Success: ${email} password reset to ${pass}`);
    console.log(`✅ Verification: Password hash match? ${isMatch}`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
