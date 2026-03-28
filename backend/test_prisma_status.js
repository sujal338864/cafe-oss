const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const o1 = await prisma.order.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log('Last 3 orders status:', o1.map(o => o.status));

  const o2 = await prisma.order.findMany({ where: { status: { in: ['PENDING', 'PREPARING', 'READY'] } } });
  console.log('Kitchen orders count:', o2.length);
  process.exit(0);
}
run();
