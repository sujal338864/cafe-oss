'use client';
import { useEffect, useState, Fragment } from 'react';
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
  const [profitList, setProfitList] = useState<any[]>([]);
  const [forecasting, setForecasting] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [showInfo, setShowInfo] = useState<{ title: string, breakdown: any[], resultLabel: string, finalValue: number } | null>(null);

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
      const [statsRes, ordersRes, profitRes, forecastRes, heatmapRes, financialRes] = await Promise.allSettled([
        api.get('/api/analytics/dashboard'),
        api.get('/api/orders?limit=10'),
        api.get('/api/analytics/daily-profit'),
        api.get('/api/analytics/inventory-forecast'),
        api.get('/api/analytics/peak-hours'),
        api.get('/api/analytics/financial-summary'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (ordersRes.status === 'fulfilled') {
        const d = ordersRes.value.data;
        setOrders(d.orders || d.data || (Array.isArray(d) ? d : []));
      }
      if (profitRes.status === 'fulfilled') setProfitList(profitRes.value.data.profitList || []);
      if (forecastRes.status === 'fulfilled') setForecasting(forecastRes.value.data.forecasting || []);
      if (heatmapRes.status === 'fulfilled') setHeatmap(heatmapRes.value.data.heatmap || null);
      if (financialRes.status === 'fulfilled') setFinancialSummary(financialRes.value.data.summary || null);
      
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
  // Today's stats are now fully calculated on the server for timezone accuracy
  const todayRevenue = Number(stats?.todayRevenue ?? 0);
  const todayCogs    = Number(stats?.todayCogs ?? 0);
  const todayCount   = Number(stats?.todayOrdersCount ?? 0);

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <StatCard 
          title="Net Profit (30d)" 
          value={fmt(financialSummary?.netProfit)} 
          sub={`Take-home after expenses`}
          color="#10b981"
          info={{ 
            title: '30-Day Net Profit Breakdown',
            breakdown: [
              { label: 'Total Sales Revenue', value: financialSummary?.totalRevenue, type: 'pos' },
              { label: 'Cost of Items (COGS)', value: -financialSummary?.totalCOGS, type: 'neg' },
              { label: 'Operating Expenses (OpEx)', value: -financialSummary?.totalOpEx, type: 'neg' }
            ],
            resultLabel: 'True Net Profit',
            finalValue: financialSummary?.netProfit
          }}
        />
        <StatCard 
          title="Today's Margin" 
          value={fmt(todayRevenue - todayCogs)} 
          sub={`${todayCount} orders today`}
          color="#3b82f6"
          info={{ 
            title: "Today's Margin Breakdown",
            breakdown: [
              { label: "Today's Revenue", value: todayRevenue, type: 'pos' },
              { label: "Today's Item Costs", value: -todayCogs, type: 'neg' }
            ],
            resultLabel: "Today's Gross Margin",
            finalValue: (todayRevenue - todayCogs)
          }}
        />
        <StatCard 
          title="Avg Order Value" 
          value={fmt(avgOrderValue)} 
          sub="Spending per visit"
          color="#f59e0b"
          info={{ 
            title: 'Avg Order Calculation',
            breakdown: [
              { label: 'Total Historical Revenue', value: totalRevenue, type: 'pos' },
              { label: 'Total Historical Orders', value: totalOrders, type: 'div' }
            ],
            resultLabel: 'Avg Value per Order',
            finalValue: avgOrderValue
          }}
        />
        <StatCard 
          title="Total Inventory" 
          value={totalProducts} 
          sub={`${lowStockItems} low stock items`}
          color="#a78bfa"
        />
      </div>

      {/* ℹ️ Math Transparency Modal */}
      {showInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 24, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 50px rgba(0,0,0,0.2)', animation: 'fadeUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: theme.text, margin: 0 }}>{showInfo.title}</h3>
              <button onClick={() => setShowInfo(null)} style={{ background: 'none', border: 'none', color: theme.textFaint, fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {showInfo.breakdown.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, color: theme.textMuted }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: item.type === 'neg' ? '#ef4444' : item.type === 'div' ? '#3b82f6' : theme.text }}>
                    {item.type === 'div' ? `÷ ${item.value}` : fmt(item.value)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1.5px dashed #10b98166', borderRadius: 16, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>{showInfo.resultLabel}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>{fmt(showInfo.finalValue)}</div>
              <div style={{ marginTop: 10, fontSize: 11, color: theme.textFaint, fontStyle: 'italic' }}>Calculation based on factual data from your ledger.</div>
            </div>

            <button onClick={() => setShowInfo(null)} style={{ width: '100%', background: '#111', color: '#fff', border: 'none', padding: 14, borderRadius: 14, marginTop: 20, fontWeight: 700, cursor: 'pointer' }}>Close Transparency View</button>
          </div>
        </div>
      )}

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

      {/* 🔮 Business Intelligence & Forecasting */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        
        {/* Peak-Hour Staffing Intelligence */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: theme.text }}>Peak-Hour Staffing Intelligence 📊</h3>
            <span style={{ fontSize: 11, background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>Staffing Heatmap</span>
          </div>
          <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(24, 1fr)', gap: 4, minWidth: 800 }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} style={{ fontSize: 9, color: theme.textFaint, textAlign: 'center' }}>{h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? (h-12)+'p' : h+'a'}</div>
              ))}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, d) => (
                <Fragment key={day}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.text }}>{day}</div>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const count = heatmap?.[d]?.[h] || 0;
                    const opacity = Math.min(count / 10, 1);
                    return (
                      <div key={h} title={`${day} ${h}:00 - ${count} orders`}
                        style={{ height: 24, background: count > 0 ? `rgba(124, 58, 237, ${0.1 + opacity * 0.9})` : 'rgba(0,0,0,0.02)', borderRadius: 4, border: count > 5 ? '1px solid #7c3aed44' : 'none' }} />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 15, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(0,0,0,0.02)' }} />
              <span style={{ fontSize: 11, color: theme.textFaint }}>Quiet</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(124, 58, 237, 0.4)' }} />
              <span style={{ fontSize: 11, color: theme.textFaint }}>Moderate</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#7c3aed' }} />
              <span style={{ fontSize: 11, color: theme.textFaint }}>Peak Rush</span>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: theme.text, fontWeight: 600, background: 'rgba(124, 58, 237, 0.05)', padding: '4px 10px', borderRadius: 8 }}>
              💡 Recommendation: Schedule +1 staff during dark purple zones.
            </div>
          </div>
        </div>

        {/* 🏢 Business Expansion Intelligence */}
        <div style={{ ...card, background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: 'none', color: '#fff', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Business expansion pulse</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Strategic Growth Index 🚀</h3>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
              Confidence Rate: {financialSummary?.marginPercent || 0}%
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Operational Health</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: (financialSummary?.marginPercent || 0) > 15 ? '#4ade80' : '#fbbf24' }}>
                {(financialSummary?.marginPercent || 0) > 15 ? '✅ PRIME FOR SCALE' : '⌛ OPTIMIZE MARGINS FIRST'}
              </div>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                {(financialSummary?.marginPercent || 0) > 15 
                  ? 'Your net margins are healthy enough to sustain a second location or franchise expansion.'
                  : 'Focus on reducing OpEx or increasing ticket size by 10% before physical expansion.'}
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Capital Reserve Suggestion</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{fmt(totalRevenue * 0.15)}</div>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                Estimated rainy-day fund needed for 3 months of operations based on current burn rate.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Expansion Strategy</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>Multi-Chain Architecture</div>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                Leverage CafeOS Multi-Tenant features to sync inventory across multiple hubs seamlessly.
              </p>
            </div>
          </div>
        </div>

        {/* Daily Profit List */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: theme.text }}>Daily Profit Pulse 💰</h3>
            <span style={{ fontSize: 11, background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>Last 7 Days</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profitList.length === 0 ? <p style={{ fontSize: 13, color: theme.textFaint }}>No sales yet this week.</p> : profitList.map(p => (
              <div key={p.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  <div style={{ fontSize: 11, color: theme.textFaint }}>{p.orderCount} Orders {p.expenses > 0 && `· ${fmt(p.expenses)} opEx`}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: p.profit >= 0 ? '#4ade80' : '#ef4444' }}>{p.profit >= 0 ? '+' : ''}{fmt(p.profit)}</div>
                  <div style={{ fontSize: 10, color: theme.textFaint }}>Net Margin: {p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Forecast */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: theme.text }}>Stockout Prediction 📈</h3>
            <span style={{ fontSize: 11, background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>Auto-Pilot</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {forecasting.filter(f => f.status !== 'HEALTHY').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                <p style={{ fontSize: 13, color: theme.textFaint }}>All inventory healthy. No predicted stockouts.</p>
              </div>
            ) : forecasting.filter(f => f.status !== 'HEALTHY').map(f => (
              <div key={f.productId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${f.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`, borderRadius: 10, background: f.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                <div style={{ fontSize: 18 }}>{f.status === 'CRITICAL' ? '⚠️' : '⏳'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: theme.textFaint }}>Stock: {f.currentStock} · Buying: {f.avgDailySales}/day</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: f.status === 'CRITICAL' ? '#ef4444' : '#fbbf24' }}>{f.daysRemaining === 999 ? '∞' : f.daysRemaining} days</div>
                  <div style={{ fontSize: 10, color: theme.textFaint }}>left</div>
                </div>
              </div>
            ))}
          </div>
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
