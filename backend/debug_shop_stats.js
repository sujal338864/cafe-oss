const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@cafeosz.com' },
    include: { shop: true }
  });
  
  if (user) {
    console.log(`User: ${user.email}`);
    console.log(`ShopId in User record: ${user.shopId}`);
    console.log(`Shop Name: ${user.shop.name}`);
    
    // Check orders for this shop
    const count = await prisma.order.count({
      where: { shopId: user.shopId }
    });
    console.log(`Total orders for shopId ${user.shopId}: ${count}`);
    
    const todayCount = await prisma.order.count({
      where: { 
        shopId: user.shopId,
        createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) }
      }
    });
    console.log(`Today's orders: ${todayCount}`);
  } else {
    console.log('User admin@cafeosz.com not found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
