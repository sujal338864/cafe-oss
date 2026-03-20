const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'admin@kiranaking.com' } });
  if (user) {
    console.log(`--- ✅ USER FOUND ---`);
    console.log(`Correct Email: admin@kiranaking.com`);
    console.log(`Your Shop ID: ${user.shopId}`);
    console.log(`Your Menu Link: https://cafeosss.netlify.app/menu?shopId=${user.shopId}`);
  } else {
    console.log('❌ User admin@kiranaking.com not found in DB');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
