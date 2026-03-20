import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const shopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
  try {
    console.log('--- DIAGNOSTIC START ---');
    
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

    console.log('5. counting Low Stock...');
    // Handling possible missing lowStockAlert column safely
    const lowStockItems = await prisma.product.count({ where: { shopId, stock: { lte: 5 } } }).catch(() => 0);
    console.log('-> Low Stock:', lowStockItems);

    console.log('6. Querying orderItem groupBy...');
    const topProductsRaw = await prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { shopId, status: 'COMPLETED' } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10
    });
    console.log('-> Top Products Raw count:', topProductsRaw.length);

    console.log('7. Executing Category Breakdown $queryRaw...');
    const categoryBreakdownRaw: any[] = await prisma.$queryRaw`
      SELECT c.name, SUM(oi.total) as revenue 
      FROM "Category" c 
      JOIN "Product" p ON p."categoryId" = c.id 
      JOIN "OrderItem" oi ON oi."productId" = p.id 
      JOIN "Order" o ON o.id = oi."orderId" 
      WHERE o."shopId" = ${shopId} AND o.status::text = 'COMPLETED' 
      GROUP BY c.name 
      ORDER BY revenue DESC
    `;
    console.log('-> Category Breakdown $queryRaw count:', categoryBreakdownRaw.length);

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
