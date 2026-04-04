import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('--- DB DIAGNOSTIC ---');
  try {
    const shopCount = await prisma.shop.count();
    console.log(`Total Shops: ${shopCount}`);

    const shops = await prisma.shop.findMany({
      select: { 
        id: true, 
        name: true, 
        _count: { select: { orders: true, products: true, customers: true } } 
      }
    });
    console.log('Shop Stats:', JSON.stringify(shops, null, 2));

    if (shops.length > 0) {
      const sid = shops[0].id;
      const orderSample = await prisma.order.findMany({
        where: { shopId: sid },
        take: 1,
        orderBy: { createdAt: 'desc' }
      });
      console.log(`Latest Order for ${sid}:`, JSON.stringify(orderSample, null, 2));
    }
  } catch (e) {
    console.error('Diagnostic failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
