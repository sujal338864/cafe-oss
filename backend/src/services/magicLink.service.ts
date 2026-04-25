
import jwt from 'jsonwebtoken';
import { prisma } from '../common/prisma';
import { EmailService } from './email.service';
import { logger } from '../lib/logger';
import { getJwtSecret } from '../lib/jwt';

export const MagicLinkService = {
  /**
   * Request a magic login link
   */
  requestLink: async (email: string) => {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { shop: true }
    });

    if (!user) {
      // Security: Don't reveal if user exists, but don't send link
      logger.warn(`[MAGIC_LINK] Attempt for non-existent email: ${email}`);
      return { success: true }; 
    }

    // Create short-lived token (15 mins)
    const token = jwt.sign(
      { userId: user.id, type: 'magic_link' },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/magic-callback?token=${token}`;

    try {
      await EmailService.sendMagicLink(user.name, user.email, loginUrl);
      logger.info(`[MAGIC_LINK] Sent to ${user.email}`);
    } catch (err) {
      logger.error(`[MAGIC_LINK] Email fail: ${err.message}`);
      throw new Error('Failed to send magic link email');
    }

    return { success: true };
  },

  /**
   * Verify and return session
   */
  verifyToken: async (token: string) => {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      if (decoded.type !== 'magic_link') throw new Error('Invalid token type');

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { shop: true }
      });

      if (!user) throw new Error('User no longer exists');
      if (!user.isActive) throw new Error('Account is deactivated');

      return user;
    } catch (err) {
      logger.error(`[MAGIC_LINK] Verification fail: ${err.message}`);
      throw new Error('Link expired or invalid');
    }
  }
};
