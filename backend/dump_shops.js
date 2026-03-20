const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shops = await prisma.shop.findMany();
  console.log('--- ALL SHOPS ---');
  console.log(JSON.stringify(shops.map(s => ({ id: s.id, name: s.name, plan: s.plan })), null, 2));
}

main();
