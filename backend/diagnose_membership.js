const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '&connection_limit=1'
    }
  }
});

async function main() {
  const email = 'admin@cafeosz.com';
  console.log(`Searching for user: ${email}`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { shop: true }
        }
      }
    });

    if (!user) {
      console.log('User not found.');
      return;
    }

    console.log('User ID:', user.id);
    console.log('Memberships:', JSON.stringify(user.memberships, null, 2));

    const allShops = await prisma.shop.findMany({
      select: { id: true, name: true }
    });
    console.log('All Shops in DB:', JSON.stringify(allShops, null, 2));

  } catch (err) {
    console.error('Check failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
