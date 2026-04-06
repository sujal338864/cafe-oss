
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  try {
    const users = await prisma.user.findMany({ select: { email: true, name: true, role: true } });
    const shops = await prisma.shop.findMany({ select: { name: true, email: true } });
    const output = `USERS:\n${JSON.stringify(users, null, 2)}\n\nSHOPS:\n${JSON.stringify(shops, null, 2)}`;
    fs.writeFileSync('C:\\Users\\Lenovo\\Downloads\\files\\backend\\DUMP.txt', output);
  } catch (e) {
    fs.writeFileSync('C:\\Users\\Lenovo\\Downloads\\files\\backend\\DUMP.txt', 'ERR: ' + e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
