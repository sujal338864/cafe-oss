const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();

async function test() {
  const shopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
  try {
    console.log('--- JS DIAGNOSTIC START ---');
    
    console.log('1. Counting Total Orders...');
    const totalOrders = await prisma.order.count({ where: { shopId, status: 'COMPLETED' } });
    console.log('-> Total Orders:', totalOrders);

    console.log('2. Aggregating Revenue...');
    const revenueAgg = await prisma.order.aggregate({ where: { shopId, status: 'COMPLETED' }, _sum: { totalAmount: true } });
    console.log('-> Revenue Agg:', revenueAgg);

    console.log('3. Counting Customers...');
    const totalCustomers = await prisma.customer.count({ where: { shopId } });
    console.log('-> Customers:', totalCustomers);

    console.log('4. Counting Products...');
    const totalProducts = await prisma.product.count({ where: { shopId } });
    console.log('-> Products:', totalProducts);

    console.log('\n--- ALL STATS GATHERED SUCCESSFULLY ---');
    process.exit(0);
  } catch (e) {
    console.error('\n--- CRASHED ---');
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
