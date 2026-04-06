
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@cafeosz.com';
  const pass = 'admin123';
  const hash = await bcrypt.hash(pass, 12);

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error(`User ${email} NOT found in database!`);
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

  console.log(`✅ SUCCESS: '${email}' password set to '${pass}'`);
  await prisma.$disconnect();
}

main();
