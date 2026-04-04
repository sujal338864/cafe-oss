import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, asyncHandler, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/users
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
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
 * Invite staff member
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { name, email, role } = req.body;

    const existing = await prisma.user.findFirst({
      where: { email, shopId: req.user!.shopId }
    });

    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // TODO: Send invitation email with setup link

    const user = await prisma.user.create({
      data: {
        shopId: req.user!.shopId,
        name,
        email,
        role,
        passwordHash: '', // Will be set when user accepts invitation
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
 * PUT /api/users/:id/role
 */
router.put(
  '/:id/role',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { role } = req.body;

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role }
    });

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role
    });
  })
);

/**
 * DELETE /api/users/:id
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, shopId: req.user!.shopId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'ADMIN') {
      return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ success: true });
  })
);

export default router;
