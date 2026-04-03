import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { tenantContextStorage } from '../common/context';

/**
 * Middleware to translate req.shopId to AsyncLocalStorage context.
 * Updated for multi-branch: uses req.shopId (set by tenantContext in auth.ts)
 * instead of the old req.user.shopId.
 */
export const withTenantContext = (req: AuthRequest, res: Response, next: NextFunction) => {
  const shopId = req.shopId || (req.user as any)?.shopId;
  if (!shopId) {
    return res.status(401).json({ error: 'Tenant identity missing (Unauthorized)' });
  }

  // Execute the remainder of the request execution chain INSIDE the context storage
  tenantContextStorage.run({ shopId }, () => {
    next();
  });
};
