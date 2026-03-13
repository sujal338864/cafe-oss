'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats,  setStats]  = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, ordersRes] = await Promise.allSettled([
        api.get('/api/analytics/dashboard'),
        api.get('/api/orders?limit=10'),
      ]);
      if (statsRes.status === 'fulfilled')  setStats(statsRes.value.data);
      if (ordersRes.status === 'fulfilled') {
        const d = ordersRes.value.data;
        setOrders(d.orders || d.data || (Array.isArray(d) ? d : []));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── EXACT fields the backend returns ──────────────────────────
  // analytics/dashboard returns: totalRevenue, totalOrders, avgOrderValue,
  //   totalCustomers, totalProducts, lowStockItems, monthlySales, topProducts, categoryBreakdown
  // It does NOT return todayRevenue or recentOrders - we fetch orders separately
  const totalRevenue   = Number(stats?.totalRevenue   ?? 0);
  const totalOrders    = Number(stats?.totalOrders    ?? 0);
  const totalCustomers = Number(stats?.totalCustomers ?? 0);
  const totalProducts  = Number(stats?.totalProducts  ?? 0);
  const lowStockItems  = Number(stats?.lowStockItems  ?? 0);
  const avgOrderValue  = Number(stats?.avgOrderValue  ?? 0);

  // Today's revenue: calculate from orders fetched (createdAt = today)
  const todayStr = new Date().toDateString();
  const todayOrders  = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr);
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const card: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '18px 20px',
  };

  if (loading) return (
    <div style={{ color: theme.textMuted, padding: 40, textAlign: 'center' }}>Loading dashboard...</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>
            {greeting}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: theme.textFaint, fontSize: 13, marginTop: 3 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <a href="/dashboard/pos" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          + New Sale
        </a>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: theme.textFaint, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Revenue Today</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: theme.text, marginBottom: 4 }}>{fmt(todayRevenue)}</div>
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{todayOrders.length} orders today</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: theme.textFaint, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Total Revenue</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: theme.text, marginBottom: 4 }}>{fmt(totalRevenue)}</div>
          <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>{totalOrders} orders total</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: theme.textFaint, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Total Products</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: theme.text, marginBottom: 4 }}>{totalProducts}</div>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>{lowStockItems} low stock</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: theme.textFaint, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Customers</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: theme.text, marginBottom: 4 }}>{totalCustomers}</div>
          <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>Avg order {fmt(avgOrderValue)}</div>
        </div>
      </div>

      {/* Recent Orders */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>Recent Orders</div>
          <a href="/dashboard/orders" style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
        </div>
        {orders.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: theme.textFaint }}>
            No orders yet. <a href="/dashboard/pos" style={{ color: '#a78bfa' }}>Create first sale</a>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Invoice', 'Customer', 'Amount', 'Method', 'Status', 'Date'].map(col => (
                <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${theme.border}` }}>{col}</th>
              ))}</tr>
            </thead>
            <tbody>
              {orders.map((o: any, i: number) => {
                const paid = o.paymentStatus === 'PAID';
                return (
                  <tr key={o.id || i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa' }}>#{o.invoiceNumber}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: theme.text }}>{o.customer?.name || 'Walk-in'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: theme.text }}>{fmt(o.totalAmount)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: 'rgba(59,130,246,.14)', color: '#3b82f6', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{o.paymentMethod}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: paid ? 'rgba(16,185,129,.14)' : 'rgba(245,158,11,.14)', color: paid ? '#10b981' : '#f59e0b', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: theme.textFaint }}>
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
