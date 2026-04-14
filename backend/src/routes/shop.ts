import { Router, Response } from 'express';
import { prisma } from '../common/prisma';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';
// Unused imports removed


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
  asyncHandler(async (req: AuthRequest, res: Response) => {
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

/**
 * POST /api/shop/create
 */
router.post(
  '/create',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Shop name is required' });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // --- EMPIRE MASTER GUARD: BLOCK DUPLICATE NAMES ---
    const existingMembership = await prisma.membership.findFirst({
      where: { 
        user: { email: currentUser.email },
        shop: { name: name }
      },
      include: { shop: true }
    });

    if (existingMembership) {
      return res.status(200).json({ 
        success: true, 
        message: 'Shop already exists, switching to it...', 
        shop: existingMembership.shop 
      });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const newShop = await tx.shop.create({
        data: {
          name,
          ownerName: currentUser.name,
          phone: "0000000000",
          plan: 'STARTER',
          currency: 'INR',
          email: currentUser.email,
        }
      });

      // NO NEW USER CREATION HERE anymore. 
      // Reuse the existing currentUser.id

      await tx.membership.create({
        data: {
          userId: currentUser.id,
          shopId: newShop.id,
          role: 'ADMIN',
          isActive: true
        }
      });

      return { shop: newShop };
    });

    res.status(201).json({ 
      success: true, 
      message: 'Shop created successfully', 
      shop: result.shop 
    });
  })
);

export default router;
