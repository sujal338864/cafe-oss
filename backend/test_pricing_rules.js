/**
 * SCRATCH SCRIPT: test_pricing_rules.js
 * Run this to see how a Happy Hour rule looks in the DB.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shopId = 'REPLACE_WITH_YOUR_SHOP_ID'; // Find this in your .env or DB
  
  const rules = {
    rules: [
      {
        name: "Morning Coffee Deal ☕",
        startsAt: "08:00",
        endsAt: "11:00",
        discountPercent: 10,
        categoryIds: [] // Leave empty for all items
      },
      {
        name: "Afternoon Happy Hour 🍰",
        startsAt: "15:00",
        endsAt: "18:00",
        discountPercent: 20
      }
    ]
  };

  console.log('Update this JSON in the Shop table -> pricingRules column');
  console.log(JSON.stringify(rules, null, 2));
  
  // Uncomment to apply to a specific shop:
  /*
  await prisma.shop.update({
    where: { id: shopId },
    data: { 
      pricingEnabled: true,
      pricingRules: rules
    }
  });
  console.log('Rules applied successfully!');
  */
}

main().catch(console.error);
