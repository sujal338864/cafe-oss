import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../common/prisma';

export interface OrgAuthRequest extends AuthRequest {
  org?: {
    id: string;
    name: string;
    slug: string;
    orgRole: string;
  };
}

/**
 * Middleware to verify user has access to an organization
 * and inject org context into req.org.
 * Usage: router.use(authenticate, requireOrgAccess)
 */
export const requireOrgAccess = (allowedRoles: string[] = ['HQ_ADMIN', 'REGIONAL_MANAGER', 'BRANCH_MANAGER']) => {
  return async (req: OrgAuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.params.orgId || req.body.organizationId || req.query.orgId as string;
      if (!orgId) return res.status(400).json({ error: 'Organization ID is required' });

      const memberships = await (prisma as any).orgMembership.findMany({
        where: {
          organizationId: orgId,
          userId: req.user!.id,
          isActive: true,
        },
        include: { organization: true }
      });

      if (!memberships || memberships.length === 0) {
        return res.status(403).json({ error: 'Access denied: Not a member of this organization' });
      }

      // Find if any of the memberships have an allowed role
      const validMembership = memberships.find((m: any) => allowedRoles.includes(m.orgRole));

      if (!validMembership) {
        return res.status(403).json({ error: `Requires one of: ${allowedRoles.join(', ')}` });
      }

      req.org = {
        id: validMembership.organization.id,
        name: validMembership.organization.name,
        slug: validMembership.organization.slug,
        orgRole: validMembership.orgRole
      };

      next();
    } catch (err: any) {
      return res.status(500).json({ error: 'Organization auth failed' });
    }
  };
};

/**
 * Flag check — returns 503 if ENABLE_FRANCHISE_MODE is false.
 */
export const requireFranchiseMode = (req: OrgAuthRequest, res: Response, next: NextFunction) => {
  if (process.env.ENABLE_FRANCHISE_MODE !== 'true') {
    return res.status(503).json({ error: 'Franchise mode is not enabled on this instance.' });
  }
  next();
};
