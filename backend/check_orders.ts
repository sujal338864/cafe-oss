import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function checkOrders() {
  const shops = await prisma.shop.findMany({ take: 5 });
  const targetShopId = shops[0]?.id;
  if (!targetShopId) {
    console.log('No shops found');
    return;
  }

  const count = await prisma.order.count({ where: { shopId: targetShopId } });
  console.log('Actual Order Count in DB for shop', targetShopId, 'is:', count);

  await prisma.$disconnect();
  process.exit(0);
}

checkOrders();
