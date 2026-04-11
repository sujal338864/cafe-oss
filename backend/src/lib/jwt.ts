import jwt from 'jsonwebtoken';

/**
 * Returns the JWT secret from the environment.
 * Throws a clear error if JWT_SECRET is not set — prevents silent auth failures.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not set. Server cannot sign tokens.');
  }
  return secret;
};

/**
 * Signs a JWT token with standard payload.
 */
export const signToken = (payload: { id: string; shopId: string; role: string; email: string }): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
};

/**
 * Verifies a JWT token and returns its payload.
 * Throws on invalid or expired token.
 */
export const verifyToken = (token: string): any => {
  return jwt.verify(token, getJwtSecret());
};

/**
 * Signs a short-lived token (e.g., for password reset links).
 */
export const signShortToken = (payload: object, expiresIn: string | number = '1h'): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as any);
};
