'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

export default function HQSetup() {
  const { theme } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name || !slug) return setError('Both fields are required.');
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/org/create', { name, slug });
      if (res.data.success) {
        router.push(`/dashboard/hq?orgId=${res.data.org.id}`);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create organization.');
    } finally {
      setLoading(false);
    }
  };

  const card = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 32 };

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 24px' }}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: theme.text, margin: 0 }}>Create Your Organization</h1>
          <p style={{ color: theme.textFaint, marginTop: 8, lineHeight: 1.6 }}>
            Upgrade to <strong>Franchise Mode</strong>. Group your shops under one organization and get a centralized HQ dashboard.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', marginBottom: 20, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
              Organization Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => {
                setName(e.target.value);
                setSlug(e.target.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
              }}
              placeholder="e.g., The Coffee Chain"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, fontSize: 15 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
              URL Slug <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="the-coffee-chain"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, fontSize: 15, fontFamily: 'monospace' }}
            />
            <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 6 }}>Must be unique. Only lowercase letters, numbers, and hyphens.</div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            style={{ padding: '13px', background: loading ? theme.border : '#7c3aed', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
          >
            {loading ? 'Creating...' : '🚀 Launch Franchise Mode'}
          </button>
        </div>

        <div style={{ marginTop: 28, padding: 16, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>What you unlock:</div>
          {['HQ Dashboard — cross-branch revenue & order rollups', 'Branch Comparison — side-by-side performance', 'Central Menu Sync — push products to all branches', 'Member Management — invite HQ staff & managers'].map(f => (
            <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: 13, color: theme.text }}>
              <span>✅</span> {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
