import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../common/prisma';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';
import { MagicLinkService } from '../services/magicLink.service';
import { getJwtSecret } from '../lib/jwt';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Helper: Create JWT
 * NOTE: Always reads from getJwtSecret() — throws at startup if JWT_SECRET is missing.
 */
export const makeToken = (userId: string, shopId: string, role: string, email: string) => {
  return jwt.sign({ id: userId, shopId, role, email }, getJwtSecret(), { expiresIn: '1d' });
};

/**
 * Helper: Set Cookie
 */
export const setAuthCookie = (res: Response, token: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('shop_os_token', token, {
    httpOnly: true,
    secure: isProd, // Must be true when sameSite is 'none'
    sameSite: isProd ? 'none' : 'lax', // Allow cross-domain requests on Vercel/Render pairs
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });
};

/**
 * Helper: Clean user response
 */
export const userResponse = (user: any, shop: any, token: string, memberships: any[] = [], orgMemberships: any[] = []) => {
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
      })),
      // Franchise mode — list of orgs user belongs to (empty = Independent Mode)
      organizations: orgMemberships.map(m => ({
        orgId: m.organizationId,
        orgName: m.organization?.name || 'Org',
        orgRole: m.orgRole
      })),
      isInFranchiseMode: orgMemberships.length > 0,
      onboardingCompleted: user.onboardingCompleted ?? true,
      selectedMode: user.selectedMode || 'INDEPENDENT'
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
    // Also fetch org memberships for franchise mode detection
    const orgMemberships = await (prisma as any).orgMembership.findMany({
      where: { userId: user.id, isActive: true },
      include: { organization: { select: { id: true, name: true } } }
    }).catch(() => []);
    res.json(userResponse(user, user.shop, token, allMemberships, orgMemberships));
  })
);

/**
 * POST /api/auth/magic-link
 * Request a passwordless login link
 */
router.post('/magic-link', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const result = await MagicLinkService.requestLink(email);
  res.json(result);
}));

/**
 * GET /api/auth/magic-callback
 * Verify magic link token and log in
 */
router.get('/magic-callback', asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const user = await MagicLinkService.verifyToken(token as string);

  // Fetch contextual details for response
  const memberships = await (prisma as any).membership.findMany({
    where: { userId: user.id, isActive: true },
    include: { shop: true }
  });
  const orgMemberships = await (prisma as any).orgMembership.findMany({
    where: { userId: user.id, isActive: true },
    include: { organization: true }
  }).catch(() => []);

  const authToken = makeToken(user.id, user.shopId, user.role, user.email);
  setAuthCookie(res, authToken);

  // Redirect to dashboard on frontend if possible, or return JSON
  if (req.query.redirect === 'true') {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
  }

  res.json(userResponse(user, user.shop, authToken, memberships, orgMemberships));
}));

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
    // Also fetch org memberships for franchise mode detection
    const orgMemberships = await (prisma as any).orgMembership.findMany({
      where: { userId: user.id, isActive: true },
      include: { organization: { select: { id: true, name: true } } }
    }).catch(() => []);
    return res.json(userResponse(user, user.shop, token, allMemberships, orgMemberships));
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
 * POST /api/auth/signup
 * New signup flow specifically for modern onboarding.
 * Skips demanding shop details upfront and creates a placeholder workspace.
 */
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });

    const existingUser = await (prisma.user as any).findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Account already exists. Please log in.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const placeholderShopName = `${name}'s Workspace`;

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create a placeholder Shop
      const shop = await tx.shop.create({
        data: {
          name: placeholderShopName,
          ownerName: name,
          email,
          phone: "0000000000",
          plan: 'STARTER',
          mode: 'INDEPENDENT'
        }
      });

      // 2. Create Global Identity with onboardingCompleted = false
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'ADMIN',
          shopId: shop.id,
          isActive: true,
          onboardingCompleted: false
        }
      });

      // 3. Create Membership
      await tx.membership.create({
        data: {
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
    res.json(userResponse(result.user, result.shop, token, [], []));
  })
);

