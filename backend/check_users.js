const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, name: true, role: true }
    });
    console.log('USERS IN DB:');
    console.table(users || []);
  } catch (err) {
    console.error('DATABASE ERROR:', err.message);
  } finally {
    process.exit();
  }
}

main();
