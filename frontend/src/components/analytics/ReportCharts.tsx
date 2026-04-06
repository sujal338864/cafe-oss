'use client';
import { useTheme } from '@/context/ThemeContext';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, Legend 
} from 'recharts';

export function RevenueTrendChart({ data }: { data: any[] }) {
  const { theme } = useTheme();
  const fmt = (v: any) => '₹' + Number(v).toLocaleString('en-IN');
  
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 24, padding: 24, height: 360 }}>
      <div style={{ fontWeight: 900, fontSize: 13, color: theme.text, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 2 }}>7-Day Revenue Pulse</div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: theme.textFaint, fontSize: 11, fontWeight: 700 }}
            tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.textFaint, fontSize: 11, fontWeight: 700 }} tickFormatter={(v) => `₹${v/1000}k`} />
          <Tooltip 
            contentStyle={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, color: theme.text, fontWeight: 700 }}
            formatter={(v) => [fmt(v), 'Revenue']}
          />
          <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopProductsChart({ data }: { data: any[] }) {
  const { theme } = useTheme();
  
  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 24, padding: 24, height: 360 }}>
      <div style={{ fontWeight: 900, fontSize: 13, color: theme.text, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 2 }}>Top Sellers (Quantity)</div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical">
          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: theme.textFaint, fontSize: 11, fontWeight: 700 }} />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: theme.text, fontSize: 12, fontWeight: 800 }} width={100} />
          <Tooltip 
            contentStyle={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12 }}
            cursor={{ fill: 'rgba(59,130,246,0.05)' }}
          />
          <Bar dataKey="quantity" fill="linear-gradient(90deg, #7c3aed, #3b82f6)" radius={[0, 8, 8, 0]} barSize={24}>
            {data.map((_, i) => <Cell key={i} fill={['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'][i % 5]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
