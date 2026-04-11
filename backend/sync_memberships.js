const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sync() {
  console.log('🔄 Syncing legacy User roles to Membership table...');
  try {
    const users = await prisma.user.findMany();
    let count = 0;
    
    for (const user of users) {
      // Upsert membership to ensure legacy user has a representation in the new table
      await prisma.membership.upsert({
        where: { userId_shopId: { userId: user.id, shopId: user.shopId } },
        update: { role: user.role, isActive: user.isActive },
        create: {
          userId: user.id,
          shopId: user.shopId,
          role: user.role,
          isActive: user.isActive
        }
      });
      count++;
    }
    
    console.log(`✅ Successfully synced ${count} memberships.`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Sync failed:', e);
    process.exit(1);
  }
}

sync();
