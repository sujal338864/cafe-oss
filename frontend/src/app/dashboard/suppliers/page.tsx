import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');

export default function SuppliersPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { data: supData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/api/suppliers').then(res => res.data.suppliers || res.data || []),
    staleTime: 300000, // 5 min
  });
  const suppliers = supData || [];

  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '' });
  const [localError, setLocalError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editing ? api.put(`/api/suppliers/${editing.id}`, payload) : api.post('/api/suppliers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setShowModal(false);
      setLocalError('');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/suppliers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  });

  const saving = saveMutation.isPending;
  const displayError = (queryError ? 'Failed to load' : '') || (saveMutation.error as any)?.response?.data?.error || localError;

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '', gstNumber: '' });
    setLocalError(''); setShowModal(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', gstNumber: s.gstNumber || '' });
    setLocalError(''); setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setLocalError('Supplier name is required'); return; }
    const payload: any = { name: form.name.trim() };
    if (form.phone) payload.phone = form.phone;
    if (form.email) payload.email = form.email;
    if (form.address) payload.address = form.address;
    if (form.gstNumber) payload.gstNumber = form.gstNumber;
    saveMutation.mutate(payload);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    deleteMutation.mutate(id);
  };

  // ── All inputs use theme colours — no white/light overrides ─────────────
  const inp: React.CSSProperties = {
    background: theme.input,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: 9,
    padding: '10px 13px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, color: theme.textFaint,
    fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 5,
  };

  const FIELDS = [
    { l: 'Supplier Name *', k: 'name',      ph: 'e.g. ABC Distributors' },
    { l: 'Phone',           k: 'phone',     ph: '03xx-xxxxxxx' },
    { l: 'Email',           k: 'email',     ph: 'supplier@email.com', type: 'email' },
    { l: 'Address',         k: 'address',   ph: 'Street, City' },
    { l: 'GSTIN',           k: 'gstNumber', ph: 'GST / NTN number' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Suppliers</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Supplier
        </button>
      </div>

      {/* Table */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading...</div>
        ) : suppliers.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🚚</div>
            <div style={{ color: theme.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No suppliers yet</div>
            <div style={{ color: theme.textFaint, fontSize: 13, marginBottom: 20 }}>Add suppliers to create purchase orders and track balances</div>
            <button onClick={openAdd}
              style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
              + Add First Supplier
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Supplier', 'Phone', 'Email', 'GSTIN', 'Outstanding Balance', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s: any) => {
                const outstanding = Number(s.outstandingBalance || 0);
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: 'white', flexShrink: 0 }}>
                          {s.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{s.name}</div>
                          {s.address && <div style={{ fontSize: 11, color: theme.textFaint }}>{s.address}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: theme.textMuted }}>{s.phone || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: theme.textMuted }}>{s.email || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', color: theme.textFaint }}>{s.gstNumber || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 700, color: outstanding > 0 ? '#f59e0b' : '#10b981' }}>
                        {outstanding > 0 ? fmt(outstanding) : '✓ Cleared'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(s)}
                          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => del(s.id)}
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal — fully theme-aware, no white override */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, width: '90%', maxWidth: 440 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>{editing ? 'Edit Supplier' : 'Add Supplier'}</div>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {displayError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>
                {displayError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {FIELDS.map(({ l, k, ph, type }) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input
                    type={type || 'text'}
                    value={(form as any)[k]}
                    placeholder={ph}
                    onChange={e => setForm((v: any) => ({ ...v, [k]: e.target.value }))}
                    style={inp}
                    onKeyDown={e => e.key === 'Enter' && save()}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 12, borderRadius: 10, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Supplier'}
              </button>
              <button onClick={() => setShowModal(false)}
                style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '12px 20px', borderRadius: 10, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
