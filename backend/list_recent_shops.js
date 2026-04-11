const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const shops = await prisma.shop.findMany({
        where: { email: 'cafe999@gmail.com' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, createdAt: true }
    });
    console.log(JSON.stringify(shops, null, 2));
}

run().catch(console.error).finally(() => process.exit(0));
