const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@cafeosz.com' }
  });
  console.log('User shopId:', user.shopId);
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id }
  });
  console.log('User memberships:', JSON.stringify(memberships, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
