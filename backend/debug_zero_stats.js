const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shopId = '75d506a7-0e6e-4ccf-8fcb-24075af72d63'; // Cafe OS shopId from earlier
  
  const total = await prisma.order.count({ where: { shopId } });
  console.log(`Total orders for shop ${shopId}: ${total}`);
  
  const recent = await prisma.order.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, totalAmount: true, status: true, createdAt: true }
  });
  
  console.log('Recent orders:');
  console.log(JSON.stringify(recent, null, 2));
  
  const now = new Date();
  console.log(`Current server time: ${now.toISOString()}`);
  
  const startOfToday = new Date();
  startOfToday.setHours(0,0,0,0);
  console.log(`Start of today (server): ${startOfToday.toISOString()}`);
}

main().catch(console.error);
