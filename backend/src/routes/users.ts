import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../common/prisma';
import { authenticate, authorize, asyncHandler, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/users
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    // SOURCE OF TRUTH: Query via Membership table
    const memberships = await (prisma as any).membership.findMany({
      where: { shopId: req.user!.shopId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true, // Legacy fallback
            isActive: true,
            lastLogin: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Flatten for response
    const users = memberships.map((m: any) => ({
      ...m.user,
      role: m.role, // Current shop-specific role
      isActive: m.isActive
    }));

    res.json(users);
  })
);

/**
 * POST /api/users
 * Create staff member directly (Admin control)
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, email: rawEmail, role, password } = req.body;
    const email = rawEmail.toLowerCase().trim();

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password is required (min 6 chars)' });
    }

    // 1. ATOMIC CHECK: Does this identity exist globally?
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      // IDENTITY EXISTS -> LINK TO NEW TENANT
      await (prisma as any).membership.upsert({
        where: { userId_shopId: { userId: user.id, shopId: req.user!.shopId } },
        update: { role, isActive: true },
        create: {
          userId: user.id,
          shopId: req.user!.shopId,
          role,
          isActive: true
        }
      });
      
      return res.status(200).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        message: 'Existing global user added to this shop'
      });
    }

    // 2. BRAND NEW IDENTITY
    const passwordHash = await bcrypt.hash(password, 12);

    user = await prisma.user.create({
      data: {
        shopId: req.user!.shopId, // Set as legacy fallback
        name,
        email,
        role,
        passwordHash,
        isEmailVerified: true, 
        isActive: true
      }
    });

    // 3. SECURE TENANCY: Create membership link
    await (prisma as any).membership.create({
      data: {
        userId: user.id,
        shopId: req.user!.shopId,
        role,
        isActive: true
      }
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  })
);

/**
 * PUT /api/users/:id
 * General update (Name, Role, Password, Active status)
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, role, password, isActive } = req.body;
    const { id: userId } = req.params;

    // Verify membership in THIS shop
    const membership = await (prisma as any).membership.findUnique({
      where: { userId_shopId: { userId, shopId: req.user!.shopId } }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Staff member not found in this shop' });
    }

    const data: any = {};
    const membershipData: any = {};

    if (name) data.name = name;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    // Role and IsActive are shop-specific in the Membership table
    if (role) membershipData.role = role;
    if (isActive !== undefined) membershipData.isActive = isActive;

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data }),
      (prisma as any).membership.update({
        where: { userId_shopId: { userId, shopId: req.user!.shopId } },
        data: membershipData
      })
    ]);

    res.json({ success: true });
  })
);

/**
 * DELETE /api/users/:id
 * Admin only — prevents MANAGER from deleting peers (privilege escalation)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id: userId } = req.params;

    const membership = await (prisma as any).membership.findUnique({
      where: { userId_shopId: { userId, shopId: req.user!.shopId } }
    });

    if (!membership) return res.status(404).json({ error: 'Staff member not found in this shop' });
    
    if (membership.role === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot delete an Admin membership via this route' });
    }

    await (prisma as any).membership.delete({
      where: { userId_shopId: { userId, shopId: req.user!.shopId } }
    });

    res.json({ success: true });
  })
);

export default router;
