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
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, shopId: true }
    });

    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name || undefined
    };
    req.shopId = user.shopId;
    req.role = Role.ADMIN; // Defaulting to ADMIN for single-tenant owner

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
