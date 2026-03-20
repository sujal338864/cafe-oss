const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
dotenv.config();
const prisma = new PrismaClient();

async function test() {
  try {
    const shopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
    const users = await prisma.user.findMany({ 
      where: { shopId },
      select: { email: true, name: true, shop: { select: { name: true } } } 
    });
    console.log('--- USERS FOR SHOP ID ---');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
test();
