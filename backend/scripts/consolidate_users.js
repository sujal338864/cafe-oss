/**
 * CONSOLIDATE USERS SCRIPT
 * 
 * Goal: Transform "One User per Shop" to "One Global User with Multi-Shop Memberships"
 * 
 * Logic:
 * 1. Find all users grouping by email.
 * 2. For each unique email:
 *    - Pick the "Primary" user (the one with latest lastLogin or oldest createdAt).
 *    - For all other "Secondary" users with the same email:
 *      - Link their Shop as a Membership for the Primary user.
 *      - Repoint their Orders to the Primary userId.
 *      - Delete the Secondary user record.
 * 3. Ensure every user has a Membership record for their current shopId.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- STARTING USER CONSOLIDATION ---');

  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${allUsers.length} total user records.`);

  const usersByEmail = {};
  allUsers.forEach(u => {
    if (!usersByEmail[u.email]) usersByEmail[u.email] = [];
    usersByEmail[u.email].push(u);
  });

  const emails = Object.keys(usersByEmail);
  console.log(`Identified ${emails.length} unique emails.`);

  for (const email of emails) {
    const duplicates = usersByEmail[email];
    
    // 1. Pick primary (oldest one or latest login)
    // For now, oldest one is fine as it's likely the original owner/account.
    const primary = duplicates[0];
    const others = duplicates.slice(1);

    console.log(`Email [${email}]: ${duplicates.length} records. Primary ID: ${primary.id}`);

    // Inside a transaction for safety
    await prisma.$transaction(async (tx) => {
      
      // Ensure primary has membership for their own shop
      await tx.membership.upsert({
        where: { userId_shopId: { userId: primary.id, shopId: (primary).shopId } },
        update: {},
        create: {
          userId: primary.id,
          shopId: (primary).shopId,
          role: (primary).role || 'ADMIN',
          isActive: true
        }
      });

      // Process secondary users
      for (const second of others) {
          const shopId = (second).shopId;
          const role = (second).role || 'EMPLOYEE';

          console.log(`  Merging secondary User ID: ${second.id} (Shop: ${shopId})`);

          // A. Create/Upsert membership for Primary User in this shop
          await tx.membership.upsert({
            where: { userId_shopId: { userId: primary.id, shopId: shopId } },
            update: { role: role },
            create: {
              userId: primary.id,
              shopId: shopId,
              role: role,
              isActive: second.isActive
            }
          });

          // B. Re-point Orders
          await tx.order.updateMany({
            where: { userId: second.id },
            data: { userId: primary.id }
          });

          // C. Re-point Memberships (if any existed for the secondary record, highly unlikely but safe)
          // Actually, we should just delete them after ensuring primary has them.
          
          // D. Delete secondary user
          await tx.user.delete({
            where: { id: second.id }
          });
      }
    });
  }

  console.log('--- CONSOLIDATION COMPLETE ---');
}

run()
  .catch(e => {
    console.error('CONSOLIDATION FAILED:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
