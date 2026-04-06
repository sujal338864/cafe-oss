const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, shopId: true }
    });
    fs.writeFileSync('db_users_dump.json', JSON.stringify(users, null, 2));
    console.log('Dumped ' + users.length + ' users');
  } catch (err) {
    fs.writeFileSync('db_users_dump.json', JSON.stringify({ error: err.message }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
