"use client";

import { TrendingUp, ShoppingCart, Users, AlertCircle } from "lucide-react";

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface DashboardData {
  today?: { revenue: number; orders: number };
  month?: { revenue: number; orders: number; profit: number };
  totalCustomers?: number;
  lowStockProducts?: any[];
}

export function DashboardStats({ data }: { data?: DashboardData }) {
  const stats = [
    { label: "Revenue Today",   value: fmt(data?.today?.revenue),      icon: TrendingUp,  color: '#10b981', bg: 'rgba(16,185,129,.14)' },
    { label: "Orders Today",    value: data?.today?.orders || 0,        icon: ShoppingCart,color: '#60a5fa', bg: 'rgba(96,165,250,.14)' },
    { label: "Total Customers", value: data?.totalCustomers || 0,       icon: Users,       color: '#a78bfa', bg: 'rgba(167,139,250,.14)' },
    { label: "Low Stock Items", value: data?.lowStockProducts?.length || 0, icon: AlertCircle, color: '#f59e0b', bg: 'rgba(245,158,11,.14)' },
  ];

  const border = '1px solid rgba(255,255,255,0.07)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
      {stats.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} style={{ background: '#15151d', borderRadius: 14, border, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>{s.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
