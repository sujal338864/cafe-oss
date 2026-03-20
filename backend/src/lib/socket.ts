import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

let io: Server | null = null;

export const initSocket = (server: HttpServer) => {
  const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const subClient = pubClient.duplicate();

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
