import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../common/prisma';
import { asyncHandler, validateRequest } from '../middleware/auth';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ───────────────────────────────────────────
// VALIDATION SCHEMAS
// ───────────────────────────────────────────
const registerSchema = z.object({
  shopName:  z.string().min(2),
  ownerName: z.string().min(2),
  email:     z.string().email(),
  password:  z.string().min(8),
  phone:     z.string().min(10),
  gstNumber: z.string().optional(),
  address:   z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  credential: z.string().min(1),
  shopName:   z.string().min(2).optional(),
  phone:      z.string().min(10).optional(),
});

// ───────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────
function makeToken(userId: string, email: string) {
  return jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

function userResponse(user: any, memberships: any[], token: string) {
  return {
    token,
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      plan: user.plan,
      shopLimit: user.shopLimit 
    },
    shops: memberships.map(m => ({
      id: m.shop.id,
      name: m.shop.name,
      plan: m.shop.plan,
      role: m.role
    })),
  };
}

// ───────────────────────────────────────────
// POST /api/auth/register
// ───────────────────────────────────────────
router.post('/register', validateRequest(registerSchema), asyncHandler(async (req, res) => {
  const { shopName, ownerName, email, password, phone, gstNumber, address } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: 'Email already registered.' });

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Global User
    const user = await tx.user.create({
      data: { 
        name: ownerName, 
        email, 
        passwordHash, 
        isEmailVerified: true,
        plan: 'STARTER',
        shopLimit: 1 
      }
    });

    // 2. Create First Shop
    const shop = await tx.shop.create({
      data: {
        name: shopName, 
        ownerName, 
        email, 
        phone, 
        gstNumber, 
        address,
        currency: 'INR', 
        timezone: 'Asia/Kolkata',
      }
    });

    // 3. Create Membership
    const membership = await tx.shopMember.create({
      data: {
        userId: user.id,
        shopId: shop.id,
        role: 'ADMIN'
      },
      include: { shop: true }
    });

    return { user, membership };
  });

  const token = makeToken(result.user.id, result.user.email);
  return res.status(201).json(userResponse(result.user, [result.membership], token));
}));

// ───────────────────────────────────────────
// POST /api/auth/login
// ───────────────────────────────────────────
router.post('/login', validateRequest(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { 
      memberships: {
        include: { shop: true }
      }
    }
  });

  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  if (!user.isActive) return res.status(403).json({ error: 'User account is inactive' });

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  const token = makeToken(user.id, user.email);
  return res.json(userResponse(user, user.memberships, token));
}));

// ───────────────────────────────────────────
// POST /api/auth/google
// ───────────────────────────────────────────
router.post('/google', validateRequest(googleAuthSchema), asyncHandler(async (req, res) => {
  const { credential, shopName, phone } = req.body;

  let payload: any;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Invalid Google token' });
  }

  const { email, name, sub: googleId, picture } = payload;
  if (!email) return res.status(400).json({ error: 'Google account has no email' });

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { shop: true } } }
  });

  if (existingUser) {
    if (!existingUser.isActive) return res.status(403).json({ error: 'User inactive' });

    await prisma.user.update({
      where: { id: existingUser.id },
      data: { lastLogin: new Date(), isEmailVerified: true }
    });

    const token = makeToken(existingUser.id, existingUser.email);
    return res.json({
      ...userResponse(existingUser, existingUser.memberships, token),
      isNewUser: false,
    });
  }

  if (!shopName || !phone) {
    return res.status(200).json({ isNewUser: true, email, name, googleId, picture });
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        passwordHash: '', 
        isEmailVerified: true,
        plan: 'STARTER',
        shopLimit: 1
      }
    });

    const shop = await tx.shop.create({
      data: {
        name: shopName,
        ownerName: name || email.split('@')[0],
        email,
        phone,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      }
    });

    const membership = await tx.shopMember.create({
      data: {
        userId: user.id,
        shopId: shop.id,
        role: 'ADMIN'
      },
      include: { shop: true }
    });

    return { user, membership };
  });

  const token = makeToken(result.user.id, result.user.email);
  return res.status(201).json({
    ...userResponse(result.user, [result.membership], token),
    isNewUser: true,
  });
}));

// ───────────────────────────────────────────
// PASSWORDS
// ───────────────────────────────────────────
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ message: 'If email exists, reset link will be sent' });

  const resetToken = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetExpiry: new Date(Date.now() + 3600000) }
  });

  return res.json({ message: 'Password reset link sent to email' });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.resetToken !== token) return res.status(400).json({ error: 'Invalid token' });
    if (user.resetExpiry && user.resetExpiry < new Date()) return res.status(400).json({ error: 'Token expired' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpiry: null }
    });
    return res.json({ message: 'Password reset successfully' });
  } catch {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
}));

export default router;
