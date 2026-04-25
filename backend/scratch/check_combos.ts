import { PrismaClient } from '../src/generated/client';
const prisma = new PrismaClient();

async function main() {
  const combos = await prisma.combo.findMany();
  console.log(JSON.stringify(combos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
