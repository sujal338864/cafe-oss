const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// SINGLE CONNECTION to prevent pool exhaustion
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '&connection_limit=1'
    }
  }
});

async function main() {
  try {
    console.log('--- Database Integrity Report ---');
    const shops = await prisma.shop.findMany({ select: { id: true, name: true } });
    console.log(`Shops: ${shops.length}`);
    shops.forEach(s => console.log(` - ${s.name} (${s.id})`));

    const users = await prisma.user.count();
    console.log(`Users: ${users}`);

    const members = await prisma.shopMember.count();
    console.log(`Memberships: ${members}`);

    const orders = await prisma.order.count();
    console.log(`Orders: ${orders}`);

    const products = await prisma.product.count();
    console.log(`Products: ${products}`);

    const customers = await prisma.customer.count();
    console.log(`Customers: ${customers}`);

  } catch (err) {
    console.error('Check failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
