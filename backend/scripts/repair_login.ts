
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@cafeosz.com';
  const password = 'Pass123456@';
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.findFirst({
    where: { email },
    include: { shop: true }
  });

  if (!user) {
    console.error(`User ${email} not found!`);
    const all = await prisma.user.findMany({ select: { email: true } });
    console.log('Available users:', all.map(u => u.email).join(', '));
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { 
      passwordHash: hash,
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log(`✅ REPAIR COMPLETE for ${email}`);
  console.log(`- Password set to: ${password}`);
  console.log(`- Role set to: ADMIN`);
  console.log(`- Shop: ${user.shop.name}`);
  await prisma.$disconnect();
}

main();
