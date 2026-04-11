/**
 * FILE 4: src/routes/products.router.ts
 * Products Router with 20s Prisma Timeout race.
 */
import { Router } from 'express';
import { prisma } from '../common/prisma';
import { authenticate } from '../middleware/auth';
import { withTenantContext } from '../middleware/tenant';

const router = Router();
router.get('/', authenticate as any, withTenantContext as any, async (req: any, res: any) => {
  try {
    const query = prisma.product.findMany({ where: { shopId: req.user.shopId } });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('DB_TIMEOUT')), 20000));
    const result = await Promise.race([query, timeout]) as any[];
    res.json({ products: result });
  } catch (error: any) {
    if (error.message === 'DB_TIMEOUT') {
      return res.status(503).json({ error: 'DB_TIMEOUT', retryAfter: 5 });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
export default router;
