import { Router } from 'express';
import { authenticate, authorize, asyncHandler, AuthRequest } from '../middleware/auth';
import { ComboService } from '../services/combo.service';
import { prisma } from '../common/prisma';
import { deleteCache } from '../common/cache';

const router = Router();

/**
 * GET /api/combos
 */
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const combos = await ComboService.getCombos(req.user!.shopId);
  res.json({ combos });
}));

/**
 * POST /api/combos
 */
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const combo = await ComboService.createCombo(req.user!.shopId, req.body);
  await deleteCache(`menu:${req.user!.shopId}`); // Invalidate menu cache
  res.status(201).json(combo);
}));

/**
 * PUT /api/combos/:id
 */
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res) => {
  const { name, description, imageUrl, fixedPrice, isActive, items, showInScanner, showInPOS, startTime, endTime } = req.body;
  
  // Verify ownership
  const existing = await prisma.combo.findFirst({
    where: { id: req.params.id, shopId: req.user!.shopId }
  });
  if (!existing) return res.status(404).json({ error: 'Combo not found' });

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Update main fields
    const combo = await tx.combo.update({
      where: { id: req.params.id },
      data: { name, description, imageUrl, fixedPrice, isActive, showInScanner, showInPOS, startTime, endTime }
    });

    // 2. Update items if provided (Delete and Recreate strategy for simplicity)
    if (items) {
      await tx.comboItem.deleteMany({ where: { comboId: req.params.id } });
      await tx.comboItem.createMany({
        data: items.map((item: any) => ({
          comboId: req.params.id,
          productId: item.productId,
          quantity: item.quantity
        }))
      });
    }

    return combo;
  });

  await deleteCache(`menu:${req.user!.shopId}`);
  res.json(updated);
}));

/**
 * DELETE /api/combos/:id
 */
router.delete('/:id', authenticate, authorize('ADMIN'), asyncHandler(async (req: AuthRequest, res) => {
  const existing = await prisma.combo.findFirst({
    where: { id: req.params.id, shopId: req.user!.shopId }
  });
  if (!existing) return res.status(404).json({ error: 'Combo not found' });

  await prisma.combo.delete({ where: { id: req.params.id } });
  await deleteCache(`menu:${req.user!.shopId}`);
  res.json({ success: true });
}));

export default router;
