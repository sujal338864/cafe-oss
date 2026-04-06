import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    shopId: string;
    role: Role;
    email: string;
  };
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    req.user = {
      id: payload.id,
      shopId: payload.shopId,
      role: payload.role as Role,
      email: payload.email
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware to check user role
 */
export const authorize = (...allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`[AUTH DEBUG] User: ${req.user.email}, Role: ${req.user.role}, Allowed: ${allowedRoles.join(', ')}`);

    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`[AUTH FAIL] User ${req.user.email} (${req.user.role}) attempted restricted action. Needs: ${allowedRoles.join(', ')}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * Middleware to validate request body against schema
 */
export const validateRequest = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
  };
};

/**
 * Middleware to handle async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
