
import { prisma } from '../src/common/prisma';
import { GrowthService } from '../src/services/growth.service';
import { logger } from '../src/lib/logger';

async function testROIAnalytics() {
  logger.info('🚀 Starting ROI Analytics Stress Test...');

  // 1. Pick a shop with products
  const productSample = await prisma.product.findFirst({ select: { shopId: true } });
  if (!productSample) throw new Error('No products found in database to test with.');
  const shopId = productSample.shopId;

  // 2. Create a test coupon
  const code = `PROMO_${Date.now()}`;
  const coupon = await GrowthService.createCoupon(shopId, {
    code,
    type: 'PERCENTAGE',
    value: 10,
    minOrder: 100,
    isActive: true,
    description: 'Automated Test Coupon'
  });

  logger.info(`✅ Coupon created: ${code}`);

  // 2.5 Find a user to attribute orders to
  const user = await prisma.user.findFirst({ where: { shopId } });
  if (!user) throw new Error('No user found in this shop.');

  // 2.7 Find a product to sell
  const product = await prisma.product.findFirst({ where: { shopId } });
  if (!product) throw new Error('No product found in this shop.');

  // 3. Create mock orders
  const orderCount = 5;
  const singleOrderAmount = 500;
  
  logger.info(`💸 Simulating ${orderCount} orders...`);

  for (let i = 0; i < orderCount; i++) {
    await prisma.order.create({
      data: {
        shopId,
        userId: user.id,
        totalAmount: singleOrderAmount - 50, // 10% of 500 = 50
        subtotal: singleOrderAmount,
        status: 'COMPLETED',
        couponId: coupon.id,
        couponDiscount: 50,
        invoiceNumber: `TEST-ROI-${Date.now()}-${i}`,
        items: {
          create: [{
            productId: product.id,
            name: product.name,
            quantity: 1,
            costPrice: product.costPrice || 200,
            unitPrice: singleOrderAmount,
            total: singleOrderAmount
          }]
        }
      } as any
    });
  }

  // 4. Verify Analytics
  const analytics = await GrowthService.getCouponAnalytics(shopId);
  const myStat = analytics.find(a => a.id === coupon.id);

  if (!myStat) throw new Error('Coupon not found in analytics output.');

  const expectedRevenue = (singleOrderAmount - 50) * orderCount;
  const expectedDiscount = 50 * orderCount;

  logger.info('📊 RESULT:');
  logger.info(`- Reported Revenue: ₹${myStat.revenue}`);
  logger.info(`- Expected Revenue: ₹${expectedRevenue}`);
  logger.info(`- Reported Discount: ₹${myStat.totalDiscount}`);
  logger.info(`- Expected Discount: ₹${expectedDiscount}`);
  logger.info(`- Usage Count: ${myStat.usageCount}`);

  if (myStat.revenue === expectedRevenue && myStat.totalDiscount === expectedDiscount) {
    logger.info('🏆 TEST PASSED: ROI Engine is mathematically accurate.');
  } else {
    logger.error('❌ TEST FAILED: Math mismatch in analytics engine.');
  }

  // Cleanup: deleted the test orders and coupon to keep DB clean
  await (prisma.order as any).deleteMany({ where: { couponId: coupon.id } });
  await GrowthService.deleteCoupon(shopId, coupon.id);
  logger.info('🧹 Cleanup complete.');
}

testROIAnalytics()
  .catch(err => logger.error(`Error: ${err.message}`))
  .finally(() => prisma.$disconnect());
