import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { tenantContextStorage } from '../common/context';

/**
 * Middleware to translate req.user.shopId to AsyncLocalStorage context
 */
export const withTenantContext = (req: AuthRequest, res: Response, next: NextFunction) => {
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  if (!isSuperAdmin && (!req.user || !req.user.shopId)) {
    return res.status(401).json({ error: 'Tenant identity missing (Unauthorized)' });
  }

  // Execute the remainder of the request execution chain INSIDE the context storage
  tenantContextStorage.run({ 
    shopId: req.user?.shopId || 'GLOBAL', 
    isSuperAdmin 
  }, () => {
    next();
  });
};
