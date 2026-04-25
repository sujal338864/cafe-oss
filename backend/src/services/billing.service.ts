
import { prisma } from '../common/prisma';
import { PlanName } from '../config/plans';
import { logger } from '../lib/logger';

// Mock Gateway Interaction (Stripe/Razorpay ready)
export const BillingService = {
  /**
   * Initialize a checkout session for a plan upgrade
   */
  createCheckoutSession: async (shopId: string, targetPlan: PlanName) => {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');

    logger.info(`[BILLING] Initializing ${targetPlan} checkout for shop ${shopId}`);

    // In a real scenario, you'd call Stripe/Razorpay here:
    // const session = await stripe.checkout.sessions.create({ ... });
    
    // For now, we return a mock URL and transition ID
    return {
      success: true,
      checkoutUrl: `https://checkout.cafeos.com/pay?shopId=${shopId}&plan=${targetPlan}`,
      transactionId: `TXN_${Date.now()}`
    };
  },

  /**
   * Handle successful payment (Webhook Target)
   */
  finalizePlanUpgrade: async (shopId: string, plan: PlanName) => {
    logger.info(`[BILLING] Finalizing upgrade to ${plan} for shop ${shopId}`);

    await prisma.shop.update({
      where: { id: shopId },
      data: { plan }
    });

    // Invalidate plan cache
    try {
      const { redis } = await import('../lib/redis');
      await redis.del(`shop_plan:${shopId}`);
    } catch (e) { /* Redis skip */ }

    return { success: true, newPlan: plan };
  }
};
