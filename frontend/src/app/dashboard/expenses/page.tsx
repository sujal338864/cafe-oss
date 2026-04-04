"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');

// ── EXACT enum values the backend accepts ──────────────────────
// z.enum(['RENT','ELECTRICITY','SALARY','MAINTENANCE','MARKETING','TRANSPORT','OTHER'])
const CATEGORY_OPTIONS = [
  { label: 'Rent',        value: 'RENT' },
  { label: 'Electricity', value: 'ELECTRICITY' },
  { label: 'Salary',      value: 'SALARY' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Marketing',   value: 'MARKETING' },
  { label: 'Transport',   value: 'TRANSPORT' },
  { label: 'Other',       value: 'OTHER' },
];

export default function ExpensesPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { data: expData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/api/expenses').then(res => res.data.expenses || res.data || []),
    staleTime: 60000, 
  });
  const expenses = expData || [];

  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({
    category:    'OTHER',
    amount:      '',
    description: '',
    date:        '',   
  });
  const [localError, setLocalError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/expenses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowModal(false);
      setForm({ category: 'OTHER', amount: '', description: '', date: '' });
      setLocalError('');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/expenses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] })
  });

  const saving = saveMutation.isPending;
  const displayError = (queryError ? 'Failed to load' : '') || (saveMutation.error as any)?.response?.data?.error || localError;

  const save = async () => {
    if (!form.amount) { setLocalError('Amount is required'); return; }
    if (Number(form.amount) <= 0) { setLocalError('Amount must be greater than 0'); return; }
    const payload: any = { category: form.category, amount: Number(form.amount) };
    if (form.description) payload.description = form.description;
    if (form.date) payload.date = new Date(form.date).toISOString();
    saveMutation.mutate(payload);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    deleteMutation.mutate(id);
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const inp: React.CSSProperties = {
    background: theme.input, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 9, padding: '10px 13px',
    fontSize: 13, width: '100%', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, color: theme.textFaint,
    fontWeight: 700, textTransform: 'uppercase', marginBottom: 5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Expenses</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>
            {expenses.length} records · Total: {fmt(total)}
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setLocalError(''); }}
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Expense
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{fmt(total)}</div>
        </div>
        {CATEGORY_OPTIONS.map(c => {
          const catTotal = expenses.filter(e => e.category === c.value).reduce((s, e) => s + Number(e.amount || 0), 0);
          if (!catTotal) return null;
          return (
            <div key={c.value} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: theme.text }}>{fmt(catTotal)}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading...</div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>No expenses yet. Add your first one!</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Category', 'Amount', 'Date', 'Description', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}>
                      {CATEGORY_OPTIONS.find(c => c.value === e.category)?.label || e.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#ef4444' }}>{fmt(e.amount)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: theme.textFaint }}>
                    {new Date(e.date || e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: theme.textMuted }}>{e.description || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => del(e.id)}
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '5px 11px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, width: '90%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>Add Expense</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {displayError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{displayError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Category */}
              <div>
                <label style={lbl}>Category *</label>
                <select value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))} style={inp}>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label style={lbl}>Amount (Rs.) *</label>
                <input type="number" min="1" value={form.amount}
                  onChange={e => setForm(v => ({ ...v, amount: e.target.value }))}
                  placeholder="e.g. 5000" style={inp} />
              </div>

              {/* Date */}
              <div>
                <label style={lbl}>Date <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional — defaults to today)</span></label>
                <input type="date" value={form.date}
                  onChange={e => setForm(v => ({ ...v, date: e.target.value }))}
                  style={inp} />
              </div>

              {/* Description */}
              <div>
                <label style={lbl}>Description <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional)</span></label>
                <input value={form.description}
                  onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
                  placeholder="e.g. Monthly rent payment" style={inp} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 12, borderRadius: 10, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Add Expense'}
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
