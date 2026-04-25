'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';

export default function HQDashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);

  const { data: myOrgs, isLoading: loadingOrgs, error: orgError } = useQuery({
    queryKey: ['my-orgs'],
    queryFn: () => api.get('/api/org/mine').then(r => r.data.organizations),
  });

  const activeOrg = orgId ? myOrgs?.find((o: any) => o.id === orgId) : myOrgs?.[0];
  const activeOrgId = activeOrg?.id;

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['hq-dashboard', activeOrgId],
    queryFn: () => api.get(`/api/org/${activeOrgId}/dashboard`).then(r => r.data),
    enabled: !!activeOrgId,
  });

  const card = {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: 24,
  };

  const stat = (label: string, value: any, icon: string, accent = '#7c3aed') => (
    <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 28, opacity: 0.15 }}>{icon}</div>
      <div style={{ fontSize: 13, color: theme.textFaint, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );

  if (loadingOrgs) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: theme.textFaint }}>
      Loading your organizations...
    </div>
  );

  // Check for 503 specifically (Franchise Mode Disabled on backend)
  const is503 = (orgError as any)?.response?.status === 503;
  if (is503) return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: 40, textAlign: 'center', ...card }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 12 }}>Franchise Mode Locked</h2>
      <p style={{ color: theme.textFaint, marginBottom: 28, lineHeight: 1.6 }}>
        Franchise Mode is not enabled on your server instance. To unlock this, please set <strong>ENABLE_FRANCHISE_MODE=true</strong> in your backend environment variables (Render Dashboard).
      </p>
    </div>
  );

  if (!myOrgs?.length) return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: 40, textAlign: 'center', ...card }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🏢</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 12 }}>No Organization Yet</h2>
      <p style={{ color: theme.textFaint, marginBottom: 28, lineHeight: 1.6 }}>
        You are currently in <strong>Independent Mode</strong>. Create an Organization to unlock Franchise Mode and manage multiple branches from one HQ dashboard.
      </p>
      <Link href="/dashboard/hq/setup" style={{ 
        display: 'inline-block', padding: '12px 28px', background: '#7c3aed', color: 'white', 
        borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 15 
      }}>
        🚀 Create Organization
      </Link>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: theme.text, margin: 0 }}>
            🏢 HQ Dashboard
          </h1>
          <p style={{ color: theme.textFaint, marginTop: 4 }}>Cross-branch performance for <strong style={{ color: theme.text }}>{activeOrg?.name}</strong></p>
        </div>

        {/* Org Switcher */}
        {myOrgs.length > 1 && (
          <select
            value={activeOrgId}
            onChange={e => setOrgId(e.target.value)}
            style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, padding: '8px 14px', borderRadius: 8, fontSize: 14 }}
          >
            {myOrgs.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      {/* Mode Badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(124,58,237,0.1)', border: '1px solid #7c3aed', borderRadius: 20, marginBottom: 28 }}>
        <span style={{ color: '#7c3aed', fontSize: 13, fontWeight: 700 }}>🏢 FRANCHISE MODE</span>
        <span style={{ color: theme.textFaint, fontSize: 12 }}>{activeOrg?.orgRole}</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: theme.textFaint }}>Aggregating branch data...</div>
      ) : !dashboard ? (
        <div style={{ textAlign: 'center', padding: 60, color: theme.textFaint }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <p>You do not have permission to view aggregated HQ stats.</p>
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {stat('Total Revenue (30D)', `₹${Number(dashboard.totalRevenue || 0).toLocaleString('en-IN')}`, '💰', '#7c3aed')}
            {stat('Total Orders (30D)', dashboard.totalOrders?.toLocaleString() || '0', '🧾', '#06b6d4')}
            {stat('Active Branches', dashboard.branchCount, '🏪', '#10b981')}
            {stat('Best Branch', dashboard.bestBranch?.branchName || '—', '🏆', '#f59e0b')}
          </div>

          {/* Quick Nav */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { href: `/dashboard/hq/branches?orgId=${activeOrgId}`, icon: '📊', label: 'Branch Comparison', desc: 'Side-by-side performance' },
              { href: `/dashboard/hq/menu-sync?orgId=${activeOrgId}`, icon: '🔄', label: 'Menu Sync', desc: 'Push products to branches' },
              { href: `/dashboard/hq/setup?orgId=${activeOrgId}`, icon: '⚙️', label: 'HQ Settings', desc: 'Manage members & branches' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{ ...card, textDecoration: 'none', display: 'block', transition: 'border-color 0.2s' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: theme.textFaint }}>{item.desc}</div>
              </Link>
            ))}
          </div>

          {/* Branch Rankings Table */}
          <div style={card}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: theme.text, marginBottom: 20 }}>🏪 Branch Rankings (Last 30 Days)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                    {['Rank', 'Branch', 'City', 'Revenue', 'Orders', 'Customers'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: theme.textFaint }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.branchData?.map((b: any, i: number) => (
                    <tr key={b.branchId} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: i === 0 ? '#f59e0b' : theme.textFaint }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: theme.text }}>{b.branchName}</td>
                      <td style={{ padding: '12px 14px', color: theme.textFaint }}>{b.city || '—'}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7c3aed' }}>₹{b.revenue.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 14px', color: theme.text }}>{b.orders}</td>
                      <td style={{ padding: '12px 14px', color: theme.text }}>{b.customers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
