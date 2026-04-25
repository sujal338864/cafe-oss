import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireFranchiseMode, requireOrgAccess } from '../middleware/orgAuth';
import { OrgService } from '../services/org.service';
import { prisma } from '../common/prisma';
import { AuthRequest } from '../middleware/auth';
import { gateResource } from '../middleware/planGate';
import { MenuSyncService } from '../services/menuSync.service';

const router = Router();

// All org routes require auth + franchise mode to be enabled
router.use(authenticate as any);
router.use(requireFranchiseMode as any);

/**
 * POST /api/org/create
 * Create a new organization (any authenticated user can do this)
 */
router.post('/create', async (req: AuthRequest, res: any) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Name and slug are required' });

    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const org = await OrgService.createOrganization(req.user!.id, name, cleanSlug);
    return res.status(201).json({ success: true, org });
  } catch (err: any) {
    if (err.message === 'Slug already taken') return res.status(409).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to create organization' });
  }
});

/**
 * GET /api/org/mine
 * Get all orgs the current user is a member of
 */
router.get('/mine', async (req: AuthRequest, res: any) => {
  try {
    const memberships = await (prisma as any).orgMembership.findMany({
      where: { userId: req.user!.id, isActive: true },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true, plan: true, isActive: true,
            _count: { select: { branches: true, members: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const orgsMap = new Map();
    for (const m of memberships) {
      if (!m.organization) continue;
      const orgId = m.organization.id;
      const existing = orgsMap.get(orgId);
      
      // Role priority logic: HQ_ADMIN (3) > REGIONAL_MANAGER (2) > BRANCH_MANAGER (1)
      const roleScore = (r: string) => r === 'HQ_ADMIN' ? 3 : r === 'REGIONAL_MANAGER' ? 2 : 1;
      
      if (!existing || roleScore(m.orgRole) > roleScore(existing.orgRole)) {
        orgsMap.set(orgId, {
          ...m.organization,
          orgRole: m.orgRole
        });
      }
    }

    return res.json({ organizations: Array.from(orgsMap.values()) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * GET /api/org/:orgId/dashboard
 * HQ Mega Dashboard — aggregated across all branches
 */
router.get('/:orgId/dashboard',
  requireOrgAccess(['HQ_ADMIN', 'REGIONAL_MANAGER', 'BRANCH_MANAGER']),
  async (req: any, res: any) => {
    try {
      const data = await OrgService.getHQDashboard(req.params.orgId, req.user!.id);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to load HQ dashboard' });
    }
  }
);

/**
 * GET /api/org/:orgId/leaderboard
 * Global leaderboard — top branches and items organization-wide
 */
router.get('/:orgId/leaderboard',
  requireOrgAccess(['HQ_ADMIN', 'REGIONAL_MANAGER']),
  async (req: any, res: any) => {
    try {
      const data = await OrgService.getOrgLeaderboard(req.params.orgId);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to load leaderboard' });
    }
  }
);

/**
 * GET /api/org/:orgId/branches
 * List all branches for an organization
 */
router.get('/:orgId/branches',
  requireOrgAccess(['HQ_ADMIN', 'REGIONAL_MANAGER', 'BRANCH_MANAGER']),
  async (req: any, res: any) => {
    try {
      const branches = await OrgService.getBranches(req.params.orgId);
      return res.json({ branches });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch branches' });
    }
  }
);

/**
 * POST /api/org/:orgId/branches/add
 * Add an existing shop as a franchise branch
 */
router.post('/:orgId/branches/add',
  requireOrgAccess(['HQ_ADMIN']),
  gateResource('branches') as any,
  async (req: any, res: any) => {
    try {
      const { shopId } = req.body;
      if (!shopId) return res.status(400).json({ error: 'shopId is required' });

      const result = await OrgService.addBranch(req.params.orgId, shopId, req.user!.id);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to add branch' });
    }
  }
);

/**
 * GET /api/org/:orgId/comparison
 * Side-by-side branch performance comparison
 */
router.get('/:orgId/comparison',
  requireOrgAccess(['HQ_ADMIN', 'REGIONAL_MANAGER']),
  async (req: any, res: any) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await OrgService.getBranchComparison(req.params.orgId, days);
      return res.json({ ...result, days });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to get branch comparison' });
    }
  }
);

/**
 * GET /api/org/:orgId/menu-templates
 * List all menu templates for an org
 */
router.get('/:orgId/menu-templates',
  requireOrgAccess(['HQ_ADMIN', 'REGIONAL_MANAGER']),
  async (req: any, res: any) => {
    try {
      const templates = await (prisma as any).menuTemplate.findMany({
        where: { organizationId: req.params.orgId, isActive: true },
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ templates });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch menu templates' });
    }
  }
);

/**
 * POST /api/org/:orgId/menu-templates
 * Create a new menu template
 */
router.post('/:orgId/menu-templates',
  requireOrgAccess(['HQ_ADMIN']),
  async (req: any, res: any) => {
    try {
      const { name, items, syncMode } = req.body;
      if (!name || !items) return res.status(400).json({ error: 'name and items are required' });

      const template = await (prisma as any).menuTemplate.create({
        data: {
          organizationId: req.params.orgId,
          name,
          items,
          syncMode: syncMode || 'ADDITIVE'
        }
      });
      return res.status(201).json({ template });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to create template' });
    }
  }
);

/**
 * POST /api/org/:orgId/menu-templates/:id/sync
 * ASYNC SYNC — Queues a job
 */
router.post('/:orgId/menu-templates/:id/sync',
  requireOrgAccess(['HQ_ADMIN']),
  async (req: any, res: any) => {
    try {
      const { branchIds, mode } = req.body;
      const template = await (prisma as any).menuTemplate.findUnique({
        where: { id: req.params.id }
      });

      if (!template) return res.status(404).json({ error: 'Template not found' });

      // If branchIds not provided, sync to all branches
      let targetIds = branchIds;
      if (!targetIds || !targetIds.length) {
        const branches = await (prisma as any).shop.findMany({
          where: { organizationId: req.params.orgId, isActive: true },
          select: { id: true }
        });
        targetIds = branches.map((b: any) => b.id);
      }

      const job = await MenuSyncService.queueSyncJob(
        req.params.orgId,
        req.params.id,
        targetIds,
        mode || template.syncMode
      );

      return res.json({ message: 'Sync job queued', jobId: job.id });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to queue sync job' });
    }
  }
);

/**
 * GET /api/org/:orgId/menu-sync-jobs
 */
router.get('/:orgId/menu-sync-jobs',
  requireOrgAccess(['HQ_ADMIN', 'REGIONAL_MANAGER']),
  async (req: any, res: any) => {
    try {
      const jobs = await (prisma as any).menuSyncJob.findMany({
        where: { organizationId: req.params.orgId },
        include: { template: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      return res.json({ jobs });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch sync logs' });
    }
  }
);

/**
 * GET /api/org/:orgId/menu-sync-jobs/:id
 * Drill down into a specific job's results
 */
router.get('/:orgId/menu-sync-jobs/:id',
  requireOrgAccess(['HQ_ADMIN', 'REGIONAL_MANAGER']),
  async (req: any, res: any) => {
    try {
      const job = await (prisma as any).menuSyncJob.findUnique({
        where: { id: req.params.id, organizationId: req.params.orgId },
        include: { template: { select: { name: true } } }
      });
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.json({ job });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch job details' });
    }
  }
);

/**
 * POST /api/org/:orgId/members/invite
 * Invite a user to the org (by email + role)
 */
router.post('/:orgId/members/invite',
  requireOrgAccess(['HQ_ADMIN']),
  async (req: any, res: any) => {
    try {
      const { email, orgRole, shopId } = req.body;
      const user = await prisma.user.findFirst({ where: { email } });
      if (!user) return res.status(404).json({ error: 'No user found with this email' });

      await (prisma as any).orgMembership.upsert({
        where: { organizationId_userId_shopId: { organizationId: req.params.orgId, userId: user.id, shopId: shopId || null } },
        create: { organizationId: req.params.orgId, userId: user.id, orgRole: orgRole || 'BRANCH_MANAGER', shopId: shopId || null },
        update: { isActive: true, orgRole: orgRole || 'BRANCH_MANAGER' }
      });

      return res.json({ success: true, message: `${email} added as ${orgRole}` });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to invite member' });
    }
  }
);

export default router;
