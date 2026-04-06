import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index';
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
    const users = await prisma.user.findMany({
      where: { shopId: req.user!.shopId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

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
    const { name, email, role, password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password is required (min 6 chars)' });
    }

    const existing = await prisma.user.findFirst({
      where: { email }
    });

    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        shopId: req.user!.shopId,
        name,
        email,
        role,
        passwordHash,
        isEmailVerified: true, // Admin-created users are pre-verified
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
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, shopId: req.user!.shopId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const data: any = {};
    if (name) data.name = name;
    if (role) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id },
      data
    });

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive
    });
  })
);

/**
 * DELETE /api/users/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const user = await prisma.user.findFirst({
      where: { id, shopId: req.user!.shopId }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot delete the Admin account' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  })
);

export default router;
