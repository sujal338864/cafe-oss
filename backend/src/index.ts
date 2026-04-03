import Redis from 'ioredis';
// --- ULTIMATE LOG SILENCE ---
// Intercept stderr to filter out Redis connection noise from nested dependencies (like BullMQ's internal ioredis)
const originalStderrWrite = process.stderr.write;
process.stderr.write = function (chunk: string | Uint8Array, ...args: any[]) {
  const content = typeof chunk === 'string' ? chunk : chunk.toString();
  const isRedisNoise = content.includes('ECONNREFUSED 127.0.0.1:6379') || content.includes('Connection is closed');
  if (isRedisNoise) return true; // Silence it
  return originalStderrWrite.apply(process.stderr, [chunk, ...args] as any);
} as any;

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import http from 'http';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './common/prisma';
import { logger } from './lib/logger';
import { requestLogger } from './middleware/requestLogger';
import { logRedisError } from './lib/redis';
import { distributedRateLimiter } from './middleware/rateLimiter';
import { metricsCollector, metricsEndpoint } from './middleware/metrics';


const app: Express = express();
app.use(metricsCollector);
app.use(requestLogger);
const PORT = process.env.PORT || process.env.SHOP_OS_PORT || 4001;

// Centralized logger imported from src/lib/logger above

// Allow any Netlify URL + localhost. No need to change env vars
// when Netlify generates preview deploy URLs.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl, mobile, etc.
    const ok =
      origin.endsWith('.netlify.app') ||
      origin.endsWith('.netlify.live') ||
      origin.endsWith('.vercel.app') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin === (process.env.FRONTEND_URL || '');
    if (ok) return callback(null, true);
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Shop-Id'],
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan('combined', {
  skip: (req, res) => {
    const is304 = res.statusCode === 304;
    const isNoisePath = req.originalUrl?.includes('/api/notifications') || req.originalUrl?.includes('/api/shop/profile');
    return is304 && isNoisePath;
  },
  stream: { write: (msg) => logger.info(msg.trim()) }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Auth Rate Limiter
 * Currently a pass-through for development; should be connected to 
 * distributedRateLimiter in production environments.
 */
export const authLimiter = (req: any, res: any, next: any) => next();

import uploadRoutes from './routes/upload';
import menuRoutes from './routes/menu';
import authRoutes from './routes/auth';
import shopRoutes from './routes/shop';
import productRoutes from './modules/products/products.routes';
import categoryRoutes from './modules/categories/categories.routes';
import customerRoutes from './modules/customers/customers.routes';
import supplierRoutes from './modules/suppliers/suppliers.routes';
import orderRoutes from './modules/orders/orders.routes';
import purchaseRoutes from './routes/purchases';
import expenseRoutes from './routes/expenses';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import reportRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import subscriptionRoutes from './routes/subscriptions';
import userRoutes from './routes/users';

// Health check also hit by keep-alive to prevent Render free-tier sleep
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

import { authenticate, tenantContext } from './middleware/auth';
import { withTenantContext } from './middleware/tenant';

app.use('/api/upload', uploadRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/auth', authRoutes);

// --- Authenticated Dashboard Scope ---
const dashboardRouter = express.Router();
dashboardRouter.use(authenticate as any);
dashboardRouter.use(tenantContext as any);
dashboardRouter.use(withTenantContext as any);

dashboardRouter.use('/shop', shopRoutes);
dashboardRouter.use('/products', productRoutes);
dashboardRouter.use('/categories', categoryRoutes);
dashboardRouter.use('/customers', customerRoutes);
dashboardRouter.use('/suppliers', supplierRoutes);
dashboardRouter.use('/orders', orderRoutes);
dashboardRouter.use('/purchases', purchaseRoutes);
dashboardRouter.use('/expenses', expenseRoutes);
dashboardRouter.use('/analytics', analyticsRoutes);
dashboardRouter.use('/ai', aiRoutes);
dashboardRouter.use('/reports', reportRoutes);
dashboardRouter.use('/notifications', notificationRoutes);
dashboardRouter.use('/subscriptions', subscriptionRoutes);
dashboardRouter.use('/users', userRoutes);

app.use('/api', dashboardRouter);


// Readiness Probe 🟡
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check Database
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis
    const { redis } = await import('./lib/redis');
    const redisStatus = await redis.ping();

    if (redisStatus !== 'PONG') {
      throw new Error('Redis ping failed');
    }

    res.status(200).json({
      status: 'UP',
      timestamp: new Date(),
      services: {
        database: 'UP',
        redis: 'UP'
      }
    });
  } catch (err: any) {
    logger.error('[Readiness] Check failed:', err);
    res.status(503).json({
      status: 'DOWN',
      timestamp: new Date(),
      error: err.message || 'Service Unavailable'
    });
  }
});

// Metrics Exporter for Prometheus 📊
app.get('/metrics', metricsEndpoint);

// ERROR HANDLING 
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ STARTUP ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
import { startWorkers } from './jobs';
import { initSocket } from './lib/socket';

const startServer = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connected');

    // Multi-headed compute separation 🐳
    if (process.env.RUN_WORKERS !== 'false') {
      startWorkers();
      logger.info('👷🏽 Background Worker queue consumers started');
    }

    if (process.env.RUN_API !== 'false') {
      const server = http.createServer(app);
      initSocket(server);

      server.listen(PORT, () => {
        logger.info(`🚀 Shop OS API with WebSockets running on port ${PORT}`);
      });
    } else {
      logger.info('🛑 API endpoints disabled (Worker node only)');
    }
  } catch (err) {
    logger.error('💥 Failed to start:', err);
    process.exit(1);
  }
};

// Silence Redis connection noise globally to keep logs clean
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ECONNREFUSED' && err?.port === 6379) return;
  logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
  const msg = (reason as any)?.message || String(reason);
  if ((reason as any)?.code === 'ECONNREFUSED' || msg.includes('Connection is closed')) return;
  logger.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });

startServer();
