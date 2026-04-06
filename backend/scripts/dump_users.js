
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { email: true, role: true, shop: { select: { name: true } } }
    });
    fs.writeFileSync('C:\\Users\\Lenovo\\Downloads\\files\\backend\\users_found.txt', JSON.stringify(users, null, 2));
    console.log('✅ Users written to users_found.txt');
  } catch (e) {
    fs.writeFileSync('C:\\Users\\Lenovo\\Downloads\\files\\backend\\users_found.txt', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
