import { prisma } from '../index';

export const calculateDashboardStats = async (shopId: string) => {
  // Run sequentially to avoid connection pool exhaustion on Supabase
  const totalOrders    = await prisma.order.count({ where: { shopId, status: 'COMPLETED' } });
  const revenueAgg     = await prisma.order.aggregate({ where: { shopId, status: 'COMPLETED' }, _sum: { totalAmount: true } });
  const totalCustomers = await prisma.customer.count({ where: { shopId } });
  const totalProducts  = await prisma.product.count({ where: { shopId } });
  const lowStockItems  = await prisma.product.count({ where: { shopId, stock: { lte: prisma.product.fields.lowStockAlert } } }).catch(() => 0);

  const totalRevenue  = Number(revenueAgg._sum.totalAmount || 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Monthly sales - last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const recentOrders = await prisma.order.findMany({
    where: { shopId, status: 'COMPLETED', createdAt: { gte: sixMonthsAgo } },
    select: { totalAmount: true, createdAt: true }
  });

  const monthMap: Record<string, { revenue: number; orders: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString('default', { month: 'short' });
    monthMap[key] = { revenue: 0, orders: 0 };
  }
  for (const o of recentOrders) {
    const key = new Date(o.createdAt).toLocaleString('default', { month: 'short' });
    if (monthMap[key]) {
      monthMap[key].revenue += Number(o.totalAmount);
      monthMap[key].orders  += 1;
    }
  }
  const monthlySales = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }));

  // Top products
  const topProductsRaw = await prisma.orderItem.groupBy({
    by: ['name'],
    where: { order: { shopId, status: 'COMPLETED' } },
    _sum: { quantity: true, total: true },
    orderBy: { _sum: { total: 'desc' } },
    take: 10
  });

  const topProducts = topProductsRaw.map((item: any) => ({
    name: item.name,
    revenue: Number(item._sum.total || 0),
    quantity: item._sum.quantity || 0
  }));

  // Category breakdown
  const categoryBreakdownRaw: any[] = await prisma.$queryRaw`
    SELECT c.name, SUM(oi.total) as revenue 
    FROM "Category" c 
    JOIN "Product" p ON p."categoryId" = c.id 
    JOIN "OrderItem" oi ON oi."productId" = p.id 
    JOIN "Order" o ON o.id = oi."orderId" 
    WHERE o."shopId" = ${shopId} AND o.status::text = 'COMPLETED' 
    GROUP BY c.name 
    ORDER BY revenue DESC
  `;

  const categoryBreakdown = categoryBreakdownRaw.map((c: any) => ({
    name: c.name,
    revenue: Number(c.revenue || 0)
  }));

  return {
    totalRevenue,
    totalOrders,
    avgOrderValue,
    totalCustomers,
    totalProducts,
    lowStockItems,
    monthlySales,
    topProducts,
    categoryBreakdown,
  };
};
