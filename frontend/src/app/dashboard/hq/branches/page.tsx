'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

export default function BranchComparison() {
  const { theme } = useTheme();
  const params = useSearchParams();
  const orgId = params.get('orgId');
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['branch-comparison', orgId, days],
    queryFn: () => api.get(`/api/org/${orgId}/comparison?days=${days}`).then(r => r.data),
    enabled: !!orgId,
  });

  const card = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24 };
  const comparison = Array.isArray(data?.comparison) ? data.comparison : [];
  const maxRevenue = comparison.length > 0 ? Math.max(...comparison.map((b: any) => b.revenue)) : 1;

  if (!orgId) return (
    <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>
      Missing organization. Go back to <a href="/dashboard/hq" style={{ color: '#7c3aed' }}>HQ Dashboard</a>.
    </div>
  );

  if (isError) return (
    <div style={{ padding: 60, textAlign: 'center', ...card, maxWidth: 500, margin: '40px auto' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <h3 style={{ color: theme.text }}>Failed to load comparison</h3>
      <button onClick={() => refetch()} style={{ marginTop: 16, background: '#7c3aed', color: 'white', padding: '8px 20px', borderRadius: 8, border: 'none' }}>
        Try Again
      </button>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: theme.text, margin: 0 }}>📊 Branch Comparison</h1>
          <p style={{ color: theme.textFaint, marginTop: 4 }}>Side-by-side performance across all franchise branches</p>
        </div>
        
        <select 
          value={days} 
          onChange={e => setDays(Number(e.target.value))}
          style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, padding: '8px 12px', borderRadius: 8 }}
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 100, color: theme.textFaint }}>
          <div className="animate-spin" style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          Crunching branch data...
        </div>
      ) : comparison.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>📊</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 10 }}>No Data to Compare</h2>
          <p style={{ color: theme.textFaint }}>Wait for branches to process their first orders to see comparisons here.</p>
        </div>
      ) : (
        <>
          {/* Bar Chart Visual */}
          <div style={{ ...card, marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 20 }}>Revenue Comparison</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {comparison.map((b, i) => (
                <div key={b.branchId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{b.branchName}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>₹{b.revenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ height: 10, background: theme.bg, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, transition: 'width 1.2s ease',
                      width: `${(b.revenue / maxRevenue) * 100}%`,
                      background: i === 0 ? '#7c3aed' : i === 1 ? '#06b6d4' : `hsl(${204 + i * 40}, 70%, 55%)`
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Detail Table */}
          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 20 }}>Full Metrics Breakdown</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
                    {['Branch', 'City', 'Revenue', 'Orders', 'Avg Ticket', 'Top Product'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: theme.textFaint }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((b: any, i: number) => (
                    <tr key={b.branchId} style={{ borderBottom: `1px solid ${theme.border}`, background: i % 2 === 0 ? 'transparent' : `${theme.border}11` }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: theme.text }}>{b.branchName}</td>
                      <td style={{ padding: '12px 14px', color: theme.textFaint }}>{b.city}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7c3aed' }}>₹{b.revenue.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 14px', color: theme.text }}>{b.orders}</td>
                      <td style={{ padding: '12px 14px', color: theme.text }}>₹{b.avgTicket.toFixed(0)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{b.topProduct}</span>
                      </td>
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
