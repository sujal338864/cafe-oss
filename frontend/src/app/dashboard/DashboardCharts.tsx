'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Fragment } from 'react';

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function DashboardCharts({ data, theme, forecast, dailyProfit }: { data: any, theme: any, forecast?: any[], dailyProfit?: any[] }) {
  const profitPulse = data?.profitPulse || [];
  const heatmap = data?.heatmap || null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
      {/* Premium Profit Pulse Chart */}
      <div style={{ 
        background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px 24px',
        gridColumn: '1 / -1', minHeight: 350
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Profit Pulse (Last 7 Days) 💰</h3>
          <div style={{ fontSize: 12, color: theme.textFaint }}>Real-time Margin Analysis</div>
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={profitPulse}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: theme.textFaint, fontSize: 10 }}
                tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.textFaint, fontSize: 10 }} tickFormatter={(val) => `₹${val/1000}k`} />
              <Tooltip 
                contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(val: any) => [fmt(val), '']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" name="Gross Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staffing Heatmap */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px 24px', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 15, color: theme.text }}>Staffing Intelligence Heatmap 🚦</h3>
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
        <div style={{ marginTop: 12, fontSize: 11, color: theme.textFaint, textAlign: 'right' }}>Higher density indicates peak hours requiring more staff.</div>
      </div>

      {/* NEW: Inventory Forecast */}
      {forecast && forecast.length > 0 && (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px 24px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Inventory Forecasting 🔮</h3>
            <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>Predicted stockout dates based on sales velocity</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {['Product', 'Current Stock', 'Daily Velocity', 'Days Remaining', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.map((f: any, i: number) => (
                  <tr key={i} style={{ borderBottom: i === forecast.length - 1 ? 'none' : `1px solid ${theme.border}` }}>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: theme.text }}>{f.name}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: theme.text }}>{f.currentStock} units</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: theme.text }}>{f.avgDailySales} / day</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: f.daysRemaining < 3 ? '#ef4444' : f.daysRemaining < 7 ? '#f59e0b' : '#10b981' }}>
                      {f.daysRemaining >= 999 ? '∞' : `${f.daysRemaining} days`}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ 
                        background: f.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : f.status === 'LOW' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: f.status === 'CRITICAL' ? '#ef4444' : f.status === 'LOW' ? '#f59e0b' : '#10b981',
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800
                      }}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW: Daily Revenue Records */}
      {dailyProfit && dailyProfit.length > 0 && (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '20px 24px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Daily Financial Audit 📅</h3>
            <div style={{ fontSize: 12, color: theme.textFaint }}>Net Profit = (Revenue - COGS - Expenses)</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                  {['Date', 'Orders', 'Revenue', 'Item Cost', 'Expenses', 'Net Profit'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyProfit.sort((a:any, b:any) => b.date.localeCompare(a.date)).map((d: any, i: number) => (
                  <tr key={i} style={{ borderBottom: i === dailyProfit.length - 1 ? 'none' : `1px solid ${theme.border}` }}>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: theme.text }}>{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, fontWeight: 600, color: theme.textFaint }}>{d.orderCount} orders</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: theme.text }}>{fmt(d.revenue)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#ef4444' }}>- {fmt(d.cost)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#ef4444' }}>- {fmt(d.expenses)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 900, color: d.profit >= 0 ? '#10b981' : '#ef4444' }}>{fmt(d.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
