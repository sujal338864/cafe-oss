const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const o = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, invoiceNumber: true, status: true }
  });
  console.log('LATEST ORDER:', o);
}
check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
