const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@cafeosz.com'; // Adjust if needed
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'SUPER_ADMIN' }
  });
  console.log(`User ${email} promoted to SUPER_ADMIN!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
