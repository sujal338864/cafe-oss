import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../index';

export const checkPlan = (requiredPlan: 'PRO' | 'ENTERPRISE') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const shopId = req.user!.shopId;
      const cacheKey = `shop_plan:${shopId}`;

      // 1. Try Cache
      try {
        const { redis } = await import('../lib/redis');
        const cachedPlan = await redis.get(cacheKey);
        if (cachedPlan) {
           return continueWithPlan(cachedPlan as any, requiredPlan, res, next);
        }
      } catch (e) { /* Redis offline; continue to DB */ }
      
      // 2. Fallback to DB
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { plan: true }
      });

      if (!shop) return res.status(404).json({ error: 'Shop not found' });

      // 3. Set Cache (300s TTL)
      try {
        const { redis } = await import('../lib/redis');
        await redis.setex(cacheKey, 300, shop.plan);
      } catch (e) { /* Silent fail */ }

      return continueWithPlan(shop.plan, requiredPlan, res, next);
    } catch (e) {
      next(e);
    }
  };
};

const continueWithPlan = (currentPlan: string, requiredPlan: string, res: Response, next: NextFunction) => {
  const tiers = { STARTER: 0, PRO: 1, ENTERPRISE: 2 };
  const currentPlanLevel = tiers[currentPlan as keyof typeof tiers] ?? 0;
  const requiredPlanLevel = tiers[requiredPlan as keyof typeof tiers] ?? 0;

  if (currentPlanLevel < requiredPlanLevel) {
    return res.status(403).json({
      status: 'UPGRADE_REQUIRED',
      message: `This feature is locked. Please upgrade to ${requiredPlan} to unlock Advanced Analytics & AI.`
    });
  }

  next();
};
