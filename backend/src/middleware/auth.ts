import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../common/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  shopId?: string;
  role?: Role;
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
 * Multi-Tenant Middleware (Injects Shop context)
 */
export const tenantContext = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.headers['x-shop-id'] as string;
    if (!shopId) return res.status(400).json({ error: 'Missing X-Shop-Id header' });

    // Verify membership
    const membership = await prisma.shopMember.findUnique({
      where: { userId_shopId: { userId: req.user!.id, shopId } },
      include: { shop: true }
    });

    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: 'Access denied: Not a member of this shop' });
    }

    if (!membership.shop.isActive) {
      return res.status(403).json({ error: 'Shop is inactive' });
    }

    req.shopId = shopId;
    req.role = membership.role;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal Server Error during tenant validation' });
  }
};

/**
 * Middleware to check user role
 */
export const authorize = (...allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.role) {
      return res.status(401).json({ error: 'Unauthorized (No shop context)' });
    }

    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this branch' });
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
