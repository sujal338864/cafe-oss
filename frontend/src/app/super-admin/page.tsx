"use client";

import { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const fmt = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export default function UltraAdminDashboard() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user, switchShop, logout, loading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [shopPage, setShopPage] = useState(1);

  // DEBUG LOGGING
  useEffect(() => {
    console.log('[DEBUG] Admin dashboard state:', { loading, hasUser: !!user });
    if (user) console.dir(user);
  }, [loading, user]);

  // Security: Bounce non-superadmins back to standard dashboard
  useEffect(() => {
    if (!loading && user && user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Non-superadmin detected, redirecting...', user.role);
      // router.push('/dashboard'); // TEMPORARILY DISABLED FOR DEBUGGING
    }
  }, [user, loading, router]);

  // 1. MEGA AGGREGATED CALL (The secret to <500ms load)
  // Stale-While-Revalidate: serve from cache, update in background
  const { data: mega, isLoading: loadingMega } = useQuery({
    queryKey: ['admin_mega'],
    queryFn: () => api.get('/api/admin/mega-dashboard').then((res: any) => res.data),
    staleTime: 30000, // 30s
    gcTime: 60000 * 5, // 5 min
  });

  // 2. SHIRT SHOP LIST (Separate for pagination)
  const { data: shopData, isLoading: loadingShops } = useQuery({
    queryKey: ['admin_shops', shopPage],
    queryFn: () => api.get(`/api/admin/shops?page=${shopPage}&limit=6`).then((res: any) => res.data),
    staleTime: 60000,
  });

  const shops = shopData?.shops || [];
  const pagination = shopData?.pagination || { total: 0, pages: 1 };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 20 }}>🛡️</div>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Establishing Secure Link...</div>
        </div>
      </div>
    );
  }

  if (!user || String(user.role).toUpperCase() !== 'SUPER_ADMIN') {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 20 }}>🚫</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#ef4444' }}>ACCESS DENIED: CLEARANCE LEVEL {String(user?.role || 'NONE').toUpperCase()}</div>
          <div style={{ color: theme.textFaint, fontSize: 12, marginTop: 8 }}>Identity: {user?.email}</div>
          <button onClick={() => router.push('/dashboard')} style={{ marginTop: 24, background: '#7c3aed', border: 'none', color: 'white', padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontWeight: 800 }}>Return to Terminal</button>
        </div>
      </div>
    );
  }

  const glassCard: React.CSSProperties = {
    background: isDark ? 'rgba(30, 30, 35, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'}`,
    borderRadius: 24,
    padding: '24px',
    boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.4)' : '0 10px 40px rgba(0,0,0,0.05)',
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        
        {/* Header Section */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ padding: '6px 12px', background: 'linear-gradient(90deg, #7c3aed, #4f46e5)', borderRadius: 100, fontSize: 10, fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Global Control</span>
              {mega?.source === 'redis-precomputed' && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>● Cached Data Active</span>}
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em' }}>Node Governance</h1>
            <p style={{ color: theme.textFaint, fontSize: 16 }}>Aggregated Infrastructure View — Precomputed {new Date(mega?.precomputedAt).toLocaleTimeString()}</p>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={toggleTheme} style={{ ...glassCard, padding: '10px 18px', borderRadius: 14, cursor: 'pointer', fontWeight: 600 }}>{isDark ? '☀️' : '🌙'}</button>
            <button onClick={logout} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 14, cursor: 'pointer', fontWeight: 800 }}>De-authenticate</button>
          </div>
        </header>

        {/* Level 1: Key Performance Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          {[
            { label: 'Active Shops', val: mega?.metrics?.totalShops, sub: 'Total Tenants', color: '#7c3aed' },
            { label: 'Total Accounts', val: mega?.metrics?.totalUsers, sub: 'Identity Layer', color: '#3b82f6' },
            { label: 'Cloud Orders', val: mega?.metrics?.totalOrders, sub: 'Transaction Flux', color: '#ec4899' },
            { label: '30D Revenue', val: fmt(mega?.metrics?.monthlyRevenue), sub: 'Gross Platform Ingress', color: '#10b981' },
          ].map((m, i) => (
            <div key={i} style={glassCard}>
              <div style={{ fontSize: 12, fontWeight: 800, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: m.color, margin: '8px 0' }}>{loadingMega ? '---' : m.val}</div>
              <div style={{ fontSize: 12, color: theme.textFaint, opacity: 0.7 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Level 2: Visual Intelligence & Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Top Performance Analytics */}
          <div style={glassCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>Top Tenant Performance</h3>
              <div style={{ fontSize: 12, color: theme.textFaint }}>Revenue vs. Target Index</div>
            </div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mega?.topShops || []}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme.textFaint, fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ background: theme.card, borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
                    itemStyle={{ color: '#7c3aed', fontWeight: 800 }}
                  />
                  <Bar dataKey="revenue" radius={[10, 10, 0, 0]} barSize={40}>
                    {(mega?.topShops || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#7c3aed' : '#4f46e5'} opacity={1 - index * 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* System Activity Feed */}
          <div style={{ ...glassCard, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>System Activity</h3>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {mega?.recentUsers?.map((u: any) => (
                <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.sidebar, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: theme.textFaint }}>Joined via {u.shop?.name || 'System'}</div>
                  </div>
                  <div style={{ fontSize: 10, color: theme.textFaint }}>{new Date(u.lastLogin || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Level 3: Tenant Governance Directory */}
        <div style={glassCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>Tenant Governance</h3>
            <div style={{ background: theme.bg, padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${theme.border}` }}>
              {pagination.total} Nodes Active
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Identity', 'Clearing House', 'Service Plan', 'Infrastructure', 'Access'].map(h => (
                  <th key={h} style={{ padding: '12px 0', fontSize: 11, fontWeight: 800, color: theme.textFaint, textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: '16px 0' }}>
                    <div style={{ fontWeight: 800, color: theme.text }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: theme.textFaint }}>ID: {s.id}</div>
                  </td>
                  <td style={{ padding: '16px 0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.email}</div>
                  </td>
                  <td style={{ padding: '16px 0' }}>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 900,
                      background: s.plan === 'PRO' ? '#ef4444' : '#3b82f6', color: 'white'
                    }}>{s.plan}</span>
                  </td>
                  <td style={{ padding: '16px 0' }}>
                    <div style={{ fontSize: 12 }}>{s._count.orders} Tx / {s._count.users} Users</div>
                  </td>
                  <td style={{ padding: '16px 0' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        onClick={() => { switchShop(s.id); router.push('/dashboard'); }}
                        style={{ border: `1px solid ${theme.border}`, background: 'transparent', padding: '6px 12px', borderRadius: 8, color: theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >Intervene</button>
                      <button style={{ background: s.isActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: s.isActive ? '#ef4444' : '#10b981', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {s.isActive ? 'Suspend' : 'Resume'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 8 }}>
              {Array.from({ length: pagination.pages }).map((_, i) => (
                <button key={i} onClick={() => setShopPage(i+1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: shopPage === i+1 ? '#7c3aed' : 'transparent', color: shopPage === i+1 ? 'white' : theme.text, cursor: 'pointer', fontWeight: 700 }}>{i+1}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
