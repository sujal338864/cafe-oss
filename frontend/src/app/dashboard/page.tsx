'use client';
import { useEffect, useState, Fragment } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [showInfo, setShowInfo] = useState<{ title: string, breakdown: any[], resultLabel: string, finalValue: number } | null>(null);

  // Queries
  // Single Consolidated Mega-Query (The Performance Nuclear Option)
  const { data: megaData, isLoading: megaLoading } = useQuery({ 
    queryKey: ['mega_dashboard'], 
    queryFn: () => api.get('/api/analytics/dashboard-mega').then(r => r.data),
    staleTime: 30000, // 30 seconds
    gcTime: 60000     // 1 minute
  });

  const { data: aiData, isLoading: aiLoading } = useQuery({ 
    queryKey: ['ai_insights'], 
    queryFn: () => api.get('/api/ai/insights').then(r => r.data).catch(e => {
      if (e.response?.status === 403) return { insight: '🔒 **AI Consultant is a PRO feature.**\nUpgrade to unlock automated bundles and trends.' };
      throw e;
    }),
    staleTime: 3600000 // 1 hour for AI
  });


  useEffect(() => {

    if (socket) {
      const handleEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['mega_dashboard'] });
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
  }, [socket, queryClient]);

  const stats = megaData?.stats;
  const orders = megaData?.recentOrders?.orders || [];
  const profitList = megaData?.profitList?.profitList || [];
  const forecasting = megaData?.forecasting?.forecasting || [];
  const heatmap = megaData?.heatmap?.heatmap || null;
  const financialSummary = megaData?.financialSummary?.summary || null;
  const aiInsight = aiData?.insight || '';

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const totalRevenue   = Number(stats?.totalRevenue   ?? 0);
  const totalOrders    = Number(stats?.totalOrders    ?? 0);
  const totalCustomers = Number(stats?.totalCustomers ?? 0);
  const totalProducts  = Number(stats?.totalProducts  ?? 0);
  const lowStockItems  = Number(stats?.lowStockItems  ?? 0);
  const avgOrderValue  = Number(stats?.avgOrderValue  ?? 0);
  const totalInventoryValue = Number(stats?.totalInventoryValue ?? 0);
  const todayRevenue = Number(stats?.todayRevenue ?? 0);
  const todayCogs    = Number(stats?.todayCogs ?? 0);
  const todayMargin  = Number(stats?.todayMargin ?? 0);
  const todayCount   = Number(stats?.todayOrdersCount ?? 0);

  if (!mounted) return null;

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const card: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px 24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden'
  };

  const StatCard = ({ title, value, sub, color, info }: any) => (
    <div style={card}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
        {info && (
          <button onClick={() => setShowInfo(info)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: theme.textFaint, width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>ℹ</button>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: theme.text, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: color, fontWeight: 600 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {megaLoading && (
        <div style={{ color: theme.textMuted, padding: 10, textAlign: 'center', fontSize: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 10 }}>
          Refreshing metrics...
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>
            {greeting}, {user?.name?.split(' ')[0] || 'Partner'} 👋
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


      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <StatCard title="Net Profit (30d)" value={fmt(financialSummary?.netProfit)} sub="Take-home after expenses" color="#10b981" info={{ title: '30-Day Net Profit Breakdown', breakdown: [{ label: 'Total Sales Revenue', value: financialSummary?.totalRevenue, type: 'pos' }, { label: 'Cost of Items (COGS)', value: -financialSummary?.totalCOGS, type: 'neg' }, { label: 'Operating Expenses (OpEx)', value: -financialSummary?.totalOpEx, type: 'neg' }], resultLabel: 'True Net Profit', finalValue: financialSummary?.netProfit }} />
        <StatCard title="Today's Margin" value={fmt(todayMargin)} sub={`${todayCount} orders today`} color="#3b82f6" info={{ title: "Today's Margin Breakdown", breakdown: [{ label: "Today's Revenue", value: todayRevenue, type: 'pos' }, { label: "Today's Item Costs", value: -todayCogs, type: 'neg' }], resultLabel: "Today's Gross Margin", finalValue: todayMargin }} />
        <StatCard title="Avg Order Value" value={fmt(avgOrderValue)} sub="Spending per visit" color="#f59e0b" info={{ title: 'Avg Order Calculation', breakdown: [{ label: 'Total Historical Revenue', value: totalRevenue, type: 'pos' }, { label: 'Total Historical Orders', value: totalOrders, type: 'div' }], resultLabel: 'Avg Value per Order', finalValue: avgOrderValue }} />
        <StatCard title="Total Inventory" value={fmt(totalInventoryValue)} sub={`${lowStockItems} low stock items`} color="#a78bfa" />
      </div>

      {showInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 24, padding: 32, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text }}>{showInfo.title}</h3>
              <button onClick={() => setShowInfo(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: theme.text }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {showInfo.breakdown.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 14, color: theme.textMuted }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: item.type === 'neg' ? '#ef4444' : theme.text }}>{item.type === 'div' ? `÷ ${item.value}` : fmt(item.value)}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 800 }}>{showInfo.resultLabel}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>{fmt(showInfo.finalValue)}</div>
            </div>
            <button onClick={() => setShowInfo(null)} style={{ width: '100%', background: '#111', color: '#fff', border: 'none', padding: 14, borderRadius: 14, marginTop: 20, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* AI Insights Panel */}
      <div style={{ ...card, background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(59, 130, 246, 0.05))', borderColor: '#7c3aed44' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span>🤖</span>
          <div style={{ fontWeight: 800, fontSize: 14, color: theme.text }}>AI Business Consultant</div>
        </div>
        {aiLoading ? <div style={{ color: theme.textMuted, fontSize: 13 }}>Analyzing...</div> : <div style={{ fontSize: 13, color: theme.text, whiteSpace: 'pre-wrap' }}>{aiInsight}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Peak-Hour Heatmap */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15, color: theme.text }}>Peak-Hour Staffing Intelligence 📊</h3>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(24, 1fr)', gap: 4, minWidth: 800 }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (<div key={h} style={{ fontSize: 9, color: theme.textFaint, textAlign: 'center' }}>{h}h</div>))}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, d) => (
                <Fragment key={day}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.text }}>{day}</div>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const count = heatmap?.[d]?.[h] || 0;
                    return <div key={h} style={{ height: 24, background: count > 0 ? `rgba(124, 58, 237, ${0.1 + Math.min(count/10, 0.9)})` : 'rgba(0,0,0,0.02)', borderRadius: 4 }} title={`${count} orders`} />;
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Profit Pulse */}
        <div style={{ ...card }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15, color: theme.text }}>Daily Profit Pulse 💰</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profitList.map(p => (
              <div key={p.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{new Date(p.date).toLocaleDateString()}</div>
                  <div style={{ fontSize: 11, color: theme.textFaint }}>{p.orderCount} Orders</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, color: p.profit >= 0 ? '#4ade80' : '#ef4444' }}>{fmt(p.profit)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Forecast */}
        <div style={{ ...card }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15, color: theme.text }}>Stockout Prediction 📈</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {forecasting.filter(f => f.status !== 'HEALTHY').map(f => (
              <div key={f.productId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{f.name}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: f.status === 'CRITICAL' ? '#ef4444' : '#fbbf24' }}>{f.daysRemaining} days left</div>
              </div>
            ))}
            {forecasting.filter(f => f.status !== 'HEALTHY').length === 0 && <div style={{ textAlign: 'center', fontSize: 13, color: theme.textFaint }}>All inventory healthy.</div>}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, fontWeight: 700, fontSize: 14, color: theme.text }}>Recent Orders</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Invoice', 'Customer', 'Amount', 'Status', 'Date'].map(col => (
              <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, borderBottom: `1px solid ${theme.border}` }}>{col}</th>
            ))}</tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#a78bfa' }}>#{o.invoiceNumber}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: theme.text }}>{o.customer?.name || 'Walk-in'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: theme.text }}>{fmt(o.totalAmount)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: o.paymentStatus === 'PAID' ? 'rgba(16,185,129,.14)' : 'rgba(245,158,11,.14)', color: o.paymentStatus === 'PAID' ? '#10b981' : '#f59e0b', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{o.paymentStatus}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: theme.textFaint }}>{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
