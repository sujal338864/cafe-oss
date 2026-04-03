'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ReportsPage() {
  const { theme } = useTheme();
  const { getActivePlan } = useAuth() as any;
  const router = useRouter();
  const isPro = getActivePlan() !== 'STARTER';

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);
  const [report,   setReport]  = useState<any>(null);
  const [period,   setPeriod]  = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    fetchPreview();
  }, [period]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/reports/preview?period=${period}`);
      setReport(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'csv') => {
    if (!isPro && period !== 'daily') return;
    setDownloading(format);
    try {
      const response = await api.get(`/api/reports/download?period=${period}&format=${format}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ShopOS_${period}_Report_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Download failed:', e);
      alert('Failed to generate file. Please check your subscription status.');
    } finally {
      setDownloading(null);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24,
    boxShadow: '0 10px 40px rgba(0,0,0,0.04)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: theme.text, margin: 0 }}>Reports & Analysis</h2>
          <p style={{ fontSize: 14, color: theme.textFaint, marginTop: 4 }}>Professional data exports for your business records.</p>
        </div>
        <button onClick={() => router.push('/dashboard/analytics')} style={{ fontSize: 13, background: 'none', border: 'none', color: '#7c3aed', fontWeight: 700, cursor: 'pointer' }}>
          ← Back to Dashboard
        </button>
      </div>

      {!isPro && (
        <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)', padding: 16, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>💰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Starter Tier Limitation</div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>Weekly and Monthly detailed data exports are exclusive to PRO users.</div>
          </div>
          <button onClick={() => router.push('/dashboard/settings')} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Upgrade</button>
        </div>
      )}

      {/* Period Selection */}
      <div style={{ display: 'flex', background: theme.card, padding: 4, borderRadius: 12, border: `1px solid ${theme.border}`, width: 'fit-content' }}>
        {(['daily', 'weekly', 'monthly'] as const).map(p => (
           <button key={p} onClick={() => setPeriod(p)} style={{
             padding: '8px 24px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
             background: period === p ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'none',
             color: period === p ? 'white' : theme.textMuted,
             opacity: (!isPro && p !== 'daily') ? 0.5 : 1
           }}>
             {p.charAt(0).toUpperCase() + p.slice(1)}
           </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        {/* Preview Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.text, margin: 0 }}>Business Snapshot</h3>
            <div style={{ fontSize: 12, color: theme.textFaint }}>{report?.date || '...'}</div>
          </div>

          {loading ? (
             <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Aggregating data...</div>
          ) : report ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ background: theme.hover, padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700 }}>REVENUE</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: theme.text }}>₹{report.metrics.revenue.toLocaleString()}</div>
                    </div>
                    <div style={{ background: theme.hover, padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700 }}>NET PROFIT</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>₹{report.metrics.profit.toLocaleString()}</div>
                    </div>
                </div>

                <div>
                    <h4 style={{ fontSize: 12, color: theme.textFaint, marginBottom: 10 }}>TOP PERFORMING PRODUCTS</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {report.topItems.map((it: any, i: number) => (
                           <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.text }}>
                               <span>{it.name}</span>
                               <span style={{ fontWeight: 700 }}>{it.quantity} sold</span>
                           </div>
                        ))}
                    </div>
                </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Select a period to see a preview.</div>
          )}
        </div>

        {/* Action Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div style={cardStyle}>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: theme.text, marginBottom: 8 }}>Export Summary</h4>
                <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 20 }}>Professional PDF formatted with ShopOS branding.</p>
                <button 
                  onClick={() => handleDownload('pdf')}
                  disabled={!!downloading || (!isPro && period !== 'daily')}
                  style={{ 
                    width: '100%', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', border: 'none', 
                    padding: '12px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', 
                    opacity: (downloading === 'pdf' || (!isPro && period !== 'daily')) ? 0.6 : 1,
                    boxShadow: '0 8px 20px rgba(124, 58, 237, 0.2)'
                  }}>
                  {downloading === 'pdf' ? 'Generating PDF...' : 'Download PDF Report'}
                </button>
             </div>

             <div style={cardStyle}>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: theme.text, marginBottom: 8 }}>Export Raw Data</h4>
                <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 20 }}>Transactional CSV list for manual accounting and Excel.</p>
                <button 
                  onClick={() => handleDownload('csv')}
                  disabled={!!downloading || (!isPro && period !== 'daily')}
                  style={{ 
                    width: '100%', background: theme.hover, color: theme.text, border: `1px solid ${theme.border}`,
                    padding: '12px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', 
                    opacity: (downloading === 'csv' || (!isPro && period !== 'daily')) ? 0.6 : 1
                  }}>
                  {downloading === 'csv' ? 'Generating CSV...' : 'Download CSV File'}
                </button>
             </div>
        </div>
      </div>
    </div>
  );
}
