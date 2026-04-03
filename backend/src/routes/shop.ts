import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../common/prisma';
import { authenticate, authorize, asyncHandler, AuthRequest, validateRequest } from '../middleware/auth';

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

/**
 * GET /api/shop/members
 * List all members of the active shop
 */
router.get(
  '/members',
  authenticate,

  asyncHandler(async (req: AuthRequest, res) => {
    const members = await prisma.shopMember.findMany({
      where: { shopId: req.shopId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        isActive: m.isActive,
        joinedAt: m.joinedAt
      }))
    });
  })
);

/**
 * PATCH /api/shop/members/:userId
 * Update a member's role or status
 */
router.patch(
  '/members/:userId',
  authenticate,

  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { userId } = req.params;
    const { role, isActive } = req.body;

    const membership = await prisma.shopMember.update({
      where: { 
        userId_shopId: { 
          userId, 
          shopId: req.shopId 
        } 
      },
      data: { 
        ...(role && { role }), 
        ...(isActive !== undefined && { isActive }) 
      }
    });

    res.json(membership);
  })
);

/**
 * DELETE /api/shop/members/:userId
 * Remove a member from the shop
 */
router.delete(
  '/members/:userId',
  authenticate,

  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { userId } = req.params;

    // Prevent removing yourself
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'You cannot remove yourself from the shop' });
    }

    await prisma.shopMember.delete({
      where: { 
        userId_shopId: { 
          userId, 
          shopId: req.shopId 
        } 
      }
    });

    res.json({ message: 'Member removed successfully' });
  })
);

export default router;
