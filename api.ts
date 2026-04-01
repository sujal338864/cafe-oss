// ============================================================
// Shop OS - Complete Backend API (Node.js + Express + Prisma)
// ============================================================

// ─── package.json ───────────────────────────────────────────
/*
{
  "name": "shop-os-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.7.0",
    "bcryptjs": "^2.4.3",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "nodemailer": "^6.9.7",
    "openai": "^4.24.1",
    "stripe": "^14.10.0",
    "winston": "^3.11.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "nodemon": "^3.0.2",
    "prisma": "^5.7.0",
    "typescript": "^5.3.2"
  }
}
*/

// ─── src/index.ts ───────────────────────────────────────────
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.SHOP_OS_PORT || 4001;

// ── Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// ── Routes ──────────────────────────────────────────────────
import authRoutes from './routes/auth';
import shopRoutes from './routes/shop';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import customerRoutes from './routes/customers';
import supplierRoutes from './routes/suppliers';
import orderRoutes from './routes/orders';
import purchaseRoutes from './routes/purchases';
import expenseRoutes from './routes/expenses';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import reportRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import subscriptionRoutes from './routes/subscriptions';

app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.listen(PORT, () => console.log(`🚀 Shop OS API running on port ${PORT}`));

// ─── src/middleware/auth.ts ──────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; shopId: string; role: string };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };

// ─── src/routes/auth.ts ─────────────────────────────────────
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const schema = z.object({
      shopName: z.string().min(2),
      ownerName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      phone: z.string().min(10),
    });
    const body = schema.parse(req.body);
    const exists = await prisma.shop.findUnique({ where: { email: body.email } });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const shop = await prisma.shop.create({
      data: {
        name: body.shopName,
        ownerName: body.ownerName,
        email: body.email,
        phone: body.phone,
        users: {
          create: {
            name: body.ownerName,
            email: body.email,
            passwordHash,
            role: 'ADMIN',
            isEmailVerified: true,
          }
        }
      },
      include: { users: true }
    });

    const token = jwt.sign(
      { id: shop.users[0].id, shopId: shop.id, role: 'ADMIN' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: shop.users[0].id, name: shop.ownerName, role: 'ADMIN' }, shop });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findFirst({
      where: { email },
      include: { shop: true }
    });
    if (!user || !await bcrypt.compare(password, user.passwordHash))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, shopId: user.shopId, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email }, shop: user.shop });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

// ─── src/routes/products.ts ─────────────────────────────────
import { Router } from 'express';
const productRouter = Router();

// GET /api/products?page=1&limit=20&search=&category=
productRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  const { page = 1, limit = 20, search = '', category, lowStock } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where: any = {
    shopId: req.user!.shopId,
    isActive: true,
    ...(search && { name: { contains: String(search), mode: 'insensitive' } }),
    ...(category && { categoryId: String(category) }),
    ...(lowStock === 'true' && { stock: { lte: prisma.product.fields.lowStockAlert } }),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take: Number(limit), include: { category: true }, orderBy: { name: 'asc' } }),
    prisma.product.count({ where })
  ]);
  res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// POST /api/products
productRouter.post('/', authenticate, authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const product = await prisma.product.create({
      data: { ...req.body, shopId: req.user!.shopId }
    });
    res.json(product);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// PUT /api/products/:id
productRouter.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.json(product);
});

// DELETE /api/products/:id
productRouter.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthRequest, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true });
});

export default productRouter;

// ─── src/routes/orders.ts ───────────────────────────────────
const orderRouter = Router();

