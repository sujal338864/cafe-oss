const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugMenu() {
  const shopId = 'd8bd17c9-c001-4d56-8351-2c73214083d1';
  console.log(`Checking shopId: ${shopId}`);
  
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, logoUrl: true, currency: true, pricingEnabled: true, pricingRules: true }
    });
    
    if (!shop) {
      console.log('❌ Shop NOT found');
      return;
    }
    console.log('✅ Shop found:', shop.name);
    
    const products = await prisma.product.findMany({
      where: { shopId, isActive: true },
      select: { id: true, name: true, sellingPrice: true, stock: true }
    });
    console.log(`✅ Found ${products.length} products`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

debugMenu();
