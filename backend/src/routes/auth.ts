import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { asyncHandler, validateRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  gstNumber: z.string().optional(),
  address: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/auth/register
 * Register new shop and admin user
 */
router.post(
  '/register',
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const { shopName, ownerName, email, password, phone, gstNumber, address } = req.body;

    // Check if email already exists
    const existingShop = await prisma.shop.findUnique({
      where: { email }
    });

    if (existingShop) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create shop and admin user in transaction
    const shop = await prisma.$transaction(async (tx) => {
      const newShop = await tx.shop.create({
        data: {
          name: shopName,
          ownerName,
          email,
          phone,
          gstNumber,
          address,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          plan: 'STARTER',
          isActive: true,
          users: {
            create: {
              name: ownerName,
              email,
              passwordHash,
              role: 'ADMIN',
              isEmailVerified: true,
            }
          }
        },
        include: { users: true }
      });

      // Create welcome notification
      // await tx.notification.create({
      //   data: {
      //     shopId: newShop.id,
      //     type: 'SYSTEM',
      //     title: 'Welcome to Shop OS',
      //     message: 'Your shop has been successfully created. Start by adding products to your inventory.',
      //   }
      // });

      return newShop;
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: shop.users[0].id,
        shopId: shop.id,
        role: shop.users[0].role,
        email: shop.users[0].email
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: shop.users[0].id,
        name: shop.users[0].name,
        email: shop.users[0].email,
        role: shop.users[0].role
      },
      shop: {
        id: shop.id,
        name: shop.name,
        plan: shop.plan
      }
    });
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findFirst({
      where: { email },
      include: { shop: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    // Check if shop is active
    if (!user.shop.isActive) {
      return res.status(403).json({ error: 'Shop account is inactive' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        shopId: user.shopId,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      shop: {
        id: user.shop.id,
        name: user.shop.name,
        plan: user.shop.plan
      }
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post(
  '/forgot-password',
  validateRequest(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findFirst({
      where: { email }
    });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If email exists, reset link will be sent' });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetExpiry
      }
    });

    // TODO: Send email with reset link
    // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    // await sendEmail(email, 'Password Reset', `Click here to reset: ${resetLink}`);

    res.json({ message: 'Password reset link sent to email' });
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

      const user = await prisma.user.findUnique({
        where: { id: payload.id }
      });

      if (!user || user.resetToken !== token) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      if (user.resetExpiry && user.resetExpiry < new Date()) {
        return res.status(400).json({ error: 'Reset token has expired' });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetToken: null,
          resetExpiry: null
        }
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
  })
);

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.body;

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

      const user = await prisma.user.findUnique({
        where: { id: payload.id }
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid token' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true, verifyToken: null }
      });

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
  })
);

export default router;
