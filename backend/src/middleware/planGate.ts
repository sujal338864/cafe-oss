import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../index';

export const checkPlan = (requiredPlan: 'PRO' | 'ENTERPRISE') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const shopId = req.user!.shopId;
      
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { plan: true }
      });

      if (!shop) return res.status(404).json({ error: 'Shop not found' });

      const tiers = { STARTER: 0, PRO: 1, ENTERPRISE: 2 };
      
      const currentPlanLevel = tiers[shop.plan as keyof typeof tiers] ?? 0;
      const requiredPlanLevel = tiers[requiredPlan];

      if (currentPlanLevel < requiredPlanLevel) {
        return res.status(403).json({
          status: 'UPGRADE_REQUIRED',
          message: `This feature is locked. Please upgrade to ${requiredPlan} to unlock Advanced Analytics & AI.`
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
};
