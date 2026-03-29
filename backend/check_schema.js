const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected!');
    
    // Check if Shop table has pricingEnabled
    const shop = await prisma.shop.findFirst({
        select: { id: true }
    });
    
    if (shop) {
        console.log(`✅ Shop found: ${shop.id}`);
        try {
            const fullShop = await prisma.shop.findFirst({
                select: { id: true, pricingEnabled: true }
            });
            console.log('✅ SUCCESS: pricingEnabled column exists!');
            console.log('Value:', fullShop.pricingEnabled);
        } catch (e) {
            console.error('❌ FAILURE: pricingEnabled column is MISSING!');
            console.error(e.message);
        }
    }
    
  } catch (err) {
    console.error('❌ DB CONNECTION FAILURE:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
