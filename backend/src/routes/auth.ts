import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../common/prisma';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

/**
 * Helper: Create JWT
 */
export const makeToken = (userId: string, shopId: string, role: string, email: string) => {
  return jwt.sign({ id: userId, shopId, role, email }, JWT_SECRET, { expiresIn: '1d' });
};

/**
 * Helper: Set Cookie
 */
export const setAuthCookie = (res: Response, token: string) => {
  res.cookie('shop_os_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });
};

/**
 * Helper: Clean user response
 */
export const userResponse = (user: any, shop: any, token: string, memberships: any[] = []) => {
  return {
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      shopId: user.shopId,
      shopName: shop?.name || 'Shop OS',
      memberships: memberships.map(m => ({
        shopId: m.shopId,
        shopName: m.shop?.name || 'Untitled Shop',
        role: m.role
      }))
    },
    shop
  };
};

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // FIX: Using findFirst for multi-tenant lookup + Type Casting to resolve lint false-positives
    const user = await (prisma.user as any).findFirst({
      where: { email },
      include: { shop: true }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) return res.status(403).json({ error: 'User account is inactive' });
    if (!user.shop.isActive) return res.status(403).json({ error: 'Shop account is inactive' });

    // FETCH ALL MEMBERSHIPS FOR THIS EMAIL globally
    const membershipsRaw = await (prisma as any).membership.findMany({
      where: { user: { email: { equals: email, mode: 'insensitive' } }, isActive: true },
      include: { shop: true },
      orderBy: { createdAt: 'desc' }
    });

    const seenIds = new Set();
    const allMemberships: any[] = [];
    for (const m of membershipsRaw) {
      if (!seenIds.has(m.shopId)) {
        seenIds.add(m.shopId);
        allMemberships.push(m);
      }
    }

    const token = makeToken(user.id, user.shopId, user.role, user.email);
    setAuthCookie(res, token);
    res.json(userResponse(user, user.shop, token, allMemberships));
  })
);

/**
 * GET /api/auth/me
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const authenticatedUser = await (prisma.user as any).findUnique({
      where: { id: req.user!.id },
      include: { shop: true }
    });

    if (!authenticatedUser) return res.status(404).json({ error: 'User not found' });
    const user = authenticatedUser;
    if (!user.shop.isActive) return res.status(403).json({ error: 'Shop account is inactive' });

    // FETCH ALL MEMBERSHIPS FOR THIS EMAIL
    const membershipsRaw = await (prisma.membership as any).findMany({
      where: { user: { email: { equals: user.email, mode: 'insensitive' } }, isActive: true },
      include: { shop: true },
      orderBy: { createdAt: 'desc' }
    });

    const seenIds = new Set();
    const allMemberships: any[] = [];
    for (const m of membershipsRaw) {
      if (!seenIds.has(m.shopId)) {
        seenIds.add(m.shopId);
        allMemberships.push(m);
      }
    }

    const token = makeToken(user.id, user.shopId, user.role, user.email);
    setAuthCookie(res, token);
    return res.json(userResponse(user, user.shop, token, allMemberships));
  })
);

/**
 * POST /api/auth/register
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { shopName, ownerName, email, password, phone } = req.body;

    const existingShop = await (prisma.shop as any).findFirst({
      where: { name: shopName, email: email }
    });
    if (existingShop) return res.status(400).json({ error: 'You already own a shop with this name' });

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const result = await prisma.$transaction(async (tx: any) => {
        // 1. Create the new Shop
        const shop = await tx.shop.create({
          data: {
            name: shopName,
            ownerName,
            email,
            phone: phone || "0000000000",
            plan: 'STARTER',
            currency: 'INR'
          }
        });

        // 2. CHECK GLOBAL IDENTITY: Does this email already have a User record?
        let user = await tx.user.findUnique({
          where: { email }
        });

        if (user) {
          // SECURITY: Verify password before linking a new shop to an existing identity
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            throw new Error('AUTH_INVALID_PASSWORD');
          }

          // Reuse existing user, potentially update legacy shopId for consistency
          user = await tx.user.update({
            where: { id: user.id },
            data: { shopId: shop.id }
          });
        } else {
          // Create brand new global identity
          user = await tx.user.create({
            data: {
              email,
              passwordHash,
              name: ownerName,
              role: 'ADMIN',
              shopId: shop.id,
              isActive: true
            }
          });
        }

        // 3. Create Membership (Source of truth for access)
        await tx.membership.upsert({
          where: { userId_shopId: { userId: user.id, shopId: shop.id } },
          update: { role: 'ADMIN', isActive: true },
          create: {
            userId: user.id,
            shopId: shop.id,
            role: 'ADMIN',
            isActive: true
          }
        });

        return { user, shop };
      });

      const token = makeToken(result.user.id, result.shop.id, result.user.role, result.user.email);
      setAuthCookie(res, token);
      res.json(userResponse(result.user, result.shop, token, []));
    } catch (err: any) {
      if (err.message === 'AUTH_INVALID_PASSWORD') {
        return res.status(401).json({ error: 'Incorrect password for existing account. Please log in first or use a different email.' });
      }
      throw err;
    }
  })
);

/**
 * POST /api/auth/switch
 */
router.post(
  '/switch',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { shopId } = req.body;
    if (!shopId) return res.status(400).json({ error: 'shopId is required' });

    const isSuperAdmin = String(req.user!.role) === 'SUPER_ADMIN';

    let membership = await (prisma.membership as any).findFirst({
      where: {
        shopId,
        user: { email: { equals: req.user!.email, mode: 'insensitive' } },
        isActive: true
      },
      include: { user: true, shop: true }
    });

    // Super Admin Bypass: If no membership, fetch shop & user separately
    if (!membership && isSuperAdmin) {
      const [targetShop, userRecord] = await Promise.all([
        prisma.shop.findUnique({ where: { id: shopId } }),
        prisma.user.findUnique({ where: { id: req.user!.id } })
      ]);
      if (targetShop && userRecord) {
        membership = { user: userRecord, shop: targetShop, role: 'SUPER_ADMIN', shopId, userId: userRecord.id };
      }
    }

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this shop' });
    }

    // UPDATE LEGACY IDENTITY: Ensure the User's primary shopId join matches the switched shop
    // This prevents the "flip back" issue where /me returns the old shop profile.
    await prisma.user.update({
      where: { id: membership.userId },
      data: { shopId }
    });

    const token = makeToken(membership.user.id, shopId, membership.role, membership.user.email);
    setAuthCookie(res, token);

    // FETCH ALL MEMBERSHIPS FOR THIS EMAIL
    const membershipsRaw = await (prisma.membership as any).findMany({
      where: { user: { email: { equals: membership.user.email, mode: 'insensitive' } }, isActive: true },
      include: { shop: true },
      orderBy: { createdAt: 'desc' }
    });

    const seenIds = new Set();
    const allMemberships: any[] = [];
    for (const m of membershipsRaw) {
      if (!seenIds.has(m.shopId)) {
        seenIds.add(m.shopId);
        allMemberships.push(m);
      }
    }

    res.json(userResponse(membership.user, membership.shop, token, allMemberships));
  })
);

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('shop_os_token');
  res.json({ success: true, message: 'Logged out' });
});

export default router;
