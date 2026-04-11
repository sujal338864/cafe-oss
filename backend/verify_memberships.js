const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const email = 'cafe999@gmail.com';
  console.log(`Checking memberships for: ${email}`);
  
  const memberships = await prisma.membership.findMany({
    where: { 
        user: { email: email.toLowerCase() } 
    },
    include: { 
        shop: {
            select: { id: true, name: true }
        } 
    }
  });

  console.log('Total Memberships Found:', memberships.length);
  memberships.forEach(m => {
    console.log(`- Shop: ${m.shop?.name} (${m.shopId}) | Role: ${m.role}`);
  });

  const userCount = await prisma.user.count({ where: { email: email.toLowerCase() } });
  console.log(`Total User records with this email: ${userCount}`);
}

check().catch(console.error).finally(() => process.exit(0));
