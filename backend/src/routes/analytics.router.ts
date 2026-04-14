/**
 * FILE 2: src/routes/analytics.router.ts
 * Analytics Router with 20s Prisma Timeout race.
 */
import { Router } from 'express';
// Unused imports removed

import { authenticate } from '../middleware/auth';
import { withTenantContext } from '../middleware/tenant';
import { calculateDashboardStats } from '../services/analytics.service';

const router = Router();
router.get('/', authenticate as any, withTenantContext as any, async (req: any, res: any) => {
  try {
    const query = calculateDashboardStats(req.user.shopId);
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('DB_TIMEOUT')), 20000));
    const result = await Promise.race([query, timeout]);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'DB_TIMEOUT') {
      return res.status(503).json({ error: 'DB_TIMEOUT', retryAfter: 5 });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
export default router;
