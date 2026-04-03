const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const counts = {
      shops: await prisma.shop.count(),
      users: await prisma.user.count(),
      members: await prisma.shopMember.count(),
      products: await prisma.product.count(),
      orders: await prisma.order.count(),
      customers: await prisma.customer.count(),
      categories: await prisma.category.count(),
    };
    console.log('Table Counts:', JSON.stringify(counts, null, 2));

    const shops = await prisma.shop.findMany({
      include: {
        _count: {
          select: { orders: true, products: true, members: true }
        }
      }
    });
    console.log('Shops Detail:', JSON.stringify(shops, null, 2));

    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: { shop: { select: { name: true } } }
        }
      }
    });
    console.log('Users Detail:', JSON.stringify(users, null, 2));

  } catch (e) {
    console.error('Error fetching data:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
