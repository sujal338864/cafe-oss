import { PrismaClient } from '@prisma/client';
import { generateShopInsights } from './src/services/ai.service';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const run = async () => {
  const shop = await prisma.shop.findFirst();
  if (!shop) {
    console.log("No shops found in database.");
    return;
  }
  console.log(`Testing with Shop ID: ${shop.id} (${shop.name})`);
  try {
    const res = await generateShopInsights(shop.id);
    console.log("\n✅ Success! AI Insight:", res);
  } catch (e) {
    console.error("\n❌ Error generating insight:", e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

run();
