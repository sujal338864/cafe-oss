
import { prisma } from '../common/prisma';
import { PLAN_LIMITS, PlanName } from '../config/plans';

export const SubscriptionService = {
  /**
   * Check if a shop can add a new resource based on its plan.
   * type: 'products' | 'branches' | 'staff'
   */
  canAddResource: async (shopId: string, type: 'products' | 'branches' | 'staff'): Promise<{ allowed: boolean; reason?: string }> => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { plan: true, organizationId: true }
    });

    if (!shop) throw new Error('Shop not found');
    const plan = (shop.plan || 'STARTER') as PlanName;
    const limits = PLAN_LIMITS[plan];

    if (type === 'products') {
      const count = await prisma.product.count({ where: { shopId } });
      if (count >= limits.maxProducts) {
        return { allowed: false, reason: `Plan limit reached: ${plan} allows only ${limits.maxProducts} products.` };
      }
    }

    if (type === 'staff') {
      const count = await prisma.membership.count({ where: { shopId, isActive: true } });
      if (count >= limits.maxStaff) {
        return { allowed: false, reason: `Plan limit reached: ${plan} allows only ${limits.maxStaff} staff members.` };
      }
    }

    if (type === 'branches' && shop.organizationId) {
      const count = await prisma.shop.count({ where: { organizationId: shop.organizationId, isActive: true } });
      if (count >= limits.maxBranches) {
        return { allowed: false, reason: `Plan limit reached: ${plan} allows only ${limits.maxBranches} branches.` };
      }
    }

    return { allowed: true };
  },

  /**
   * Check if a feature is enabled for a shop's plan
   */
  isFeatureEnabled: async (shopId: string, feature: keyof typeof PLAN_LIMITS['STARTER']['features']): Promise<boolean> => {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { plan: true }
    });
    const plan = (shop?.plan || 'STARTER') as PlanName;
    return PLAN_LIMITS[plan].features[feature];
  }
};
