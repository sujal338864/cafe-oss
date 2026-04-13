import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.product.findFirst({
    where: { isAvailable: true }
  });
  console.log(p);
}
