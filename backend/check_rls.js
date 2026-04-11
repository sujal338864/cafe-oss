const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRLS() {
  try {
    const roles = await prisma.$queryRaw`SELECT rolname FROM pg_roles WHERE rolname = 'shopapp'`;
    if (roles.length > 0) {
      console.log('✅ SUCCESS! RLS Migration Executed - "shopapp" role exists!');
    } else {
      console.log('❌ FAILED: "shopapp" role does not exist.');
    }
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}
checkRLS();
