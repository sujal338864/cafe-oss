'use client';
import { useEffect, useState, Fragment } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { MarketingIntel } from '@/components/dashboard/MarketingIntel';

const DashboardCharts = dynamic(() => import('./DashboardCharts'), { 
  loading: () => <div style={{ height: 350, background: 'rgba(0,0,0,0.02)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>Loading Staffing Intelligence...</div>,
  ssr: false 
});

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [showInfo, setShowInfo] = useState<{ title: string, breakdown: any[], resultLabel: string, finalValue: number } | null>(null);

  // 1. FAST STATS query
  const { data: statsData, isLoading: statsLoading } = useQuery({ 
    queryKey: ['dashboard_stats'], 
    queryFn: () => api.get('/api/analytics/dashboard/stats').then(r => r.data),
    staleTime: 30000,
  });

  // 2. HEAVY CHARTS query
  const { data: chartsData, isLoading: chartsLoading } = useQuery({ 
    queryKey: ['dashboard_charts'], 
    queryFn: () => api.get('/api/analytics/dashboard/charts').then(r => r.data),
    staleTime: 60000,
  });

  // 3. AI Insights

  const { data: aiData, isLoading: aiLoading } = useQuery({ 
    queryKey: ['ai_insights'], 
    queryFn: () => api.get('/api/ai/insights').then(r => r.data).catch(e => {
      if (e.response?.status === 403) return { insight: '🔒 **AI Consultant is a PRO feature.**\nUpgrade to unlock automated bundles and trends.' };
      throw e;
    }),
    staleTime: 3600000 // 1 hour for AI
  });
  
  // 4. EXTRA METRICS (Sequential load to prevent pool timeout)
  const { data: forecastData } = useQuery({
    queryKey: ['inventory_forecast'],
    queryFn: () => api.get('/api/analytics/inventory-forecast').then(r => r.data),
    staleTime: 600000
  });

  const { data: dailyProfitData } = useQuery({
    queryKey: ['daily_profit_records'],
    queryFn: () => api.get('/api/analytics/daily-profit').then(r => r.data),
    staleTime: 600000
  });


  useEffect(() => {
    if (socket) {
      const handleOrderEvent = () => {
        // Invalidate the actual query keys used by the dashboard
        queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard_charts'] });
        queryClient.invalidateQueries({ queryKey: ['recent_orders'] });
      };
      socket.on('ORDER_CREATED', handleOrderEvent);
      socket.on('ORDER_UPDATED', handleOrderEvent);
      socket.on('ORDER_CANCELLED', handleOrderEvent);
      return () => {
        socket.off('ORDER_CREATED', handleOrderEvent);
        socket.off('ORDER_UPDATED', handleOrderEvent);
        socket.off('ORDER_CANCELLED', handleOrderEvent);
      };
    }
  }, [socket, queryClient]);

  const stats = statsData;
  const recentOrdersQuery = useQuery({ 
    queryKey: ['recent_orders'], 
    queryFn: () => api.get('/api/analytics/recent').then(r => r.data) 
  });
  const orders = recentOrdersQuery.data?.orders || [];
  const financialSummary = stats?.financialSummary;

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
      {statsLoading && (
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
          <Link href="/dashboard/products" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            + Product
          </Link>
          <Link href="/dashboard/expenses" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            + Expense
          </Link>
          <Link href="/dashboard/pos" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            + New Sale
          </Link>
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

      {/* AI Marketing Command Center */}
      <MarketingIntel />

      {/* Parallel Load: Premium Charts & intelligence */}
      <DashboardCharts 
        data={chartsData} 
        theme={theme} 
        forecast={forecastData?.forecasting} 
        dailyProfit={dailyProfitData?.profitList} 
      />

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
