const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateKitchenStatus() {
  console.log('Migrating legacy string-based kitchen notes to native KitchenStatus enum...');
  
  // Find all orders with [KITCHEN:] tag
  const orders = await prisma.order.findMany({
    where: { notes: { contains: '[KITCHEN:' } }
  });

  console.log(`Found ${orders.length} orders to migrate.`);
  
  let migrated = 0;
  for (const order of orders) {
    const match = order.notes?.match(/\[KITCHEN:(PENDING|PREPARING|READY|COMPLETED)\]/);
    if (match) {
      const status = match[1];
      const newNotes = order.notes.replace(/\[KITCHEN:[A-Z]+\]\s*/, '') || null;
      
      await prisma.order.update({
        where: { id: order.id },
        data: {
          kitchenStatus: status,
          notes: newNotes
        }
      });
      migrated++;
    }
  }
  
  console.log(`Successfully migrated ${migrated} orders to native enum.`);
  await prisma.$disconnect();
}

migrateKitchenStatus().catch(e => {
  console.error(e);
  process.exit(1);
});
