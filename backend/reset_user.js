const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@kiranaking.com';
  const user = await prisma.user.findFirst({ where: { email } });
  
  if (!user) {
    console.log(`❌ User ${email} not found in DB!`);
    // List some users to help diagnose
    const allUsers = await prisma.user.findMany({ take: 5 });
    console.log('Sample Users in DB:', allUsers.map(u => u.email));
    return;
  }
  
  const newPassword = 'password123'; 
  const hash = await bcrypt.hash(newPassword, 12);
  
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash }
  });
  
  console.log(`✅ Password reset SUCCESS for ${email}. New Password: ${newPassword}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
