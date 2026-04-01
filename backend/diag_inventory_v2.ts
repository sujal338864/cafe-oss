import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function diag() {
  const shops = await prisma.shop.findMany({ take: 5 });
  console.log('Shops found:', shops.map(s => ({ id: s.id, name: s.name })));
  
  const targetShopId = shops[0]?.id;
  if (!targetShopId) {
    console.log('No shops found');
    return;
  }

  console.log('Auditing Shop:', targetShopId);

  const allProducts = await prisma.product.findMany({
    where: { shopId: targetShopId }
  });

  const activeSum = allProducts
    .filter(p => p.isActive)
    .reduce((s, p) => s + (Number(p.costPrice) * p.stock), 0);

  const inactiveSum = allProducts
    .filter(p => !p.isActive)
    .reduce((s, p) => s + (Number(p.costPrice) * p.stock), 0);

  console.log('--- Product Audit ---');
  console.log('Total Products:', allProducts.length);
  console.log('Active Products:', allProducts.filter(p => p.isActive).length);
  console.log('Inactive Products:', allProducts.filter(p => !p.isActive).length);
  console.log('Active Inventory Value:', activeSum);
  console.log('Inactive Inventory Value:', inactiveSum);
  console.log('Total Dashboard Value (All):', activeSum + inactiveSum);

  const ordersCount = await prisma.order.count({ where: { shopId: targetShopId } });
  console.log('--- Order Audit ---');
  console.log('Total Orders in Database:', ordersCount);

  await prisma.$disconnect();
  process.exit(0);
}

diag();
