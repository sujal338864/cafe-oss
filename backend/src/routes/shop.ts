import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { authenticate, authorize, asyncHandler, AuthRequest, tenantContext, validateRequest } from '../middleware/auth';

const router = Router();

const shopCreateSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  address: z.string().optional(),
  currency: z.string().default('INR'),
});

/**
 * GET /api/shop/list
 * List all shops current user belongs to
 */
router.get(
  '/list',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const memberships = await prisma.shopMember.findMany({
      where: { userId: req.user!.id },
      include: { shop: true }
    });

    res.json({
      shops: memberships.map(m => ({
        id: m.shop.id,
        name: m.shop.name,
        role: m.role,
        isActive: m.shop.isActive,
        plan: m.shop.plan
      }))
    });
  })
);

/**
 * POST /api/shop
 * Create a new branch (if within user shopLimit)
 */
router.post(
  '/',
  authenticate,
  validateRequest(shopCreateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const shopCount = await prisma.shopMember.count({
      where: { userId: user.id, role: 'ADMIN' } // Counting shops they own/lead
    });

    if (shopCount >= user.shopLimit) {
      return res.status(403).json({ 
        error: `You have reached your limit of ${user.shopLimit} shops. Please upgrade your global account plan to add more branches.` 
      });
    }

    const { name, phone, email, address, currency } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name, ownerName: user.name, phone, address, 
          email: email || `${name.toLowerCase().replace(/\s/g, '')}@noemail.com`,
          currency: currency || 'INR'
        }
      });

      await tx.shopMember.create({
        data: {
          userId: user.id,
          shopId: shop.id,
          role: 'ADMIN'
        }
      });

      return shop;
    });

    res.status(201).json(result);
  })
);

/**
 * GET /api/shop/profile
 */
router.get(
  '/profile',
  authenticate,
  tenantContext,
  asyncHandler(async (req: AuthRequest, res) => {
    const shop = await prisma.shop.findUnique({
      where: { id: req.shopId }
    });

    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    res.json(shop);
  })
);

/**
 * PUT /api/shop/profile
 */
router.put(
  '/profile',
  authenticate,
  tenantContext,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, phone, email, address, currency, pricingEnabled, pricingRules, loyaltyRate, redeemRate } = req.body;
    const shop = await prisma.shop.update({
      where: { id: req.shopId },
      data: { name, phone, email, address, currency, pricingEnabled, pricingRules, loyaltyRate, redeemRate } as any
    });

    res.json(shop);
  })
);

/**
 * POST /api/shop/upgrade
 */
router.post(
  '/upgrade',
  authenticate,
  tenantContext,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { plan } = req.body;
    if (!['STARTER', 'PRO', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const shop = await prisma.shop.update({
      where: { id: req.shopId },
      data: { plan } as any
    });

    res.json({ message: `Successfully upgraded branch to ${plan}`, shop });
  })
);

export default router;
