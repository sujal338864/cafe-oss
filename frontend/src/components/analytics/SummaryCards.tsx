'use client';
import { useTheme } from '@/context/ThemeContext';

interface CardProps {
  title: string;
  value: string | number;
  sub: string;
  icon: string;
  color: string;
}

export function SummaryCard({ title, value, sub, icon, color }: CardProps) {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24, flex: 1, minWidth: 240, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: theme.text, marginBottom: 4 }}>{value}</div>
          <div style={{ fontSize: 13, color: theme.textFaint, fontWeight: 600 }}>{sub}</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function SummaryCards({ data, type }: { data: any, type: string }) {
  const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN');
  
  if (type === 'daily') {
    return (
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <SummaryCard title="Day Revenue" value={fmt(data.revenue)} sub={`${data.orders} orders placed`} icon="💰" color="#3b82f6" />
        <SummaryCard title="Day Expenses" value={fmt(data.expenses)} sub="Operating costs" icon="💸" color="#ef4444" />
        <SummaryCard title="Net Daily Profit" value={fmt(data.netProfit)} sub="After expenses" icon="📈" color="#10b981" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <SummaryCard title="Range Revenue" value={fmt(data.revenue)} sub={`${data.orders} total orders`} icon="📊" color="#7c3aed" />
      <SummaryCard title="Range Expenses" value={fmt(data.expenses)} sub="Total operating costs" icon="💸" color="#ef4444" />
      <SummaryCard title="Net Range Profit" value={fmt(data.netProfit)} sub="Revenue after expenses" icon="📈" color="#10b981" />
      <SummaryCard title="Avg. Order" value={fmt(data.revenue / (data.orders || 1))} sub="Per ticket value" icon="🎫" color="#f59e0b" />
    </div>
  );
}
