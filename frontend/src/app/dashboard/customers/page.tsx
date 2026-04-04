"use client";

import { useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');

export default function CustomersPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // Queries
  const { data: customersData, isLoading: loading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/api/customers').then(r => r.data)
  });

  const customers = customersData?.customers || customersData || [];

  const [search,       setSearch]       = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState<any>(null);
  const [form,       setForm]       = useState({ name: '', phone: '', email: '', address: '' });
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  // Purchase history
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [history,         setHistory]         = useState<any[]>([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', address: c.address || '' });
    setError('');
    setShowModal(true);
  };

  const viewHistory = async (customer: any) => {
    setHistoryCustomer(customer);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/api/analytics/recent?customerId=${customer.id}&limit=50`);
      setHistory(data.orders || data.data || (Array.isArray(data) ? data : []));
    } catch (e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload: any = { name: form.name };
      if (form.phone)   payload.phone   = form.phone;
      if (form.email)   payload.email   = form.email;
      if (form.address) payload.address = form.address;

      if (editing) {
        await api.put(`/api/customers/${editing.id}`, payload);
      } else {
        await api.post('/api/customers', payload);
      }
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    try { 
      await api.delete(`/api/customers/${id}`); 
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
    catch (e: any) { alert(e.response?.data?.error || 'Failed to delete'); }
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const inp: React.CSSProperties = {
    background: theme.input, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 9, padding: '10px 13px',
    fontSize: 13, width: '100%', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, color: theme.textFaint,
    fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Customers</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>{customers.length} registered</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email..."
            style={{ ...inp, width: 260 }} />
          <button onClick={openAdd}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add Customer
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>
            {search ? 'No customers match your search.' : 'No customers yet.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Customer', 'Phone', 'Email', 'Total Purchases', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,rgba(124,58,237,.25),rgba(59,130,246,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#a78bfa', fontSize: 14, flexShrink: 0 }}>
                        {c.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{c.name}</div>
                        {c.address && <div style={{ fontSize: 11, color: theme.textFaint }}>{c.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: theme.textMuted }}>{c.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: theme.textMuted }}>{c.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{fmt(c.totalPurchases || 0)}</div>
                    {c.orderCount != null && <div style={{ fontSize: 11, color: theme.textFaint }}>{c.orderCount} orders</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button onClick={() => viewHistory(c)}
                        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', padding: '5px 11px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                        History
                      </button>
                      <button onClick={() => openEdit(c)}
                        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa', padding: '5px 11px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => del(c.id)}
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '5px 11px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Purchase History Modal */}
      {historyCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setHistoryCustomer(null)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>Purchase History</div>
                <div style={{ fontSize: 13, color: theme.textFaint, marginTop: 2 }}>
                  {historyCustomer.name}
                  {historyCustomer.phone && ` · ${historyCustomer.phone}`}
                </div>
              </div>
              <button onClick={() => setHistoryCustomer(null)}
                style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
              {[
                ['Total Spent',  fmt(historyCustomer.totalPurchases || 0), '#a78bfa'],
                ['Total Orders', history.length || (historyCustomer.orderCount ?? '—'), '#10b981'],
                ['Member Since', new Date(historyCustomer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), '#3b82f6'],
              ].map(([l, v, col], i) => (
                <div key={l as string} style={{ padding: '14px 20px', borderRight: i < 2 ? `1px solid ${theme.border}` : 'none', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: col as string }}>{v}</div>
                  <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 3, textTransform: 'uppercase', fontWeight: 700 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Orders list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ padding: 36, textAlign: 'center', color: theme.textFaint }}>Loading orders...</div>
              ) : history.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: theme.textFaint }}>No orders found for this customer.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${theme.border}`, position: 'sticky', top: 0, background: theme.card }}>
                      {['Invoice', 'Items', 'Total', 'Method', 'Status', 'Date'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((order: any) => {
                      const paid = order.paymentStatus === 'PAID';
                      const itemCount = order.items?.length ?? order._count?.items ?? '—';
                      return (
                        <tr key={order.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>#{order.invoiceNumber}</td>
                          <td style={{ padding: '11px 16px', fontSize: 12, color: theme.textMuted }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</td>
                          <td style={{ padding: '11px 16px', fontWeight: 700, fontSize: 13, color: theme.text }}>{fmt(order.totalAmount)}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <span style={{ background: 'rgba(59,130,246,.12)', color: '#3b82f6', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{order.paymentMethod}</span>
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            <span style={{ background: paid ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)', color: paid ? '#10b981' : '#f59e0b', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{order.paymentStatus}</span>
                          </td>
                          <td style={{ padding: '11px 16px', fontSize: 12, color: theme.textFaint }}>
                            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, width: '90%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>{editing ? 'Edit Customer' : 'Add Customer'}</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[
                { l: 'Name *',   k: 'name',    ph: 'Full name' },
                { l: 'Phone',    k: 'phone',   ph: '03xx-xxxxxxx' },
                { l: 'Email',    k: 'email',   ph: 'customer@email.com', type: 'email' },
                { l: 'Address',  k: 'address', ph: 'Street, City' },
              ].map(({ l, k, ph, type }) => (
                <div key={k}>
                  <label style={lbl}>{l}</label>
                  <input type={type || 'text'} value={(form as any)[k]} placeholder={ph}
                    onChange={e => setForm(v => ({ ...v, [k]: e.target.value }))} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 12, borderRadius: 10, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Customer'}
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
