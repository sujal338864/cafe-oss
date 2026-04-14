import { Router } from 'express';
import { prisma } from '../common/prisma';
import { authorize, asyncHandler } from '../middleware/auth';
import { redis } from '../lib/redis';
import { adminAnalyticsProcessor } from '../jobs/processors/adminAnalytics.processor';

const router = Router();

// Global Admin restriction
router.use(authorize('SUPER_ADMIN' as any) as any);

/**
 * GET /api/admin/mega-dashboard
 * ULTRA-OPTIMIZED MEGA ENDPOINT
 * Target: <200ms by serving precomputed Redis blob
 */
router.get('/mega-dashboard', asyncHandler(async (req: any, res: any) => {
  const cacheKey = 'admin:global:mega:dashboard';
  
  const dataBlob = await redis.get(cacheKey);
  
  if (!dataBlob) {
    // If cache miss, compute real-time once and prime the cache
    const freshData = await adminAnalyticsProcessor();
    return res.json({ ...freshData, source: 'hot-compute' });
  }

  res.json({ ...JSON.parse(dataBlob), source: 'redis-precomputed' });
}));

/**
 * GET /api/admin/shops
 * Paginated shop list with ULTRA-STRICT selection (Low Egress)
 */
router.get('/shops', asyncHandler(async (req: any, res: any) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;

  const [shops, total] = await Promise.all([
    prisma.shop.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true, users: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.shop.count()
  ]);

  res.json({
    shops,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) }
  });
}));

/**
 * GET /api/admin/users
 * Global user search with field filtering
 */
router.get('/users', asyncHandler(async (req: any, res: any) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;
  const search = req.query.search as string;

  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as any } },
      { email: { contains: search, mode: 'insensitive' as any } }
    ]
  } : {};

  const [users, total] = await Promise.all([
    (prisma.user as any).findMany({
      where: where as any,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        shop: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where: where as any })
  ]);

  res.json({
    users,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) }
  });
}));

/**
 * PATCH /api/admin/shops/:id
 */
router.patch('/shops/:id', asyncHandler(async (req: any, res: any) => {
  const { isActive, plan } = req.body;
  const shop = await prisma.shop.update({
    where: { id: req.params.id },
    data: { isActive, plan },
    select: { id: true, name: true, isActive: true, plan: true }
  });
  
  // Invalidate mega dashboard cache on significant change
  await redis.del('admin:global:mega:dashboard');
  
  res.json(shop);
}));

export default router;
