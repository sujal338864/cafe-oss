const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

async function disableRLS() {
  console.log('🚧 RESTORING VISIBILITY: Disabling Row Level Security...');
  const tables = [
    'Shop', 'User', 'Category', 'Product', 'Customer', 'Supplier',
    'Order', 'Purchase', 'Expense', 'OrderItem', 'PurchaseItem', 'StockHistory'
  ];

  try {
    for (const table of tables) {
      console.log(`- Disabling RLS on "${table}"...`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
    }
    console.log('✅ RLS Disabled. Data visibility should be restored.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Failed to disable RLS:', e);
    process.exit(1);
  }
}

disableRLS();
