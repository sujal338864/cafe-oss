const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- FIXING USER LINK ---');
  
  // Find the primary admin user
  const user = await prisma.user.findFirst({
    where: { email: 'cafe@0000gmail.com' }
  });

  if (!user) {
    console.log('User not found.');
    return;
  }

  console.log(`Found User: ${user.name} (${user.id})`);
  console.log(`Current shopId: ${user.shopId}`);

  if (!user.shopId) {
    // Find the primary shop
    const shop = await prisma.shop.findFirst();
    if (!shop) {
      console.log('No shops found in database.');
      return;
    }
    
    console.log(`Linking to Shop: ${shop.name} (${shop.id})`);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { shopId: shop.id }
    });
    
    console.log('--- LINK FIXED ---');
  } else {
    console.log('User already has a shopId. Checking if shop exists...');
    const shop = await prisma.shop.findUnique({ where: { id: user.shopId } });
    if (!shop) {
      console.log('Shop does not exist! Finding any shop...');
      const anyShop = await prisma.shop.findFirst();
      if (anyShop) {
        await prisma.user.update({
          where: { id: user.id },
          data: { shopId: anyShop.id }
        });
        console.log(`Re-linked to shop: ${anyShop.id}`);
      }
    } else {
      console.log('Shop exists and is linked. Auth should work.');
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
