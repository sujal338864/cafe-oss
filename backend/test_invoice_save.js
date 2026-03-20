const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const shop = await prisma.shop.findFirst();
    if (!shop) { console.log('No shop found'); return; }
    
    console.log('Found shop:', shop.id, shop.name);
    
    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: { invoiceSettings: '{"template": "standard"}' }
    });
    
    console.log('✅ Update Success!', updated.invoiceSettings);
  } catch (e) {
    console.error('❌ Update Failed Details:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
