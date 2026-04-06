const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fixing enums in database using Prisma raw execution...');
  try {
    // 1. Update User table roles from OWNER -> ADMIN, SUPERADMIN -> ADMIN
    await prisma.$executeRawUnsafe(`UPDATE "User" SET role = 'ADMIN' WHERE role::text = 'OWNER' OR role::text = 'SUPERADMIN'`);
    console.log('User roles updated to ADMIN! Now prisma db push will succeed without enum conflict errors on existing data.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
