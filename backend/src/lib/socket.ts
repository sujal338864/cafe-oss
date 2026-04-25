import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { redisConnection } from '../jobs/config';
import { logger } from './logger';
import { ALLOWED_ORIGINS_ARRAY } from '../common/origins';

let io: Server | null = null;

export const initSocket = (server: HttpServer) => {
  const socketRedisOptions = { 
    ...redisConnection, 
    lazyConnect: false, 
    enableOfflineQueue: true 
  };

  const pubClient = new Redis(socketRedisOptions);
  const subClient = new Redis(socketRedisOptions);

  const handleRedisError = (name: string, err: any) => {
    if (err?.code === 'ECONNREFUSED') return; // Silence noise if local Redis is down
    logger.error(`[${name}]`, err);
  };

  pubClient.on('error', (err) => handleRedisError('SocketPub', err));
  subClient.on('error', (err) => handleRedisError('SocketSub', err));

  io = new Server(server, {
    cors: {
      origin: ALLOWED_ORIGINS_ARRAY,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // --- AUTH MIDDLEWARE (Phase 1 Fix) ---
  io.use(async (socket, next) => {
    try {
      const { verifyToken } = await import('./jwt');
      const token = socket.handshake.auth?.token || socket.handshake.query?.token as string;
      const shopId = socket.handshake.query?.shopId as string;

      if (!token) return next(new Error('Missing token'));

      const decoded = verifyToken(token) as any;
      if (!decoded) return next(new Error('Invalid token'));

      // Verify shop access
      if (shopId && decoded.role !== 'SUPER_ADMIN' && decoded.shopId !== shopId) {
        const { prisma } = await import('../common/prisma');
        const membership = await prisma.membership.findFirst({
          where: { userId: decoded.id, shopId, isActive: true }
        });
        if (!membership) return next(new Error('Unauthorized shop access'));
      }

      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  try {
    io.adapter(createAdapter(pubClient, subClient));
  } catch (err) {
    logger.error('[Socket] Redis adapter failed');
  }

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    
    socket.on('join_shop', (targetShopId: string) => {
      if (user.role === 'SUPER_ADMIN' || user.shopId === targetShopId) {
        socket.join(`shop:${targetShopId}`);
      }
    });

    const shopId = socket.handshake.query.shopId as string;
    if (shopId && (user.role === 'SUPER_ADMIN' || user.shopId === shopId)) {
      socket.join(`shop:${shopId}`);
    }

    socket.on('disconnect', () => {
      // Clean up
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const emitToShop = (shopId: string, event: string, data: any) => {
  if (io) {
    io.to(`shop:${shopId}`).emit(event, data);
  }
};
