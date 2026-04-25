import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { BillingService } from '../services/billing.service';
import { PLAN_LIMITS, PlanName } from '../config/plans';
import { prisma } from '../common/prisma';

const router = Router();

router.use(authenticate as any);

/**
 * GET /api/subscriptions
 * Get current plan and features
 */
router.get('/', async (req: AuthRequest, res: any) => {
  const shop = await prisma.shop.findUnique({
    where: { id: req.user!.shopId },
    select: { plan: true }
  });
  const plan = (shop?.plan || 'STARTER') as PlanName;
  
  res.json({
    currentPlan: plan,
    limits: PLAN_LIMITS[plan]
  });
});

/**
 * POST /api/subscriptions/checkout
 * Create a payment session
 */
router.post('/checkout', async (req: AuthRequest, res: any) => {
  try {
    const { plan } = req.body;
    if (!['PRO', 'ENTERPRISE'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const session = await BillingService.createCheckoutSession(req.user!.shopId, plan);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/subscriptions/upgrade-test (Dev/Internal use)
 * Instantly upgrade without payment (for testing)
 */
router.post('/upgrade-test', async (req: AuthRequest, res: any) => {
  const { plan } = req.body;
  const result = await BillingService.finalizePlanUpgrade(req.user!.shopId, plan);
  res.json(result);
});

export default router;
