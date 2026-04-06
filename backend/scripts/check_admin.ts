
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@cafeosz.com' }
  });
  console.log('User found:', !!user);
  if (user) {
    console.log('Role:', user.role);
    console.log('Has Password Hash:', !!user.passwordHash);
    console.log('Shop ID:', user.shopId);
  }
  await prisma.$disconnect();
}

main();
