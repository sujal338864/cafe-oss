const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMemberships() {
  console.log('🔍 Scanning Membership Links for admin@cafeosz.com...\n');
  
  const users = await prisma.user.findMany({
    where: { email: 'admin@cafeosz.com' },
    include: {
      memberships: {
        include: {
          shop: true
        }
      }
    }
  });

  console.log(`Found ${users.length} user identities for this email.`);
  
  users.forEach((user, idx) => {
    console.log(`\n--- Identity #${idx + 1} (ID: ${user.id}) ---`);
    user.memberships.forEach(m => {
      console.log(` - Connected to Shop: "${m.shop.name}" (ID: ${m.shopId}) as ${m.role}`);
    });
  });

  await prisma.$disconnect();
}

checkMemberships();
