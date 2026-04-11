const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const email = 'admin@cafeosz.com';
  console.log(`🛠️ REPAIRING VISIBILITY FOR: ${email}`);
  
  try {
    // 1. Find all shop IDs where a user with this email exists
    const users = await prisma.user.findMany({
      where: { email },
      select: { id: true, shopId: true, name: true }
    });
    
    console.log(`✅ Found ${users.length} user records associated with ${email}.`);
    
    const shopIds = [...new Set(users.map(u => u.shopId))];
    const userIds = users.map(u => u.id);
    
    console.log(`✅ Shops detected: ${shopIds.join(', ')}`);
    console.log(`✅ User identities detected: ${userIds.join(', ')}`);

    let linkedCount = 0;
    
    // 2. For EVERY user identity, link it to EVERY shop that this email belongs to.
    // This ensures that regardless of which User record 'login' finds, they see ALL shops.
    for (const userId of userIds) {
      for (const shopId of shopIds) {
        // Upsert membership
        await prisma.membership.upsert({
          where: { userId_shopId: { userId, shopId } },
          update: { isActive: true, role: 'ADMIN' },
          create: {
            userId,
            shopId,
            role: 'ADMIN',
            isActive: true
          }
        });
        linkedCount++;
      }
    }

    console.log(`✅ SUCCESSFULLY LINKED ${linkedCount} SHOP-USER COMBINATIONS.`);
    console.log('--- REPAIR COMPLETE ---');
    console.log('The user should now be able to use the "Switch Shop" dropdown to access their old shop.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ REPAIR FAILED:', err);
    process.exit(1);
  }
}

fix();
