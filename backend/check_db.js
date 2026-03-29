const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const shops = await prisma.shop.findMany({
      select: { id: true, name: true }
    });
    console.log('--- ALL SHOPS ---');
    console.table(shops);
    
    const targetId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
    const match = shops.find(s => s.id === targetId);
    if (match) {
      console.log(`✅ MATCH FOUND: ${match.name}`);
    } else {
      console.log(`❌ NO MATCH for ${targetId}`);
    }
    
  } catch (err) {
    console.error('❌ DB ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
