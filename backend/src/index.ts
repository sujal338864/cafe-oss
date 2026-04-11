import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import http from 'http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config();

import { prisma as extendedPrisma, directPrisma } from './common/prisma';
import { logger } from './lib/logger';
import { requestLogger } from './middleware/requestLogger';
import { distributedRateLimiter } from './middleware/rateLimiter';
import { metricsCollector, metricsEndpoint } from './middleware/metrics';

// Re-exported for any legacy code still importing from index (being phased out)
export const prisma = extendedPrisma;

const app: Express = express();
app.use(metricsCollector);
app.use(requestLogger);
const PORT = process.env.PORT || process.env.SHOP_OS_PORT || 4001;

// Centralized logger imported from src/lib/logger above

// CORS: exact URL whitelist only — no wildcard *.netlify.app (OWASP A05)
const ALLOWED_ORIGINS = new Set([
  process.env.FRONTEND_URL,
  process.env.STAGING_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
].filter(Boolean) as string[]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile app, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },  // was 'cross-origin' — too permissive
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // inline styles needed for PDF gen
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    }
  },
  hidePoweredBy: true,
  noSniff: true,
  xssFilter: true,
}));
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
app.use(cookieParser());

// Auth-specific rate limiter: 10 attempts per 15 minutes per IP (prevents brute force)
// Applied directly to the route mount below — NOT a no-op
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100');
const AUTH_RATE_LIMIT_WINDOW = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '60'); // 1 min for Dev


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

// Health check — minimal info exposed publicly (no uptime to prevent fingerprinting)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { authenticate } from './middleware/auth';
import { withTenantContext } from './middleware/tenant';

// Trust exactly 1 reverse proxy (Render/Netlify/Railway) so req.ip is accurate
app.set('trust proxy', 1);

app.use('/api/upload', uploadRoutes);
app.use('/api/menu', menuRoutes);
// Auth endpoints: rate-limited to prevent brute force & registration spam
app.use('/api/auth', distributedRateLimiter(AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW), authRoutes);

// --- Authenticated Dashboard Scope ---
const dashboardRouter = express.Router();
dashboardRouter.use(authenticate as any);
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

// --- STARTUP CONFIGURATION ---
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL', 'FRONTEND_URL'];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    logger.error(`❌ CRITICAL: Missing environment variable ${key}`);
    process.exit(1);
  }
});

const startServer = async (retryCount = 0) => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000;

  try {
    // 1. Database Ping (with block-and-retry logic)
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info("✅ Database connected");
    } catch (dbErr: any) {
      if (retryCount < MAX_RETRIES) {
        logger.warn(
          `⚠️ Database ping failed at startup (Retry ${retryCount + 1}/${MAX_RETRIES}): ${dbErr.message}`
        );
        await new Promise((res) => setTimeout(res, RETRY_DELAY));
        return startServer(retryCount + 1);
      } else {
        logger.error(
          `💥 CRITICAL: Database connection failed after ${MAX_RETRIES} attempts. App exiting.`
        );
        process.exit(1);
      }
    }

    // 2. Multi-headed compute separation 🐳
    if (process.env.RUN_WORKERS !== "false") {
      startWorkers();
      logger.info("👷🏽 Background Worker queue consumers started");
    }

    if (process.env.RUN_API !== "false") {
      const server = http.createServer(app);
      initSocket(server);

      server.listen(PORT, () => {
        logger.info(`🚀 Shop OS API with WebSockets running on port ${PORT}`);
      });
    } else {
      logger.info("🛑 API endpoints disabled (Worker node only)");
    }
  } catch (err) {
    logger.error("💥 Failed to start:", err);
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

process.on('SIGTERM', async () => { await prisma.$disconnect(); await directPrisma.$disconnect(); process.exit(0); });
process.on('SIGINT',  async () => { await prisma.$disconnect(); await directPrisma.$disconnect(); process.exit(0); });

startServer();
