import { prisma } from '../common/prisma';
import { getCache, setCache, deleteCache } from '../common/cache';
import { logger } from '../lib/logger';
import { MenuSyncService } from './menuSync.service';

export const OrgService = {

  /**
   * Create a new organization and make the calling user its HQ_ADMIN.
   */
  createOrganization: async (userId: string, name: string, slug: string) => {
    const exists = await (prisma as any).organization.findUnique({ where: { slug } });
    if (exists) throw new Error('Slug already taken');

    return (prisma as any).$transaction(async (tx: any) => {
      const org = await tx.organization.create({
        data: { name, slug, isActive: true }
      });

      await tx.orgMembership.create({
        data: {
          organizationId: org.id,
          userId,
          orgRole: 'HQ_ADMIN',
          isActive: true
        }
      });

      return org;
    });
  },

  /**
   * Add a shop as a branch of an organization.
   */
  addBranch: async (orgId: string, shopId: string, userId: string) => {
    // Update the shop's organizationId
    await (prisma as any).shop.update({
      where: { id: shopId },
      data: { organizationId: orgId }
    });

    // Add org membership for the user at branch level
    await (prisma as any).orgMembership.upsert({
      where: { 
        organizationId_userId_shopId: { organizationId: orgId, userId, shopId } 
      },
      create: { 
        organizationId: orgId, userId, shopId, 
        orgRole: 'BRANCH_MANAGER', 
        isActive: true 
      },
      update: { isActive: true }
    });

    // CRITICAL FIX: Invalidate HQ dashboard cache so the new branch shows up instantly
    await deleteCache(`org:dashboard:${orgId}:${userId}`);

    // CRITICAL FIX: Also ensure a regular shop Membership exists so /auth/switch doesn't 403
    await (prisma as any).membership.upsert({
      where: { 
        userId_shopId: { userId, shopId } 
      },
      create: { 
        userId, shopId, 
        role: 'ADMIN', // Branches created via HQ carry Admin rights for the creator
        isActive: true 
      },
      update: { isActive: true }
    });

    return { success: true };
  },

  /**
   * Get all branches info for an org (fast, for HQ dashboard sidebar).
   */
  getBranches: async (orgId: string) => {
    return (prisma as any).shop.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
        plan: true,
        createdAt: true,
        _count: { select: { orders: true } }
      },
      orderBy: { name: 'asc' }
    });
  },

  /**
   * Compute the HQ dashboard aggregate across all branches.
   * Reads from Redis cache first for speed.
   */
  getHQDashboard: async (orgId: string, userId: string) => {
    const cacheKey = `org:dashboard:${orgId}:${userId}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) return { ...cached, source: 'cache' };

    // 1. Get bulk statistics for all branches at once
    const branches = await (prisma as any).shop.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, city: true }
    });

    if (!branches.length) return { totalRevenue: 0, totalOrders: 0, branchCount: 0, branchData: [] };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [orderStats, customerStats] = await Promise.all([
      prisma.order.groupBy({
        by: ['shopId'],
        where: {
          shopId: { in: branches.map((b: any) => b.id) },
          createdAt: { gte: thirtyDaysAgo },
          status: 'COMPLETED'
        },
        _sum: { totalAmount: true },
        _count: { id: true }
      }),
      prisma.customer.groupBy({
        by: ['shopId'],
        where: {
          shopId: { in: branches.map((b: any) => b.id) }
        },
        _count: { id: true }
      })
    ]);

    // Map bulk results back to branch data
    const branchData = branches.map((branch: any) => {
      const stats = orderStats.find(s => s.shopId === branch.id);
      const customers = customerStats.find(s => s.shopId === branch.id);
      return {
        branchId: branch.id,
        branchName: branch.name,
        city: branch.city || '—',
        revenue: Number(stats?._sum.totalAmount || 0),
        orders: stats?._count.id || 0,
        customers: customers?._count.id || 0
      };
    });

    const totalRevenue = branchData.reduce((s, b) => s + b.revenue, 0);
    const totalOrders = branchData.reduce((s, b) => s + b.orders, 0);
    const sorted = [...branchData].sort((a, b) => b.revenue - a.revenue);

    const result = { 
      totalRevenue, 
      totalOrders, 
      branchCount: branches.length, 
      bestBranch: sorted[0] || null,
      weakestBranch: sorted[sorted.length - 1] || null,
      branchData: sorted,
      period: '30d'
    };
    await setCache(cacheKey, result, 600); // 10 min cache
    return result;
  },

  /**
   * Complex analytics: Global leaderboard across all branches of an org
   */
  getOrgLeaderboard: async (orgId: string) => {
    const branches = await (prisma as any).shop.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true }
    });
    const ids = branches.map((b: any) => b.id);

    const [branchStats, productStats] = await Promise.all([
      // 1. Top Branches by Revenue
      prisma.order.groupBy({
        by: ['shopId'],
        where: { shopId: { in: ids }, status: 'COMPLETED' },
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10
      }),
      // 2. Top Products Organization-wide
      prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: { shopId: { in: ids }, status: 'COMPLETED' } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10
      })
    ]);

    return {
      topBranches: branchStats.map(s => ({
        id: s.shopId,
        name: branches.find(b => b.id === s.shopId)?.name || 'Unknown',
        revenue: Number(s._sum.totalAmount || 0),
        orders: s._count.id
      })),
      topProducts: productStats.map(s => ({
        name: s.name,
        quantity: s._sum.quantity,
        revenue: Number(s._sum.total)
      }))
    };
  },

  /**
   * Branch comparison — side by side metrics with fallback resilience.
   */
  getBranchComparison: async (orgId: string, days = 30) => {
    const start = Date.now();
    try {
      const branches = await (prisma as any).shop.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, name: true, city: true }
      });

      if (!branches.length) return { comparison: [], source: 'live' };

      const since = new Date();
      since.setDate(since.getDate() - days);

      const [orderStats, productStats] = await Promise.all([
        prisma.order.groupBy({
          by: ['shopId'],
          where: {
            shopId: { in: branches.map((b: any) => b.id) },
            createdAt: { gte: since },
            status: 'COMPLETED'
          },
          _sum: { totalAmount: true },
          _count: { id: true },
          _avg: { totalAmount: true }
        }),
        Promise.all(branches.map(async (b: any) => {
          try {
            const item = await prisma.orderItem.groupBy({
              by: ['name'],
              where: { order: { shopId: b.id, createdAt: { gte: since } } },
              _count: { id: true },
              orderBy: { _count: { id: 'desc' } },
              take: 1
            });
            return { shopId: b.id, topProduct: item[0]?.name || '—' };
          } catch {
             return { shopId: b.id, topProduct: '—' };
          }
        }))
      ]);

      const comparisons = branches.map((b: any) => {
        const stats = orderStats.find(s => s.shopId === b.id);
        const top = productStats.find(s => s.shopId === b.id);
        
        return {
          branchId: b.id,
          branchName: b.name,
          city: b.city || '—',
          revenue: Number(stats?._sum.totalAmount || 0),
          orders: stats?._count.id || 0,
          avgTicket: Number(stats?._avg.totalAmount || 0),
          topProduct: top?.topProduct || '—'
        };
      });

      if (typeof logger !== 'undefined') {
        logger.info(`[OrgService] getBranchComparison resolved in ${Date.now() - start}ms`);
      }
      return { comparison: comparisons.sort((a, b) => b.revenue - a.revenue), source: 'live' };
    } catch (err: any) {
      if (typeof logger !== 'undefined') {
        logger.error(`[OrgService] Comparison failed: ${err.message}. Returning partial data.`);
      }
      return { comparison: [], source: 'fallback', error: 'Partial data displayed due to connection load.' };
    }
  },

  /**
   * Push a MenuTemplate to selected (or all) branches with full reconciliation.
   */
  syncMenuToBranches: async (orgId: string, templateId: string, targetBranchIds?: string[]) => {
    const template = await (prisma as any).menuTemplate.findFirst({
      where: { id: templateId, organizationId: orgId }
    });
    if (!template) throw new Error('Menu template not found');

    const branches = await (prisma as any).shop.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(targetBranchIds?.length ? { id: { in: targetBranchIds } } : {})
      },
      select: { id: true, name: true }
    });

    const syncMode = template.syncMode || 'ADDITIVE'; // ADDITIVE | REPLACE

    const results: any = [];

    for (const branch of branches) {
      try {
        const result = await MenuSyncService.syncToSingleBranch(branch.id, template, syncMode);
        results.push({ branchId: branch.id, branchName: branch.name, ...result, success: true });
      } catch (e: any) {
        results.push({ branchId: branch.id, branchName: branch.name, error: e.message, success: false });
      }
    }

    // 3. Log the Job Result
    try {
      await (prisma as any).menuSyncJob.create({
        data: {
          organizationId: orgId,
          templateId: templateId,
          targetBranchIds: targetBranchIds || branches.map(b => b.id),
          mode: syncMode,
          status: 'COMPLETED',
          result: { summary: results, timestamp: new Date() },
          completedAt: new Date()
        }
      });
    } catch (e) {
      logger.error(`[OrgService] Failed to log MenuSyncJob: ${e.message}`);
    }

    await (prisma as any).menuTemplate.update({
      where: { id: templateId },
      data: { lastSyncedAt: new Date() }
    });

    return { branches: branches.length, results };
  }
};
