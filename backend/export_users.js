const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true }
    });
    fs.writeFileSync('db_users.txt', JSON.stringify(users, null, 2));
    console.log('Done');
  } catch (e) {
    fs.writeFileSync('db_error.txt', e.toString());
  } finally {
    await prisma.$disconnect();
  }
}

check();
