'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Area
} from 'recharts';

const fmt  = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n: any) => { const v = Number(n || 0); return v >= 1000 ? '₹' + (v/1000).toFixed(1) + 'k' : fmt(v); };

const COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const { getActivePlan } = useAuth() as any;
  const router = useRouter();
  const isPro = getActivePlan() === 'PRO';
  
  const [data,     setData]     = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [orders,   setOrders]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [financial, setFinancial] = useState<any>(null);
  const [tab,      setTab]      = useState<'revenue'|'profit'|'categories'|'products'>('revenue');
  const [showInfo, setShowInfo] = useState<{ title: string, breakdown: any[], resultLabel: string, finalValue: number } | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [analyticsRes, expensesRes, ordersRes, financialRes] = await Promise.allSettled([
        api.get('/api/analytics/dashboard'),
        api.get('/api/expenses?limit=50'),
        api.get('/api/orders?limit=50'),
        api.get('/api/analytics/financial-summary'),
      ]);
      if (analyticsRes.status === 'fulfilled') setData(analyticsRes.value.data);
      if (expensesRes.status  === 'fulfilled') setExpenses(expensesRes.value.data.expenses || []);
      if (ordersRes.status    === 'fulfilled') {
        const d = ordersRes.value.data;
        setOrders(d.orders || d.data || []);
      }
      if (financialRes.status === 'fulfilled') setFinancial(financialRes.value.data.summary || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };


  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted }}>Loading analytics...</div>;
  if (!data)   return <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted }}>No data. <button onClick={loadAll} style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button></div>;

  const monthlySales:   any[] = data.monthlySales    || [];
  const topProducts:    any[] = data.topProducts      || [];
  const categoryData:   any[] = data.categoryBreakdown || [];

  const enrichedMonthly = monthlySales.map(m => ({
    ...m,
    cogs: m.cogs || 0,
    profit: m.profit || 0,
  }));

  const todayRev    = Number(data?.todayRevenue || 0);
  const totalExpenses = Number(financial?.totalOpEx || 0);
  const totalCOGS     = Number(financial?.totalCOGS || 0);
  const estimatedProfit = Number(financial?.netProfit || 0);

  const methodMap: Record<string, number> = {};
  orders.forEach(o => { methodMap[o.paymentMethod] = (methodMap[o.paymentMethod] || 0) + Number(o.totalAmount || 0); });
  const methodData = Object.entries(methodMap).map(([name, value]) => ({ name, value }));

  const tt = { contentStyle: { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 9, color: theme.text, fontSize: 12 } };
  const cardStyle: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: '24px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.04)', position: 'relative', overflow: 'hidden'
  };

  const StatCard = ({ title, value, sub, color, info }: any) => (
    <div style={cardStyle}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>{title}</div>
        {info && (
          <button onClick={() => setShowInfo(info)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: theme.textFaint, width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>ℹ</button>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: theme.text, marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: 13, color: color, fontWeight: 700 }}>{sub}</div>
    </div>
  );

  const tabBtn = (tb: typeof tab, label: string) => (
    <button onClick={() => setTab(tb)} style={{
      padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
      background: tab === tb ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : theme.card,
      color: tab === tb ? 'white' : theme.textMuted,
      boxShadow: tab === tb ? '0 8px 20px rgba(124, 58, 237, 0.3)' : 'none',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>{label}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Analytics</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>Business performance overview</p>
        </div>
        <button onClick={loadAll} style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          ↻ Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <StatCard 
          title="Revenue Today" 
          value={fmt(data?.todayRevenue)} 
          sub={`${data?.todayOrdersCount || 0} orders today`}
          color="#3b82f6"
          info={{ 
            title: "Today's Revenue Math",
            breakdown: [{ label: "Factual Day Sales", value: data?.todayRevenue, type: 'pos' }],
            resultLabel: "Gross Sales",
            finalValue: data?.todayRevenue
          }}
        />
        <StatCard 
          title="Est. Net Profit (Total)" 
          value={fmt(estimatedProfit)} 
          sub="Post-COGS & OpEx Ledger"
          color="#10b981"
          info={{ 
            title: "Total Profit Calculation",
            breakdown: [
              { label: "Historical Revenue", value: financial?.totalRevenue, type: 'pos' },
              { label: "Operating Expenses (OpEx)", value: -totalExpenses, type: 'neg' },
              { label: "Cost of Goods (COGS)", value: -totalCOGS, type: 'neg' }
            ],
            resultLabel: "Take-Home Net Profit",
            finalValue: estimatedProfit
          }}
        />
        <StatCard 
          title="Operating Expenses" 
          val={fmt(totalExpenses)} 
          value={fmt(totalExpenses)}
          sub={`${expenses.length} expense logs`}
          color="#ef4444"
          info={{ 
            title: "Expense Ledger",
            breakdown: expenses.slice(0, 5).map(e => ({ label: e.description || e.category, value: -e.amount, type: 'neg' })),
            resultLabel: "Total OpEx Spend",
            finalValue: totalExpenses
          }}
        />
        <StatCard 
          title="Inventory Assets" 
          value={data?.totalProducts} 
          sub={`${data?.lowStockItems} low stock items`}
          color="#a78bfa"
        />
      </div>

      {/* ℹ️ Math Modal */}
      {showInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 28, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 30px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: theme.text, margin: 0 }}>{showInfo.title}</h3>
              <button onClick={() => setShowInfo(null)} style={{ background: 'none', border: 'none', color: theme.textFaint, fontSize: 28, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {showInfo.breakdown.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, color: theme.textMuted }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: item.type === 'neg' ? '#ef4444' : theme.text }}>
                    {fmt(item.value)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(124, 58, 237, 0.05)', border: '2px solid rgba(124, 58, 237, 0.2)', borderRadius: 20, padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>{showInfo.resultLabel}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#7c3aed' }}>{fmt(showInfo.finalValue)}</div>
            </div>
            <button onClick={() => setShowInfo(null)} style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', border: 'none', padding: 16, borderRadius: 16, marginTop: 24, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(124, 58, 237, 0.2)' }}>Got it, thank you!</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tabBtn('revenue',    '📈 Revenue')}
        {tabBtn('profit',     '💰 Profit vs Expenses')}
        {tabBtn('categories', '🥧 Categories')}
        {tabBtn('products',   '🏆 Top Products')}
      </div>

      {/* Revenue Tab */}
      {tab === 'revenue' && enrichedMonthly.length > 0 && (
        <div style={{ ...cardStyle }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: theme.text, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📈 Monthly Growth Velocity</span>
            <span style={{ fontSize: 11, background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>LIVE</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={enrichedMonthly}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: theme.textFaint, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tickFormatter={fmtK} tick={{ fill: theme.textFaint, fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip {...tt} cursor={{ stroke: '#7c3aed44', strokeWidth: 2 }} formatter={(v: any) => fmt(v)} />
              <Area type="monotone" dataKey="revenue" fill="url(#colorRev)" stroke="#7c3aed" strokeWidth={4} name="Revenue" />
              <Bar dataKey="orders" fill="#3b82f633" name="Orders" radius={[4,4,0,0]} barSize={20} />
              <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} name="Net Margin" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Profit vs Expenses Tab */}
      {tab === 'profit' && (
        <div style={{ ...cardStyle }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: theme.text, marginBottom: 20 }}>Factual P&L Pulse 💹</div>
          {enrichedMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={enrichedMonthly} barGap={8}>
                <XAxis dataKey="month" tick={{ fill: theme.textFaint, fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={fmtK} tick={{ fill: theme.textFaint, fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip {...tt} cursor={{ fill: 'rgba(0,0,0,0.02)' }} formatter={(v: any) => fmt(v)} />
                <Legend wrapperStyle={{ paddingTop: 20, color: theme.textMuted, fontSize: 12, fontWeight: 700 }} />
                <Bar dataKey="revenue"  fill="#7c3aed" name="Revenue"  radius={[6,6,0,0]} />
                <Bar dataKey="cogs"     fill="#3b82f6" name="Item Costs (COGS)" radius={[6,6,0,0]} opacity={0.7} />
                <Bar dataKey="profit"   fill="#10b981" name="Net Profit"   radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 60, textAlign: 'center', color: theme.textFaint }}>No monthly data yet.</div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: categoryData.length ? '1fr 1fr' : '1fr', gap: 16 }}>
          {categoryData.length > 0 ? (
            <>
              <div style={{ ...cardStyle }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: theme.text, marginBottom: 20 }}>Revenue by Category 🥧</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={5} label={({ name, percent }: any) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {categoryData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip {...tt} formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...cardStyle }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: theme.text, marginBottom: 20 }}>Category Strength</div>
                {categoryData.map((c: any, i: number) => {
                  const total = categoryData.reduce((s: number, x: any) => s + x.revenue, 0);
                  const pct = total > 0 ? (c.revenue / total) * 100 : 0;
                  return (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: theme.text, fontWeight: 700 }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: COLORS[i % COLORS.length], fontWeight: 800 }}>{fmt(c.revenue)}</span>
                      </div>
                      <div style={{ height: 8, background: theme.hover, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 99, transition: 'width 0.6s ease-out' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ ...cardStyle , padding: 60, textAlign: 'center', color: theme.textFaint }}>No category data yet.</div>
          )}
          {methodData.length > 0 && (
            <div style={{ ...cardStyle , gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.text, marginBottom: 20 }}>Revenue by Payment Method 💳</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={70}>
                      {methodData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tt} formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
                  {methodData.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: 'rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        <span style={{ fontSize: 14, color: theme.text, fontWeight: 600 }}>{m.name}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: COLORS[i % COLORS.length] }}>{fmt(m.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Products Tab */}
      {tab === 'products' && (
        <div style={{ ...cardStyle }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: theme.text, marginBottom: 20 }}>🥇 Top Sellers by Gross Revenue</div>
          {topProducts.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: theme.textFaint }}>No product sales data yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {['#', 'Product', 'Units Sold', 'Revenue', 'Contribution'].map(h => (
                      <th key={h} style={{ padding: '16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p: any, i: number) => {
                    const maxRev = topProducts[0]?.revenue || 1;
                    const pct = (p.revenue / maxRev) * 100;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.2s', cursor: 'default' }}>
                        <td style={{ padding: '16px', fontWeight: 900, color: i < 3 ? ['#f59e0b','#94a3b8','#b45309'][i] : theme.textFaint, fontSize: 15 }}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: theme.textFaint }}>Product ID: {p.productId?.slice(-6)}</div>
                        </td>
                        <td style={{ padding: '16px', fontSize: 14, fontWeight: 600, color: theme.textMuted }}>{p.quantity}</td>
                        <td style={{ padding: '16px', fontWeight: 800, color: '#7c3aed', fontSize: 14 }}>{fmt(p.revenue)}</td>
                        <td style={{ padding: '16px', minWidth: 160 }}>
                          <div style={{ height: 8, background: theme.hover, borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i+1) % COLORS.length]})`, borderRadius: 99 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🏢 Strategic Growth Intelligence Module */}
      <div style={{ 
        ...cardStyle, 
        background: 'linear-gradient(135deg, #0f172a, #1e293b)', 
        border: 'none', 
        color: '#fff', 
        marginTop: 10,
        position: 'relative'
      }}>
        {!isPro && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(10px)',
            zIndex: 10, borderRadius: 20, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: 40 }}>🔒</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>PRO FEATURE</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Unlock Strategic Expansion Intelligence to scale your business.</div>
            </div>
            <button onClick={() => router.push('/dashboard/settings')} style={{
              background: 'linear-gradient(135deg,#f59e0b,#7c3aed)', color: '#fff', border: 'none',
              padding: '10px 24px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(124, 58, 237, 0.4)'
            }}>Upgrade to PRO</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, opacity: isPro ? 1 : 0.2 }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Expansion Intelligence</div>
            <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>Strategic Expansion Pulse 💹</h3>
          </div>
          <div style={{ background: '#10b98122', border: '1px solid #10b98144', color: '#10b981', padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800 }}>
            Operational Health: {data?.totalRevenue > 50000 ? 'EXCELLENT' : 'STABLE'}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32, opacity: isPro ? 1 : 0.2 }}>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>Expansion Readiness</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: data?.totalRevenue > 50000 ? '#4ade80' : '#fbbf24' }}>
              {data?.totalRevenue > 50000 ? '✅ PRIME FOR BRANCH #2' : '⌛ STRENGTHEN CORE UNIT'}
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
              {data?.totalRevenue > 50000 
                ? 'Your volume sustains multi-unit scalability. Recommend exploring cloud kitchen expansion.'
                : 'Focus on increasing Average Order Value by 10% before physical expansion.'}
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>Capital Reserve Strategy</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{fmt(data?.totalRevenue * 0.12)} /mo</div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
              Recommended savings to weather operational volatility based on your current burn rate.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>Customer Loyalty Vector</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>{Math.round((data?.totalOrders / (data?.totalCustomers || 1)) * 10) / 10}x Visits</div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
              Average frequency per customer. Ideal benchmark for scaling is 2.5x monthly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