// NOTE: The original non-transactional /onboard handler was removed.
// The transactional version below handles both INDEPENDENT and FRANCHISE modes correctly.

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
        userId: req.user!.id,
        isActive: true
      },
      include: { user: true, shop: true }
    });

    // --- FRANCHISE INTELLIGENCE: Fallback to Org Access ---
    if (!membership) {
      const orgMember = await (prisma as any).orgMembership.findFirst({
        where: { 
          userId: req.user!.id, 
          shopId, // Check if they specifically have access to this branch
          isActive: true 
        }
      });

      // Also check if they are a global HQ_ADMIN for the organization the shop belongs to
      if (!orgMember) {
        const targetShop = await prisma.shop.findUnique({ where: { id: shopId } });
        if (targetShop?.organizationId) {
          const hqAdmin = await (prisma as any).orgMembership.findFirst({
            where: { 
              userId: req.user!.id, 
              organizationId: targetShop.organizationId, 
              orgRole: 'HQ_ADMIN', 
              isActive: true 
            }
          });
          if (hqAdmin) {
            const userRecord = await prisma.user.findUnique({ where: { id: req.user!.id } });
            if (userRecord && targetShop) {
              membership = { user: userRecord, shop: targetShop, role: 'ADMIN', shopId, userId: userRecord.id };
            }
          }
        }
      } else {
        const [userRecord, shopRecord] = await Promise.all([
          prisma.user.findUnique({ where: { id: req.user!.id } }),
          prisma.shop.findUnique({ where: { id: shopId } })
        ]);
        if (userRecord && shopRecord) {
          membership = { user: userRecord, shop: shopRecord, role: 'ADMIN', shopId, userId: userRecord.id };
        }
      }
    }

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

    // FETCH ORG MEMBERSHIPS SO FRANCHISE UI SURVIVES SHOP BINDING CHANGE
    const orgMemberships = await (prisma as any).orgMembership.findMany({
      where: { userId: membership.user.id, isActive: true },
      include: { organization: { select: { id: true, name: true } } }
    }).catch(() => []);

    res.json(userResponse(membership.user, membership.shop, token, allMemberships, orgMemberships));
  })
);

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('shop_os_token');
  res.json({ success: true, message: 'Logged out' });
});

/**
 * POST /api/auth/onboard
 * Finalize onboarding details (rename shop, select mode, create org)
 */
router.post(
  '/onboard',
  authenticate as any,
  asyncHandler(async (req: AuthRequest, res: any) => {
    const { mode, shopName, city, category, orgName, orgSlug } = req.body;
    const userId = req.user!.id;
    const shopId = req.user!.shopId;

    try {
      const result = await prisma.$transaction(async (tx: any) => {
        // 1. Update the current placeholder Shop
        const shop = await tx.shop.update({
          where: { id: shopId },
          data: {
            name: shopName,
            city,
            mode: mode || 'INDEPENDENT',
            category: category || 'Cafe'
          }
        });

        // 2. Handle Franchise Mode setup
        if (mode === 'FRANCHISE') {
          // Create Organization
          const org = await tx.organization.create({
            data: {
              name: orgName || `${shopName} HQ`,
              slug: orgSlug || shopName.toLowerCase().replace(/\s+/g, '-'),
              isActive: true,
              plan: 'PRO'
            }
          });

          // Link Shop to Org
          await tx.shop.update({
            where: { id: shopId },
            data: { organizationId: org.id }
          });

          // Create HQ Admin Membership
          await tx.orgMembership.create({
            data: {
              organizationId: org.id,
              userId,
              orgRole: 'HQ_ADMIN',
              isActive: true
            }
          });
        }

        // 3. Mark User as Onboarded
        const user = await tx.user.update({
          where: { id: userId },
          data: {
            onboardingCompleted: true,
            selectedMode: mode || 'INDEPENDENT'
          }
        });

        return { user, shop };
      });

      return res.json({ success: true, user: result.user });
    } catch (err: any) {
      logger.error(`[ONBOARDING] Failed: ${err.message}`);
      return res.status(500).json({ error: 'Onboarding failed: ' + err.message });
    }
  })
);

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email. Always returns success to prevent user enumeration.
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Always return success — never reveal if email exists
  res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

  // Fire-and-forget: generate and send token asynchronously
  setImmediate(async () => {
    try {
      const user = await (prisma.user as any).findUnique({ where: { email: email.toLowerCase().trim() } });
      if (!user || !user.isActive) return;

      const { signShortToken } = await import('../lib/jwt');
      const resetToken = signShortToken({ userId: user.id, type: 'password_reset' }, '1h');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetExpiry }
      });

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      const { EmailService } = await import('../services/email.service');
      await EmailService.sendPasswordReset(user.name, user.email, resetUrl);
      logger.info(`[AUTH] Password reset link sent to ${user.email}`);
    } catch (err: any) {
      logger.error(`[AUTH] Forgot-password background task failed: ${err.message}`);
    }
  });
}));

/**
 * POST /api/auth/reset-password
 * Validates reset token and sets a new password.
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { verifyToken } = await import('../lib/jwt');
    const decoded = verifyToken(token) as any;
    if (decoded.type !== 'password_reset') throw new Error('Invalid token type');

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (!user.resetToken || user.resetToken !== token) return res.status(400).json({ error: 'Reset link already used or expired' });
    if (user.resetExpiry && new Date(user.resetExpiry) < new Date()) return res.status(400).json({ error: 'Reset link has expired' });

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpiry: null }
    });

    logger.info(`[AUTH] Password reset successful for ${user.email}`);
    return res.json({ success: true, message: 'Password updated. You can now log in.' });
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    logger.error(`[AUTH] Reset password failed: ${err.message}`);
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  }
}));

export default router;
