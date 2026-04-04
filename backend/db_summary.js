const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DB SUMMARY ---');
    try {
        const shops = await prisma.shop.count();
        console.log(`Shops: ${shops}`);
        const users = await prisma.user.count();
        console.log(`Users: ${users}`);
        const orders = await prisma.order.count();
        console.log(`Orders: ${orders}`);

        const userSample = await prisma.user.findFirst();
        console.log('User Sample:', JSON.stringify(userSample, (key, value) => typeof value === 'bigint' ? value.toString() : value));

        const shopSample = await prisma.shop.findFirst();
        console.log('Shop Sample:', JSON.stringify(shopSample, (key, value) => typeof value === 'bigint' ? value.toString() : value));

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
