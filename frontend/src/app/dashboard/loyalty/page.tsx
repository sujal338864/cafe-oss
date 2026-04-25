'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

type Tier = {
  id: string; name: string; minPoints: number;
  discountRate: number; badge: string; color: string;
};

const BADGE_OPTIONS = ['🥉', '🥈', '🥇', '💎', '👑', '🌟', '🔥', '⚡'];
const COLOR_OPTIONS = [
  { label: 'Bronze', value: '#cd7f32' }, { label: 'Silver', value: '#9ca3af' },
  { label: 'Gold',   value: '#f59e0b' }, { label: 'Diamond',value: '#3b82f6' },
  { label: 'Purple', value: '#7c3aed' }, { label: 'Green',  value: '#10b981' },
];

export default function LoyaltyTiersPage() {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', minPoints: '', discountRate: '', badge: '🥉', color: '#cd7f32' });
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: () => api.get('/api/growth/loyalty-tiers').then(r => r.data),
  });

  const tiers: Tier[] = data?.tiers || [];

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 9, fontSize: 14,
    background: theme.hover, border: `1px solid ${theme.border}`,
    color: theme.text, outline: 'none', boxSizing: 'border-box'
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.minPoints || !form.discountRate) {
      toast.error('All fields are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/api/growth/loyalty-tiers', {
        name: form.name.trim(),
        minPoints: Number(form.minPoints),
        discountRate: Number(form.discountRate),
        badge: form.badge,
        color: form.color,
      });
      toast.success(`Tier "${form.name}" created!`);
      setForm({ name: '', minPoints: '', discountRate: '', badge: '🥉', color: '#cd7f32' });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['loyalty-tiers'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save tier');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tier "${name}"?`)) return;
    setDeleting(id);
    try {
      await api.delete(`/api/growth/loyalty-tiers/${id}`);
      toast.success('Tier deleted');
      qc.invalidateQueries({ queryKey: ['loyalty-tiers'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed');
    } finally { setDeleting(null); }
  };

  const card: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: theme.text, margin: 0 }}>
            👑 Loyalty Tiers
          </h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 4 }}>
            Customers automatically upgrade when they earn enough points.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#3b82f6)',
            border: 'none', color: 'white', padding: '10px 20px',
            borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer'
          }}
        >
          {showForm ? '✕ Cancel' : '+ New Tier'}
        </button>
      </div>

      {/* New Tier Form */}
      {showForm && (
        <div style={{ ...card, padding: 24, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, marginBottom: 20 }}>
            ✨ Create New Tier
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>TIER NAME</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gold Member" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>MIN POINTS TO UNLOCK</label>
              <input style={inp} type="number" min="0" value={form.minPoints} onChange={e => setForm(f => ({ ...f, minPoints: e.target.value }))} placeholder="e.g. 500" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 6 }}>DISCOUNT RATE (%)</label>
              <input style={inp} type="number" min="0" max="50" step="0.5" value={form.discountRate} onChange={e => setForm(f => ({ ...f, discountRate: e.target.value }))} placeholder="e.g. 5" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 8 }}>BADGE EMOJI</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BADGE_OPTIONS.map(b => (
                  <button key={b} onClick={() => setForm(f => ({ ...f, badge: b }))} style={{
                    fontSize: 22, width: 42, height: 42, borderRadius: 8, border: `2px solid ${form.badge === b ? '#7c3aed' : theme.border}`,
                    background: form.badge === b ? 'rgba(124,58,237,0.1)' : 'transparent', cursor: 'pointer'
                  }}>{b}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.textFaint, marginBottom: 8 }}>BADGE COLOR</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLOR_OPTIONS.map(c => (
                  <button key={c.value} onClick={() => setForm(f => ({ ...f, color: c.value }))} title={c.label} style={{
                    width: 32, height: 32, borderRadius: '50%', background: c.value, border: `3px solid ${form.color === c.value ? 'white' : 'transparent'}`,
                    cursor: 'pointer', outline: form.color === c.value ? `2px solid ${c.value}` : 'none'
                  }} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{
            background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none',
            color: 'white', padding: '11px 28px', borderRadius: 9, fontWeight: 700,
            fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1
          }}>
            {saving ? 'Saving…' : '💾 Save Tier'}
          </button>
        </div>
      )}

      {/* Tiers List */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading tiers…</div>
      ) : tiers.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏅</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: theme.text, marginBottom: 8 }}>No tiers yet</div>
          <div style={{ fontSize: 13, color: theme.textFaint }}>Create your first loyalty tier to reward your best customers.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[...tiers].sort((a, b) => a.minPoints - b.minPoints).map(tier => (
            <div key={tier.id} style={{ ...card, padding: 20, borderLeft: `4px solid ${tier.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{tier.badge}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: tier.color }}>{tier.name}</div>
                    <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>Loyalty Tier</div>
                  </div>
                </div>
                <button onClick={() => handleDelete(tier.id, tier.name)} disabled={deleting === tier.id} style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600
                }}>
                  {deleting === tier.id ? '…' : 'Delete'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: theme.hover, borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: theme.textFaint, marginBottom: 4 }}>MIN POINTS</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: theme.text }}>{tier.minPoints.toLocaleString()}</div>
                </div>
                <div style={{ background: theme.hover, borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: theme.textFaint, marginBottom: 4 }}>DISCOUNT</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{tier.discountRate}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How It Works */}
      <div style={{ ...card, padding: 20, background: 'rgba(124,58,237,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed', marginBottom: 10 }}>💡 How Loyalty Tiers Work</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { icon: '🛒', text: 'Customer earns points on every purchase based on your Loyalty Rate in Shop Settings.' },
            { icon: '⬆️', text: 'When total points cross a tier threshold, they automatically get upgraded.' },
            { icon: '🎁', text: 'Tier discount is applied automatically at checkout for eligible customers.' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{step.icon}</span>
              <span style={{ fontSize: 12, color: theme.textFaint, lineHeight: 1.5 }}>{step.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
