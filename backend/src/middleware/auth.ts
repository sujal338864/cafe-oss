import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { Role } from '@prisma/client';
import { logger } from '../lib/logger';

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
    // 1. Try to get token from HttpOnly cookie (Production secure way)
    let token = req.cookies?.shop_os_token;

    // 2. Fallback to Authorization header (for Postman, mobile apps, etc.)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    const payload = verifyToken(token) as any;

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

    // Use logger.debug — PII stays out of production logs
    logger.debug(`[AUTH] User: ${req.user.email}, Role: ${req.user.role}, Checking: ${allowedRoles.join(', ')}`);

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`[AUTH] Forbidden: ${req.user.email} (${req.user.role}) attempted action requiring: ${allowedRoles.join(', ')}`);
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
