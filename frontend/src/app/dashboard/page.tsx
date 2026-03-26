'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { socket } = useSocket();
  const [stats,  setStats]  = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // AI Insights State
  const [aiInsight, setAiInsight] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  const loadAi = async () => {
    setAiLoading(true);
    try {
      const res = await api.get('/api/ai/insights');
      setAiInsight(res.data.insight);
    } catch (e: any) {
      if (e.response?.status === 403) {
        setAiInsight('🔒 **AI Consultant is a PRO feature.**\nPlease upgrade your plan in settings to unlock automated bundles, trends, and demand forecasts.');
      } else {
        console.error('[AI Insights Fetch Error]:', e);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const [sparking, setSparking] = useState(false);

  const handleSparkDemo = async () => {
    setSparking(true);
    try {
      await api.post('/api/shop/demo-data');
      await load(); // Reload dashboard
    } catch (e) {
      alert('Failed to load demo data');
    } finally {
      setSparking(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, ordersRes] = await Promise.allSettled([
        api.get('/api/analytics/dashboard'),
        api.get('/api/orders?limit=10'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (ordersRes.status === 'fulfilled') {
        const d = ordersRes.value.data;
        setOrders(d.orders || d.data || (Array.isArray(d) ? d : []));
      }
      
      // If both failed, show error
      if (statsRes.status === 'rejected' && ordersRes.status === 'rejected') {
        setError('Failed to load dashboard metrics. Service down.');
      }
    } catch (e) { 
      setError('An unexpected error occurred.'); 
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); loadAi(); }, []);

  useEffect(() => {
    if (socket) {
      console.log('[Dashboard] Binding socket events...');
      const handleEvent = () => {
        console.log('[Dashboard] Event received, reloading...');
        load();
      };
      
      socket.on('ORDER_CREATED', handleEvent);
      socket.on('ORDER_UPDATED', handleEvent);
      socket.on('ORDER_CANCELLED', handleEvent);
      
      return () => {
        socket.off('ORDER_CREATED', handleEvent);
        socket.off('ORDER_UPDATED', handleEvent);
        socket.off('ORDER_CANCELLED', handleEvent);
      };
    }
  }, [socket]);

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
    <div style={{ color: theme.textMuted, padding: 40, textAlign: 'center' }}>
      <div>Loading dashboard...</div>
      <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 8 }}>If this takes long, the backend is warming up (Render free tier).</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 🔴 Error Alert */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: 10, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={load} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Retry 🔄</button>
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/dashboard/products" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            + Product
          </a>
          <a href="/dashboard/expenses" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            + Expense
          </a>
          <a href="/dashboard/pos" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            + New Sale
          </a>
        </div>
      </div>

      {/* 🚀 Onboarding Checklist for New Tenants */}
      {totalProducts === 0 && (
        <div style={{ ...card, background: 'rgba(245, 158, 11, 0.05)', borderColor: '#f59e0b44', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <div style={{ fontWeight: 800, fontSize: 15, color: theme.text }}>Getting Started Checklist</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: theme.text }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span style={{ textDecoration: 'line-through', color: theme.textMuted }}>Create Account</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: theme.text }}>
              <span>⭕</span>
              <span>Add your first product to inventory <a href="/dashboard/products" style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>Go to Products →</a></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: theme.text }}>
              <span>⭕</span>
              <span>Configure Shop UPI & Settings <a href="/dashboard/settings" style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>Go to Settings →</a></span>
            </div>
          </div>

          {/* 🚀 Demo Data Action */}
          <div style={{ marginTop: 16, borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
            <button onClick={handleSparkDemo} disabled={sparking} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: sparking ? 'not-allowed' : 'pointer', opacity: sparking ? 0.7 : 1 }}>
              {sparking ? '🚀 Sparking...' : '🚀 Spark Demo Data'}
            </button>
            <span style={{ fontSize: 12, color: theme.textFaint, marginLeft: 10 }}>Fills dashboard with sample metrics in 1-click!</span>
          </div>
        </div>
      )}

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

      {/* AI Insights Panel */}
      <div style={{ ...card, background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(59, 130, 246, 0.05))', borderColor: '#7c3aed44' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div style={{ fontWeight: 800, fontSize: 14, color: theme.text }}>AI Business Consultant</div>
        </div>
        {aiLoading ? (
          <div style={{ color: theme.textMuted, fontSize: 13 }}>Analyzing data and compounding recommendations...</div>
        ) : (
          <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.6 }}>
            {aiInsight ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {aiInsight.split('\n').map((line, idx) => {
                  let str = line.trim();
                  if (str.startsWith('* ') || str.startsWith('- ')) {
                    return <div key={idx} style={{ paddingLeft: 12, marginBottom: 4 }}>• {str.substring(2)}</div>;
                  }
                  return <div key={idx} style={{ marginBottom: str ? 8 : 0 }}>{str}</div>;
                })}
              </div>
            ) : (
              <div style={{ color: theme.textFaint }}>No recommendations available. Triggering calculation...</div>
            )}
          </div>
        )}
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