// POST /api/orders - Create invoice/sale
orderRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { customerId, items, discountAmount = 0, paymentMethod, notes } = req.body;

    // Calculate totals
    let subtotal = 0, taxAmount = 0;
    for (const item of items) {
      subtotal += item.unitPrice * item.quantity;
      taxAmount += (item.unitPrice * item.quantity * (item.taxRate / 100));
    }
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Generate invoice number
    const count = await prisma.order.count({ where: { shopId: req.user!.shopId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(5, '0')}`;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          shopId: req.user!.shopId,
          userId: req.user!.id,
          customerId: customerId || null,
          invoiceNumber,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          paidAmount: totalAmount,
          paymentMethod,
          notes,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              costPrice: item.costPrice,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0,
              discount: item.discount || 0,
              total: item.unitPrice * item.quantity,
            }))
          }
        },
        include: { items: true, customer: true }
      });

      // Deduct stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
        await tx.stockHistory.create({
          data: { productId: item.productId, type: 'SALE', quantity: -item.quantity, note: invoiceNumber }
        });
      }

      // Update customer balance if credit
      if (customerId && paymentMethod === 'CREDIT') {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            outstandingBalance: { increment: totalAmount },
            totalPurchases: { increment: totalAmount }
          }
        });
      }

      return newOrder;
    });

    res.json(order);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// GET /api/orders
orderRouter.get('/', authenticate, async (req: AuthRequest, res) => {
  const { page = 1, limit = 20, startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where: any = {
    shopId: req.user!.shopId,
    ...(startDate && endDate && {
      createdAt: { gte: new Date(String(startDate)), lte: new Date(String(endDate)) }
    })
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where, skip, take: Number(limit),
      include: { customer: true, items: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.order.count({ where })
  ]);
  res.json({ orders, total });
});

export default orderRouter;

// ─── src/routes/analytics.ts ────────────────────────────────
const analyticsRouter = Router();

analyticsRouter.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  const [
    todaySales, monthSales, lastMonthSales,
    totalCustomers, totalProducts, lowStockProducts,
    topProducts, recentOrders, monthlyRevenue
  ] = await Promise.all([
    // Today's sales
    prisma.order.aggregate({
      where: { shopId, createdAt: { gte: startOfDay }, status: 'COMPLETED' },
      _sum: { totalAmount: true }, _count: true
    }),
    // This month
    prisma.order.aggregate({
      where: { shopId, createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
      _sum: { totalAmount: true, taxAmount: true }, _count: true
    }),
    // Last month
    prisma.order.aggregate({
      where: { shopId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: 'COMPLETED' },
      _sum: { totalAmount: true }
    }),
    prisma.customer.count({ where: { shopId } }),
    prisma.product.count({ where: { shopId, isActive: true } }),
    // Low stock using raw query
    prisma.$queryRaw`
      SELECT id, name, stock, "lowStockAlert" FROM "Product"
      WHERE "shopId" = ${shopId} AND stock <= "lowStockAlert" AND "isActive" = true
      ORDER BY stock ASC LIMIT 10
    `,
    // Top products by revenue
    prisma.orderItem.groupBy({
      by: ['productId', 'name'],
      where: { order: { shopId, status: 'COMPLETED', createdAt: { gte: startOfMonth } } },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5
    }),
    // Recent orders
    prisma.order.findMany({
      where: { shopId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: true }
    }),
    // Monthly revenue for chart (last 6 months)
    prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon') as month,
        SUM("totalAmount")::float as revenue,
        COUNT(*)::int as orders
      FROM "Order"
      WHERE "shopId" = ${shopId} AND status = 'COMPLETED'
        AND "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt")
    `
  ]);

  // Calculate profit (revenue - cost)
  const monthProfit = Number(monthSales._sum.totalAmount || 0) * 0.25; // simplified; real: sum(selling-cost)*qty

  const growthPercent = lastMonthSales._sum.totalAmount
    ? ((Number(monthSales._sum.totalAmount) - Number(lastMonthSales._sum.totalAmount)) / Number(lastMonthSales._sum.totalAmount)) * 100
    : 0;

  res.json({
    today: { revenue: Number(todaySales._sum.totalAmount || 0), orders: todaySales._count },
    month: { revenue: Number(monthSales._sum.totalAmount || 0), orders: monthSales._count, profit: monthProfit },
    growth: Math.round(growthPercent),
    totalCustomers,
    totalProducts,
    lowStockProducts,
    topProducts,
    recentOrders,
    monthlyRevenue
  });
});

export default analyticsRouter;

// ─── src/routes/ai.ts ───────────────────────────────────────
import OpenAI from 'openai';

const aiRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

aiRouter.post('/chat', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    const shopId = req.user!.shopId;

    // Gather live business context
    const [products, orders, topProducts] = await Promise.all([
      prisma.product.findMany({ where: { shopId }, select: { name: true, stock: true, lowStockAlert: true, sellingPrice: true } }),
      prisma.order.findMany({
        where: { shopId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { totalAmount: true, createdAt: true }
      }),
      prisma.orderItem.groupBy({
        by: ['name'],
        where: { order: { shopId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        _sum: { total: true, quantity: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5
      })
    ]);

    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const lowStockItems = products.filter(p => p.stock <= p.lowStockAlert);

    const context = `
Shop Analytics Context:
- Total products: ${products.length}
- Monthly revenue: ₹${totalRevenue.toFixed(2)}
- Orders this month: ${orders.length}
- Low stock items (${lowStockItems.length}): ${lowStockItems.map(p => `${p.name} (${p.stock} left)`).join(', ')}
- Top selling products: ${topProducts.map(p => `${p.name} (₹${p._sum.total})`).join(', ')}
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI business assistant for a shop management system. Use the context below to answer questions accurately and concisely. Always be specific with numbers. Context: ${context}`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 500
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Auto insights
aiRouter.get('/insights', authenticate, async (req: AuthRequest, res) => {
  const shopId = req.user!.shopId;
  const insights = [];

  const lowStock = await prisma.product.findMany({
    where: { shopId, stock: { lte: 5 }, isActive: true }
  });
  if (lowStock.length > 0) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      message: `${lowStock.length} products are critically low on stock. Restock soon.`
    });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [thisWeek, lastWeek] = await Promise.all([
    prisma.order.aggregate({ where: { shopId, createdAt: { gte: weekAgo } }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { shopId, createdAt: { gte: twoWeeksAgo, lte: weekAgo } }, _sum: { totalAmount: true } })
  ]);

  const tw = Number(thisWeek._sum.totalAmount || 0);
  const lw = Number(lastWeek._sum.totalAmount || 0);
  if (lw > 0) {
    const change = ((tw - lw) / lw * 100).toFixed(0);
    insights.push({
      type: Number(change) >= 0 ? 'success' : 'warning',
      icon: Number(change) >= 0 ? '📈' : '📉',
      message: `Sales ${Number(change) >= 0 ? 'increased' : 'dropped'} ${Math.abs(Number(change))}% compared to last week.`
    });
  }

  res.json({ insights });
});

export default aiRouter;
