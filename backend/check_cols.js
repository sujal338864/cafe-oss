const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  try {
    const u = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User'`;
    const s = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'Shop'`;
    const res = { user: u.map(c => c.column_name), shop: s.map(c => c.column_name) };
    fs.writeFileSync('check_cols_out.json', JSON.stringify(res, null, 2));
    console.log('Results written to check_cols_out.json');
  } catch (e) {
    fs.writeFileSync('check_cols_out.json', JSON.stringify({ error: e.message, stack: e.stack }));
    console.error('ERROR CHECKING COLUMNS:', e);
  } finally {
    await prisma.$disconnect();
  }
}
check();

