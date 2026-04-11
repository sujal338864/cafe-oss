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
        shopName: m.shop?.name || 'Untitled',
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

    // FIX: Fetch ALL memberships for this EMAIL globally, not just this specific user ID
    // This solves the 'masked shop' issue caused by duplicate user records.
    const allMemberships = await (prisma as any).membership.findMany({
      where: { user: { email }, isActive: true },
      include: { shop: true },
      orderBy: { createdAt: 'desc' }
    });

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
      where: { user: { email: user.email }, isActive: true },
      include: { shop: true },
      orderBy: { createdAt: 'desc' }
    });

    // AGGRESSIVE DEDUPLICATION
    const seenShopIds = new Set();
    const seenShopNames = new Set();
    const allMemberships: any[] = [];
    
    for (const m of membershipsRaw) {
      const sId = m.shopId;
      const sName = (m as any).shop?.name || 'Untitled Cafe';
      
      if (!seenShopIds.has(sId) && !seenShopNames.has(sName)) {
        seenShopIds.add(sId);
        seenShopNames.add(sName);
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

    const result = await prisma.$transaction(async (tx: any) => {
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

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: ownerName,
          role: 'ADMIN',
          shopId: shop.id,
          isActive: true
        }
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          shopId: shop.id,
          role: 'ADMIN'
        }
      });

      return { user, shop };
    });

    const token = makeToken(result.user.id, result.shop.id, result.user.role, result.user.email);
    setAuthCookie(res, token);
    res.json(userResponse(result.user, result.shop, token, []));
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

    const membership = await (prisma.membership as any).findFirst({
      where: {
        shopId,
        user: { email: req.user!.email },
        isActive: true
      },
      include: { user: true, shop: true }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this shop' });
    }

    const token = makeToken(membership.user.id, shopId, membership.role, membership.user.email);
    setAuthCookie(res, token);
    
    const allMembershipsRaw = await (prisma.membership as any).findMany({
      where: { user: { email: membership.user.email }, isActive: true },
      include: { shop: true },
      orderBy: { createdAt: 'desc' }
    });

    const seenIds = new Set();
    const seenNames = new Set();
    const cleanMemberships: any[] = [];
    for (const m of allMembershipsRaw) {
      if (!seenIds.has(m.shopId) && !seenNames.has(m.shop.name)) {
        seenIds.add(m.shopId);
        seenNames.add(m.shop.name);
        cleanMemberships.push(m);
      }
    }

    res.json(userResponse(membership.user, membership.shop, token, cleanMemberships));
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
