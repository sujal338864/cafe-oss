const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Use DIRECT_URL for this script to bypass possible PGBouncer issues
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL
    }
  }
});

async function main() {
  try {
    console.log('Checking Shop table...');
    const shops = await prisma.shop.findMany();
    console.log('Found %d shops.', shops.length);
    if (shops.length > 0) {
      console.log('First shop ID:', shops[0].id);
    }

    console.log('Checking Order table...');
    const orderCount = await prisma.order.count();
    console.log('Found %d orders.', orderCount);

    console.log('Checking User table...');
    const userCount = await prisma.user.count();
    console.log('Found %d users.', userCount);

    console.log('Checking Product table...');
    const productCount = await prisma.product.count();
    console.log('Found %d products.', productCount);

  } catch (err) {
    console.error('Error during data check:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
