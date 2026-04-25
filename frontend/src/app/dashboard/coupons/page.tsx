'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

type Coupon = {
  id: string; code: string; type: string; value: number;
  minOrder: number; maxUses: number | null; usedCount: number;
  isActive: boolean; expiresAt: string | null; description: string | null;
};

type Analytics = { couponId: string; code: string; totalRevenue: number; totalDiscount: number; usedCount: number };

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PERCENTAGE: { label: '%  Off',       color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  FLAT:       { label: '₹  Flat Off',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  FIRST_ORDER:{ label: 'First Order',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
};

const fmt = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

export default function CouponsPage() {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [form, setForm] = useState({
    code: '', type: 'PERCENTAGE', value: '', minOrder: '0',
    maxUses: '', description: '', expiresAt: '', isActive: true
  });

  const { data, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.get('/api/growth/coupons').then(r => r.data),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['coupon-analytics'],
    queryFn: () => api.get('/api/growth/coupons/analytics').then(r => r.data),
    enabled: activeTab === 'analytics',
  });

  const coupons: Coupon[] = data?.coupons || [];
  const analytics: Analytics[] = analyticsData?.analytics || [];

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 9, fontSize: 14,
    background: theme.hover, border: `1px solid ${theme.border}`,
    color: theme.text, outline: 'none', boxSizing: 'border-box'
  };
  const card: React.CSSProperties = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 };

  const handleSave = async () => {
    if (!form.code.trim() || !form.value) { toast.error('Code and value are required'); return; }
    setSaving(true);
    try {
      await api.post('/api/growth/coupons', {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        minOrder: Number(form.minOrder || 0),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        description: form.description || null,
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
      });
      toast.success(`Coupon "${form.code.toUpperCase()}" created!`);
      setForm({ code: '', type: 'PERCENTAGE', value: '', minOrder: '0', maxUses: '', description: '', expiresAt: '', isActive: true });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['coupons'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create coupon');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"?`)) return;
    setDeleting(id);
    try {
      await api.delete(`/api/growth/coupons/${id}`);
      toast.success(`Coupon "${code}" deleted`);
      qc.invalidateQueries({ queryKey: ['coupons'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed');
    } finally { setDeleting(null); }
  };

  const isExpired = (c: Coupon) => c.expiresAt && new Date(c.expiresAt) < new Date();
  const isExhausted = (c: Coupon) => c.maxUses !== null && c.usedCount >= c.maxUses;
  const getStatus = (c: Coupon) => {
    if (!c.isActive) return { label: 'Disabled', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
    if (isExpired(c)) return { label: 'Expired', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    if (isExhausted(c)) return { label: 'Exhausted', color: '#f97316', bg: 'rgba(249,115,22,0.1)' };
    return { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: theme.text, margin: 0 }}>🎟️ Coupon Engine</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 4 }}>
            {coupons.length} coupon{coupons.length !== 1 ? 's' : ''} · {coupons.filter(c => c.isActive && !isExpired(c) && !isExhausted(c)).length} active
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', background: theme.hover, borderRadius: 9, padding: 3 }}>
            {(['list', 'analytics'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: '7px 14px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: activeTab === t ? theme.card : 'transparent',
                color: activeTab === t ? theme.text : theme.textMuted,
                boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
              }}>
                {t === 'list' ? '🎟️ Coupons' : '📊 Analytics'}
              </button>
            ))}
          </div>
          {activeTab === 'list' && (
            <button onClick={() => setShowForm(v => !v)} style={{
              background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none',
              color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer'
            }}>
              {showForm ? '✕ Cancel' : '+ New Coupon'}
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showForm && activeTab === 'list' && (
        <div style={{ ...card, padding: 24, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, marginBottom: 20 }}>✨ Create Coupon</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>COUPON CODE</label>
              <input style={inp} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. SAVE20" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>TYPE</label>
              <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="PERCENTAGE">Percentage Off</option>
                <option value="FLAT">Flat Amount Off</option>
                <option value="FIRST_ORDER">First Order Only</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>
                VALUE {form.type === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input style={inp} type="number" min="0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'PERCENTAGE' ? '20' : '50'} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>MIN ORDER (₹)</label>
              <input style={inp} type="number" min="0" value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))} placeholder="0 = no minimum" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>MAX USES (blank = unlimited)</label>
              <input style={inp} type="number" min="1" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="e.g. 100" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>EXPIRES ON</label>
              <input style={inp} type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>DESCRIPTION (optional)</label>
            <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Weekend special discount" />
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none',
            color: 'white', padding: '11px 28px', borderRadius: 9, fontWeight: 700,
            fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1
          }}>
            {saving ? 'Creating…' : '🎟️ Create Coupon'}
          </button>
        </div>
      )}

      {/* Coupons List */}
      {activeTab === 'list' && (
        isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading coupons…</div>
        ) : coupons.length === 0 ? (
          <div style={{ ...card, padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎟️</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme.text, marginBottom: 8 }}>No coupons yet</div>
            <div style={{ fontSize: 13, color: theme.textFaint }}>Create your first coupon to boost sales and reward customers.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coupons.map(c => {
              const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.PERCENTAGE;
              const status = getStatus(c);
              const pct = c.maxUses ? Math.round((c.usedCount / c.maxUses) * 100) : 0;
              return (
                <div key={c.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, opacity: !c.isActive || isExpired(c) ? 0.65 : 1 }}>
                  {/* Code */}
                  <div style={{ minWidth: 120 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: theme.text, letterSpacing: '0.05em' }}>
                      {c.code}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>{c.description || '—'}</div>
                  </div>

                  {/* Type badge */}
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap' }}>
                    {c.type === 'PERCENTAGE' ? `${c.value}% Off` : c.type === 'FLAT' ? `₹${c.value} Off` : 'First Order'}
                  </span>

                  {/* Stats */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textFaint }}>MIN ORDER</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{c.minOrder > 0 ? fmt(c.minOrder) : 'Any'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textFaint }}>USED</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                        {c.usedCount}{c.maxUses ? `/${c.maxUses}` : ''}
                      </div>
                      {c.maxUses && (
                        <div style={{ height: 3, background: theme.hover, borderRadius: 2, marginTop: 3 }}>
                          <div style={{ height: 3, width: `${pct}%`, background: pct >= 90 ? '#ef4444' : '#10b981', borderRadius: 2, transition: 'width .5s' }} />
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textFaint }}>EXPIRES</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isExpired(c) ? '#ef4444' : theme.text }}>
                        {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN') : '∞ Never'}
                      </div>
                    </div>
                  </div>

                  {/* Status + Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: status.color, background: status.bg }}>
                      {status.label}
                    </span>
                    <button onClick={() => handleDelete(c.id, c.code)} disabled={deleting === c.id} style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600
                    }}>
                      {deleting === c.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        analytics.length === 0 ? (
          <div style={{ ...card, padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>No coupon usage data yet</div>
          </div>
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: theme.hover }}>
                  {['Code', 'Uses', 'Total Revenue', 'Total Discount', 'ROI'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: theme.textFaint, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.map((a, i) => (
                  <tr key={a.couponId} style={{ borderTop: `1px solid ${theme.border}`, background: i % 2 === 0 ? 'transparent' : theme.hover + '44' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 900, color: '#7c3aed' }}>{a.code}</td>
                    <td style={{ padding: '12px 16px', color: theme.text, fontWeight: 700 }}>{a.usedCount}</td>
                    <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 700 }}>{fmt(a.totalRevenue)}</td>
                    <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 700 }}>{fmt(a.totalDiscount)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: a.totalRevenue > a.totalDiscount * 3 ? '#10b981' : '#f59e0b' }}>
                      {a.totalDiscount > 0 ? `${Math.round((a.totalRevenue / a.totalDiscount))}x` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
