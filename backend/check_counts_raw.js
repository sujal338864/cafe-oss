const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const orders = await prisma.$queryRaw`SELECT count(*) FROM "Order"`;
    const users = await prisma.$queryRaw`SELECT count(*) FROM "User"`;
    const shops = await prisma.$queryRaw`SELECT count(*) FROM "Shop"`;
    const members = await prisma.$queryRaw`SELECT count(*) FROM "ShopMember"`;
    const products = await prisma.$queryRaw`SELECT count(*) FROM "Product"`;

    console.log('Orders:', orders);
    console.log('Users:', users);
    console.log('Shops:', shops);
    console.log('Members:', members);
    console.log('Products:', products);
  } catch (e) {
    console.error('Raw query error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
