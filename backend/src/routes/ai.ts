import { Router } from 'express';
import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';
import { redis } from '../lib/redis';
import { addAiInsightsJob } from '../jobs/queues/ai.queue';
import { generateShopInsights } from '../services/ai.service';

import { checkPlan } from '../middleware/planGate';

const router = Router();

/**
 * GET /api/ai/insights
 * Return cached AI insight or trigger back-generation offline
 */
router.get(
  '/insights',
  authenticate,
  checkPlan('PRO'),
  asyncHandler(async (req: AuthRequest, res) => {
    const shopId = req.user!.shopId;
    const cacheKey = `ai_insights:${shopId}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Trigger synchronous calculation due to background threads lags
    const result = await generateShopInsights(shopId);
    return res.json(result);
  })
);

export default router;
