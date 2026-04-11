const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function ping() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log("Ping success:", result);
    process.exit(0);
  } catch (e) {
    console.error("Ping failed:", e);
    process.exit(1);
  }
}
ping();
