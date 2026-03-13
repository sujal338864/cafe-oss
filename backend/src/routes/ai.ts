// import { Router } from 'express';
// import OpenAI from 'openai';
// import { prisma } from '../index';
// import { authenticate, asyncHandler, AuthRequest } from '../middleware/auth';
// https://github.com/copilot
// const router = Router();
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// type Insight = {
// type: string;
// icon: string;
// title: string;
// message: string;
// action: string;
// };

// /**

// * POST /api/ai/chat
// * Chat with AI assistant
//   */
//   router.post(
//   '/chat',
//   authenticate,
//   asyncHandler(async (req: AuthRequest, res) => {
//   const { message } = req.body;

//   if (!message || typeof message !== 'string') {
//   return res.status(400).json({ error: 'Message is required' });
//   }

//   if (!process.env.OPENAI_API_KEY) {
//   return res.status(500).json({ error: 'AI service not configured' });
//   }

//   const shopId = req.user!.shopId;

//   try {
//   const [products, orders, topProducts, customers] = await Promise.all([
//   prisma.product.findMany({
//   where: { shopId },
//   select: { name: true, stock: true, lowStockAlert: true, sellingPrice: true }
//   }),
//   prisma.order.findMany({
//   where: {
//   shopId,
//   createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
//   },
//   select: { totalAmount: true, createdAt: true }
//   }),
//   prisma.orderItem.groupBy({
//   by: ['name'],
//   where: {
//   order: {
//   shopId,
//   createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
//   }
//   },
//   _sum: { total: true, quantity: true },
//   orderBy: { _sum: { total: 'desc' } },
//   take: 5
//   }),
//   prisma.customer.count({ where: { shopId } })
//   ]);

//   const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
//   const lowStockItems = products.filter(p => p.stock <= p.lowStockAlert);

//   const context = `
//   Shop Analytics Context:

// - Total products: ${products.length}
// - Monthly revenue: ₹${totalRevenue.toFixed(2)}
// - Orders this month: ${orders.length}
// - Total customers: ${customers}
// - Low stock items (${lowStockItems.length}): ${lowStockItems.map(p => `${p.name} (${p.stock} left)`).join(', ')}
// - Top selling products: ${topProducts.map(p => `${p.name} (₹${p._sum.total})`).join(', ')}
//   `;

//   ```
//   const response = await openai.chat.completions.create({
//     model: 'gpt-4o-mini',
//     messages: [
//       {
//         role: 'system',
//         content: `You are an AI business assistant for a shop management system. Use the context below to answer questions accurately and concisely. Always provide actionable insights.\n\n${context}`
//       },
//       { role: 'user', content: message }
//     ],
//     max_tokens: 500,
//     temperature: 0.7
//   });

//   const reply = response.choices[0]?.message?.content || 'Unable to generate response';

//   res.json({ reply });
//   ```

//   } catch (error) {
//   console.error('AI Chat Error:', error);
//   res.status(500).json({ error: 'Failed to process AI request' });
//   }
//   })
//   );

// /**

// * GET /api/ai/insights
// * Auto-generated business insights
//   */
//   router.get(
//   '/insights',
//   authenticate,
//   asyncHandler(async (req: AuthRequest, res) => {

//   const shopId = req.user!.shopId;
//   const insights: Insight[] = [];

//   // LOW STOCK CHECK
//   const lowStock = await prisma.product.findMany({
//   where: { shopId, stock: { lte: 5 }, isActive: true },
//   take: 5
//   });

//   if (lowStock.length > 0) {
//   insights.push({
//   type: 'warning',
//   icon: '⚠️',
//   title: 'Low Stock Alert',
//   message: `${lowStock.length} products are critically low on stock. Restock soon.`,
//   action: 'View Products'
//   });
//   }

//   // SALES TREND
//   const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
//   const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

//   const [thisWeek, lastWeek] = await Promise.all([
//   prisma.order.aggregate({
//   where: { shopId, createdAt: { gte: weekAgo }, status: 'COMPLETED' },
//   _sum: { totalAmount: true }
//   }),
//   prisma.order.aggregate({
//   where: { shopId, createdAt: { gte: twoWeeksAgo, lte: weekAgo }, status: 'COMPLETED' },
//   _sum: { totalAmount: true }
//   })
//   ]);

//   const tw = Number(thisWeek._sum.totalAmount || 0);
//   const lw = Number(lastWeek._sum.totalAmount || 0);

//   if (lw > 0) {
//   const change = ((tw - lw) / lw * 100).toFixed(1);

//   insights.push({
//   type: Number(change) >= 0 ? 'success' : 'warning',
//   icon: Number(change) >= 0 ? '📈' : '📉',
//   title: 'Sales Trend',
//   message: `Sales ${Number(change) >= 0 ? 'increased' : 'dropped'} ${Math.abs(Number(change))}% compared to last week.`,
//   action: 'View Analytics'
//   });
//   }

//   // OUTSTANDING PAYMENTS
//   const outstanding = await prisma.customer.aggregate({
//   where: { shopId, outstandingBalance: { gt: 0 } },
//   _sum: { outstandingBalance: true },
//   _count: true
//   });

//   if (outstanding._count > 0) {
//   insights.push({
//   type: 'info',
//   icon: '💳',
//   title: 'Outstanding Payments',
//   message: `${outstanding._count} customers owe ₹${Number(outstanding._sum.outstandingBalance || 0).toFixed(2)}.`,
//   action: 'View Customers'
//   });
//   }

//   // TOP PRODUCT
//   const topProduct = await prisma.orderItem.groupBy({
//   by: ['name'],
//   where: {
//   order: {
//   shopId,
//   createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
//   }
//   },
//   _sum: { quantity: true },
//   orderBy: { _sum: { quantity: 'desc' } },
//   take: 1
//   });

//   if (topProduct.length > 0) {
//   insights.push({
//   type: 'success',
//   icon: '⭐',
//   title: 'Top Product',
//   message: `${topProduct[0].name} is your best seller this week. Consider increasing stock.`,
//   action: 'View Products'
//   });
//   }

//   res.json({ insights });
//   })
//   );

// export default router;

