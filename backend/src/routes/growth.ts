import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, asyncHandler, validateRequest, AuthRequest } from '../middleware/auth';
import { GrowthService } from '../services/growth.service';
import { prisma } from '../common/prisma';

const router = Router();

// All growth routes: authenticated + ADMIN/MANAGER only
router.use(authenticate as any);
router.use(authorize('ADMIN', 'MANAGER', 'SUPER_ADMIN') as any);

/**
 * GET /api/growth/dashboard
 * Returns KPIs + segment counts + suggested actions in one call.
 * Cached: KPIs 60s, segments 120s. Fast load guaranteed.
 */
router.get('/dashboard', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;

  const [kpis, segments] = await Promise.all([
    GrowthService.getGrowthKPIs(shopId),
    GrowthService.getSegmentCounts(shopId)
  ]);

  // Pass kpis to actions to avoid double computation
  const actions = await GrowthService.getSuggestedActions(shopId, kpis);

  res.json({ kpis, segments, actions });
}));

/**
 * GET /api/growth/segments
 * Returns segment counts only (lightweight).
 */
router.get('/segments', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const segments = await GrowthService.getSegmentCounts(shopId);
  res.json({ segments });
}));

/**
 * GET /api/growth/segments/:type
 * Returns paginated customers for a specific segment.
 * Supported types: VIP, FREQUENT, NEW, INACTIVE_30D, INACTIVE_60D, HIGH_SPENDER
 */
router.get('/segments/:type', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const { type } = req.params;
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  const validSegments = ['VIP', 'FREQUENT', 'NEW', 'INACTIVE_30D', 'INACTIVE_60D', 'HIGH_SPENDER'];
  if (!validSegments.includes(type.toUpperCase())) {
    return res.status(400).json({ error: `Invalid segment. Valid: ${validSegments.join(', ')}` });
  }

  const customers = await GrowthService.getSegmentCustomers(shopId, type, page, limit);
  res.json({ customers, segment: type.toUpperCase(), page, limit });
}));

// ── Coupon Engine ─────────────────────────────────────────────────────────────

const couponSchema = z.object({
  code:        z.string().min(3).max(20).transform(v => v.toUpperCase().trim()),
  type:        z.enum(['PERCENTAGE', 'FLAT', 'FIRST_ORDER']).default('PERCENTAGE'),
  value:       z.number().positive(),
  minOrder:    z.number().min(0).default(0),
  maxUses:     z.number().int().positive().nullable().default(null),
  isFirstOnly: z.boolean().default(false),
  expiresAt:   z.string().nullable().optional().transform(v => v ? new Date(v) : null),
  description: z.string().max(200).optional().nullable(),
  isActive:    z.boolean().default(true)
});

/**
 * GET /api/growth/coupons
 * Returns all coupons for the shop.
 * Returns { migrationRequired: true } if Coupon table doesn't exist yet.
 */
router.get('/coupons', asyncHandler(async (req: AuthRequest, res) => {
  const shopId  = req.user!.shopId;
  const coupons = await GrowthService.getCoupons(shopId);
  if (coupons === null) {
    return res.json({ coupons: [], migrationRequired: true });
  }
  res.json({ coupons, migrationRequired: false });
}));

/**
 * POST /api/growth/coupons
 * Creates a new coupon for the shop.
 */
router.post(
  '/coupons',
  validateRequest(couponSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const shopId = req.user!.shopId;
    try {
      const coupon = await GrowthService.createCoupon(shopId, req.body);
      res.status(201).json(coupon);
    } catch (err: any) {
      if (err.message === 'MIGRATION_REQUIRED') {
        return res.status(503).json({
          error: 'Coupon system requires a database migration.',
          command: 'npx prisma migrate dev --name add_growth_engine'
        });
      }
      if (err.message?.startsWith('Coupon code')) {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }
  })
);

/**
 * POST /api/growth/coupons/validate
 * Validates a coupon code against an order total.
 * Safe to call from POS / menu frontend.
 */
router.post('/coupons/validate', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const { code, orderTotal, customerId } = req.body;
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code is required' });
  if (!orderTotal || isNaN(Number(orderTotal))) return res.status(400).json({ error: 'orderTotal must be a number' });
  const result = await GrowthService.validateCoupon(shopId, code, Number(orderTotal), customerId);
  res.json(result);
}));

/**
 * GET /api/growth/coupons/analytics
 * Returns ROI stats for all coupons (revenue generated, total discount given).
 */
router.get('/coupons/analytics', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const stats = await GrowthService.getCouponAnalytics(shopId);
  res.json({ analytics: stats });
}));

/**
 * DELETE /api/growth/coupons/:id
 * Deletes a coupon (must belong to same shop).
 */
router.delete('/coupons/:id', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  try {
    await GrowthService.deleteCoupon(shopId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Coupon not found')     return res.status(404).json({ error: err.message });
    if (err.message === 'MIGRATION_REQUIRED') return res.status(503).json({ error: 'Coupon table not yet migrated.' });
    throw err;
  }
}));

// ── Loyalty Tiers ─────────────────────────────────────────────────────────────

router.get('/loyalty-tiers', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const tiers = await GrowthService.getLoyaltyTiers(shopId);
  res.json({ tiers });
}));

router.post('/loyalty-tiers', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const tier = await GrowthService.saveLoyaltyTier(shopId, req.body);
  res.json({ tier });
}));

router.delete('/loyalty-tiers/:id', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  await GrowthService.deleteLoyaltyTier(shopId, req.params.id);
  res.json({ success: true });
}));

/**
 * GET /api/growth/intel
 * Returns the latest AI-generated daily marketing plan.
 */
router.get('/intel', asyncHandler(async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const intel = await (prisma as any).dailyMarketingIntel.findUnique({
    where: { shopId_date: { shopId, date: today } }
  });

  if (!intel) {
    const latest = await (prisma as any).dailyMarketingIntel.findFirst({
      where: { shopId },
      orderBy: { date: 'desc' }
    });
    return res.json({ intel: latest || null });
  }

  res.json({ intel });
}));

export default router;
