const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function dump() {
  console.log('Dumping current data to current_db_backup.json...');
  const shops = await prisma.shop.findMany();
  const users = await prisma.user.findMany();
  const products = await prisma.product.findMany();
  const expenses = await prisma.expense.findMany();
  
  const backup = { shops, users, products, expenses };
  fs.writeFileSync('current_db_backup.json', JSON.stringify(backup, null, 2));
  console.log('Dump complete!');
}

dump().finally(() => prisma.$disconnect());
