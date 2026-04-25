import { Router, Response } from 'express';
import { prisma } from '../common/prisma';
import { z } from 'zod';
import { authenticate, asyncHandler, AuthRequest, validateRequest } from '../middleware/auth';

const router = Router();

const shopUpdateSchema = z.object({
  name: z.string().min(1, 'Shop name is required').optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  address: z.string().optional(),
  currency: z.string().optional(),
  pricingEnabled: z.boolean().optional(),
  pricingRules: z.any().optional(),
  loyaltyRate: z.number().min(0).max(1).optional(),
  redeemRate: z.number().min(0).optional(),
});

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
  validateRequest(shopUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const shop = await prisma.shop.update({
      where: { id: req.user!.shopId },
      data: req.body
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
    const { name, organizationId } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    
    // Safety check if trying to create under an organization
    if (organizationId) {
      const { OrgService } = require('../services/org.service');
      const hasAccess = await (prisma as any).orgMembership.findFirst({
        where: { organizationId, userId: currentUser.id, orgRole: 'HQ_ADMIN' }
      });
      if (!hasAccess) return res.status(403).json({ error: 'You are not HQ_ADMIN for this organization' });
    }

    // Check if user already owns a shop with this exact name
    let existingMembership = await (prisma.membership as any).findFirst({
      where: { 
        user: { id: currentUser.id }, 
        shop: { name: name.trim() } 
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
          ...(organizationId ? { mode: 'FRANCHISE', organizationId } : { mode: 'INDEPENDENT' })
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

      if (organizationId) {
        // Also create the orgMembership and branch link
        await tx.orgMembership.create({
          data: {
            organizationId,
            userId: currentUser.id,
            shopId: newShop.id,
            orgRole: 'BRANCH_MANAGER',
            isActive: true
          }
        });
      }

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
