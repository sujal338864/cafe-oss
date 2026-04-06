const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shopId = '75d506a7-0e6e-4ccf-8fcb-24075af72d63';
  const now = new Date();
  const startOfToday = new Date(now.setHours(0,0,0,0));
  
  const expenses = await prisma.expense.findMany({
    where: { 
      shopId,
      date: { gte: startOfToday }
    }
  });
  
  console.log(`Expenses for today (${startOfToday.toISOString()}):`);
  console.log(JSON.stringify(expenses, null, 2));

  const allExpenses = await prisma.expense.findMany({
    where: { shopId },
    take: 5,
    orderBy: { date: 'desc' }
  });
  console.log('Recent 5 expenses:');
  console.log(JSON.stringify(allExpenses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
