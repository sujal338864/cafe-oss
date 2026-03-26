const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
  .then(console.log)
  .finally(() => prisma.$disconnect());
