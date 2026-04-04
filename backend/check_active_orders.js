const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const activeStatuses = ['PENDING', 'PREPARING', 'READY'];
  const orders = await prisma.order.findMany({
    where: { status: { in: activeStatuses } },
    select: { id: true, invoiceNumber: true, status: true, customerName: true }
  });
  console.log('Active Kitchen Orders in DB:', JSON.stringify(orders, null, 2));
  process.exit(0);
}

check();
