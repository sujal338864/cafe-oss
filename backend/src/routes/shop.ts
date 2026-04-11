import { Router } from 'express';
import { prisma } from '../common/prisma';
import { authenticate, authorize, asyncHandler, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/shop/profile
 */
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const shop = await prisma.shop.findUnique({
      where: { id: req.user!.shopId }
    });

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    res.json(shop);
  })
);

/**
 * PUT /api/shop/profile
 */
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, phone, email, address, currency, pricingEnabled, pricingRules, loyaltyRate, redeemRate } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.user!.shopId },
      data: { name, phone, email, address, currency, pricingEnabled, pricingRules, loyaltyRate, redeemRate } as any
    });

    res.json(shop);
  })
);


/**
 * POST /api/shop/upgrade
 * Simulates upgrading the shop's subscription tier
 */
router.post(
  '/upgrade',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const shopId = req.user!.shopId;
    const { plan } = req.body;

    if (!['STARTER', 'PRO', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: { plan }
    });

    res.json({ message: `Successfully upgraded to ${plan}`, shop });
  })
);

export default router;
