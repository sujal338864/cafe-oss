const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const expenses = await prisma.expense.findMany();
  console.log('Total expenses in DB:', expenses.length);
  if (expenses.length > 0) {
    console.log('First expense sample:', JSON.stringify(expenses[0], null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
