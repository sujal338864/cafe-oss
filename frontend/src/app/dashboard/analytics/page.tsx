'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Area
} from 'recharts';

const fmt  = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');
const fmtK = (n: any) => { const v = Number(n || 0); return v >= 1000 ? 'Rs.' + (v/1000).toFixed(1) + 'k' : fmt(v); };

const COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const [data,     setData]     = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [orders,   setOrders]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<'revenue'|'profit'|'categories'|'products'>('revenue');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [analyticsRes, expensesRes, ordersRes] = await Promise.allSettled([
        api.get('/api/analytics/dashboard'),
        api.get('/api/expenses?limit=50'),
        api.get('/api/orders?limit=50'),
      ]);
      if (analyticsRes.status === 'fulfilled') setData(analyticsRes.value.data);
      if (expensesRes.status  === 'fulfilled') setExpenses(expensesRes.value.data.expenses || []);
      if (ordersRes.status    === 'fulfilled') {
        const d = ordersRes.value.data;
        setOrders(d.orders || d.data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };


  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted }}>Loading analytics...</div>;
  if (!data)   return <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted }}>No data. <button onClick={loadAll} style={{ color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button></div>;

  const monthlySales:   any[] = data.monthlySales    || [];
  const topProducts:    any[] = data.topProducts      || [];
  const categoryData:   any[] = data.categoryBreakdown || [];

  const monthlyExpenses: Record<string, number> = {};
  expenses.forEach(e => {
    const key = new Date(e.date || e.createdAt).toLocaleString('default', { month: 'short' });
    monthlyExpenses[key] = (monthlyExpenses[key] || 0) + Number(e.amount || 0);
  });

  const enrichedMonthly = monthlySales.map(m => ({
    ...m,
    expenses: monthlyExpenses[m.month] || 0,
    profit:   (m.revenue || 0) - (monthlyExpenses[m.month] || 0),
  }));

  const todayStr    = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr);
  const todayRev    = todayOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const estimatedProfit = Number(data.totalRevenue || 0) - totalExpenses;

  const methodMap: Record<string, number> = {};
  orders.forEach(o => { methodMap[o.paymentMethod] = (methodMap[o.paymentMethod] || 0) + Number(o.totalAmount || 0); });
  const methodData = Object.entries(methodMap).map(([name, value]) => ({ name, value }));

  const tt = { contentStyle: { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 9, color: theme.text, fontSize: 12 } };
  const card = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 };
  const tabBtn = (tb: typeof tab, label: string) => (
    <button onClick={() => setTab(tb)} style={{
      padding: '7px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
      background: tab === tb ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : theme.hover,
      color: tab === tb ? 'white' : theme.textMuted,
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Revenue Today',  val: fmt(todayRev),                    sub: `${todayOrders.length} orders`,          color: '#3b82f6' },
          { label: 'Total Revenue',  val: fmt(data.totalRevenue || 0),       sub: `${data.totalOrders || 0} orders total`, color: '#a78bfa' },
          { label: 'Total Expenses', val: fmt(totalExpenses),                sub: `${expenses.length} records`,           color: '#ef4444' },
          { label: 'Est. Profit',    val: fmt(Math.max(0, estimatedProfit)), sub: estimatedProfit >= 0 ? '▲ Profit' : '▼ Loss', color: estimatedProfit >= 0 ? '#10b981' : '#ef4444' },
        ].map(({ label, val, sub, color }) => (
          <div key={label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Avg Order Value', val: fmt(data.avgOrderValue || 0), color: '#f59e0b' },
          { label: 'Total Customers', val: data.totalCustomers || 0,      color: '#ec4899' },
          { label: 'Total Products',  val: data.totalProducts  || 0,      color: '#06b6d4' },
          { label: 'Low Stock',       val: data.lowStockItems  || 0,      color: data.lowStockItems > 0 ? '#ef4444' : '#10b981' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tabBtn('revenue',    '📈 Revenue')}
        {tabBtn('profit',     '💰 Profit vs Expenses')}
        {tabBtn('categories', '🥧 Categories')}
        {tabBtn('products',   '🏆 Top Products')}
      </div>

      {/* Revenue Tab */}
      {tab === 'revenue' && enrichedMonthly.length > 0 && (
        <div style={{ ...card, padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 16 }}>Monthly Revenue</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={enrichedMonthly}>
              <XAxis dataKey="month" tick={{ fill: theme.textFaint, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fill: theme.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip {...tt} formatter={(v: any) => fmt(v)} />
              <Area type="monotone" dataKey="revenue" fill="#7c3aed22" stroke="#7c3aed" strokeWidth={2} name="Revenue" />
              <Bar dataKey="orders" fill="#3b82f633" name="Orders" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Profit vs Expenses Tab */}
      {tab === 'profit' && (
        <div style={{ ...card, padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 16 }}>Revenue vs Expenses vs Profit</div>
          {enrichedMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={enrichedMonthly} barGap={4}>
                <XAxis dataKey="month" tick={{ fill: theme.textFaint, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fill: theme.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip {...tt} formatter={(v: any) => fmt(v)} />
                <Legend wrapperStyle={{ color: theme.textMuted, fontSize: 12 }} />
                <Bar dataKey="revenue"  fill="#7c3aed" name="Revenue"  radius={[4,4,0,0]} />
                <Bar dataKey="expenses" fill="#ef444466" name="Expenses" radius={[4,4,0,0]} />
                <Bar dataKey="profit"   fill="#10b981" name="Profit"   radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>No monthly data yet.</div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: categoryData.length ? '1fr 1fr' : '1fr', gap: 16 }}>
          {categoryData.length > 0 ? (
            <>
              <div style={{ ...card, padding: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 16 }}>Revenue by Category</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {categoryData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tt} formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...card, padding: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 14 }}>Category Breakdown</div>
                {categoryData.map((c: any, i: number) => {
                  const total = categoryData.reduce((s: number, x: any) => s + x.revenue, 0);
                  const pct = total > 0 ? (c.revenue / total) * 100 : 0;
                  return (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: COLORS[i % COLORS.length], fontWeight: 700 }}>{fmt(c.revenue)}</span>
                      </div>
                      <div style={{ height: 6, background: theme.hover, borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 99, transition: 'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ ...card, padding: 40, textAlign: 'center', color: theme.textFaint }}>No category data yet.</div>
          )}
          {methodData.length > 0 && (
            <div style={{ ...card, padding: '20px', gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 16 }}>Revenue by Payment Method</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {methodData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tt} formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                  {methodData.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                        <span style={{ fontSize: 13, color: theme.text }}>{m.name}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS[i % COLORS.length] }}>{fmt(m.value)}</span>
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
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, fontWeight: 700, fontSize: 14, color: theme.text }}>
            Top {topProducts.length} Products by Revenue
          </div>
          {topProducts.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: theme.textFaint }}>No product sales data yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {['#', 'Product', 'Units Sold', 'Revenue', 'Share'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p: any, i: number) => {
                  const maxRev = topProducts[0]?.revenue || 1;
                  const pct = (p.revenue / maxRev) * 100;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '11px 16px', fontWeight: 800, color: i < 3 ? ['#f59e0b','#94a3b8','#b45309'][i] : theme.textFaint, fontSize: 14 }}>
                        {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: theme.text, fontSize: 13 }}>{p.name}</td>
                      <td style={{ padding: '11px 16px', fontSize: 13, color: theme.textMuted }}>{p.quantity}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 700, color: '#a78bfa' }}>{fmt(p.revenue)}</td>
                      <td style={{ padding: '11px 16px', minWidth: 120 }}>
                        <div style={{ height: 6, background: theme.hover, borderRadius: 99 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 99 }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
