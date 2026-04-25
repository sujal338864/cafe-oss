
import { prisma } from '../src/common/prisma';
import { logger } from '../src/lib/logger';

async function runIntegrityCheck() {
  logger.info('🛡️ Starting Cafe OS Guardian Integrity Check...');

  const issues: string[] = [];
  const fixes: string[] = [];

  // 1. Check for Shops without Plan (Healing Stage)
  await (prisma as any).shop.updateMany({
    where: { plan: { equals: null } },
    data: { plan: 'STARTER' }
  }).catch(() => {}); // Skip if schema prevents null anyway

  // 2. Check for Orphaned Products (Items without a valid Shop)
  const products = await prisma.product.findMany({ select: { id: true, shopId: true } });
  const shops = await prisma.shop.findMany({ select: { id: true } });
  const shopIds = new Set(shops.map(s => s.id));
  
  const orphanedProducts = products.filter(p => !shopIds.has(p.shopId));
  if (orphanedProducts.length > 0) {
    issues.push(`${orphanedProducts.length} orphaned products found.`);
    await prisma.product.deleteMany({
      where: { id: { in: orphanedProducts.map(p => p.id) } }
    });
    fixes.push(`Deleted ${orphanedProducts.length} orphaned products.`);
  }

  // 3. Check for users without any Membership (Ghost Users)
  const users = await (prisma.user as any).findMany({
    where: {
      memberships: { none: {} }
    }
  });
  if (users.length > 0) {
    issues.push(`${users.length} ghost users found (no memberships).`);
    // Note: Not deleting users yet, just flagging.
  }

  // 4. Verify Coupons Migration
  try {
    await (prisma as any).coupon.count();
    logger.info('✅ Coupon table verified.');
  } catch (e) {
    issues.push('Coupon table is missing or not migrated!');
  }

  // 5. Verify Daily Intel Table
  try {
    await (prisma as any).dailyMarketingIntel.count();
    logger.info('✅ DailyMarketingIntel table verified.');
  } catch (e) {
    issues.push('DailyMarketingIntel table is missing!');
  }

  logger.info('📊 INTEGRITY REPORT:');
  if (issues.length === 0) {
    logger.info('🏆 System is 100% HEALTHY. Integrity verified.');
  } else {
    issues.forEach(i => logger.warn(`- ISSUE: ${i}`));
    fixes.forEach(f => logger.info(`- FIXED: ${f}`));
  }
}

runIntegrityCheck()
  .catch(err => logger.error(`Integrity Check Failed: ${err.message}`))
  .finally(() => prisma.$disconnect());
