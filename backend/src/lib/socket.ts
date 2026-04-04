import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { redisConnection } from '../jobs/config';
import { logRedisError } from './redis';

let io: Server | null = null;

export const initSocket = (server: HttpServer) => {
  const pubClient = new Redis(redisConnection);
  const subClient = new Redis(redisConnection);

  // CRITICAL: IOSET/BullMQ/Redis-Adapter MUST have error handlers to prevent process crash
  pubClient.on('error', (err) => logRedisError('SocketPub', err));
  subClient.on('error', (err) => logRedisError('SocketSub', err));

  // Connect manually after handlers are ready
  pubClient.connect().catch(() => {});
  subClient.connect().catch(() => {});

  io = new Server(server, {
    cors: {
      origin: '*', // Adjust for production
      methods: ['GET', 'POST']
    }
  });

  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join room based on shopId (e.g., from query or auth token)
    const shopId = socket.handshake.query.shopId as string;
    if (shopId) {
      socket.join(`shop:${shopId}`);
      console.log(`[Socket] Client ${socket.id} joined room for shop: ${shopId}`);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
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
    console.log(`[Socket] Emitted event [${event}] to shop [${shopId}]`);
  }
};
