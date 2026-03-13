'use client';
import { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PAID:    { bg: 'rgba(16,185,129,.14)',  color: '#10b981' },
  PARTIAL: { bg: 'rgba(245,158,11,.14)', color: '#f59e0b' },
  UNPAID:  { bg: 'rgba(239,68,68,.14)',  color: '#ef4444' },
};
const METHOD_COLORS: Record<string, string> = {
  CASH: '#10b981', UPI: '#3b82f6', CARD: '#a78bfa', BANK_TRANSFER: '#f59e0b', CREDIT: '#ef4444',
};

function exportCSV(orders: any[]) {
  const rows = [
    ['Invoice', 'Customer', 'Phone', 'Items', 'Subtotal', 'Tax', 'Discount', 'Total', 'Method', 'Status', 'Date'],
    ...orders.map(o => [
      o.invoiceNumber,
      o.customer?.name || 'Walk-in',
      o.customer?.phone || '',
      o.items?.length ?? '',
      o.subtotal ?? '',
      o.taxAmount ?? '',
      o.discountAmount ?? '',
      o.totalAmount,
      o.paymentMethod,
      o.paymentStatus,
      new Date(o.createdAt).toLocaleDateString('en-IN'),
    ])
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function OrdersPage() {
  const { theme } = useTheme();
  const [orders,  setOrders]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('ALL');
  const [method,  setMethod]  = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/orders?limit=200');
      setOrders(data.orders || data.data || (Array.isArray(data) ? data : []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (status !== 'ALL' && o.paymentStatus !== status) return false;
      if (method !== 'ALL' && o.paymentMethod !== method) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.invoiceNumber?.toLowerCase().includes(q) &&
            !o.customer?.name?.toLowerCase().includes(q) &&
            !o.customer?.phone?.includes(q)) return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom); from.setHours(0,0,0,0);
        if (new Date(o.createdAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo); to.setHours(23,59,59,999);
        if (new Date(o.createdAt) > to) return false;
      }
      return true;
    });
  }, [orders, status, method, search, dateFrom, dateTo]);

  const totalRevenue  = filtered.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const totalPaid     = filtered.filter(o => o.paymentStatus === 'PAID').reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const totalPending  = filtered.filter(o => o.paymentStatus !== 'PAID').reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  const card: React.CSSProperties = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 };
  const inp: React.CSSProperties  = { background: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, padding: '8px 12px', fontSize: 12, outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Orders</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>
            {filtered.length} orders{filtered.length !== orders.length ? ` (of ${orders.length})` : ''}
          </p>
        </div>
        <button onClick={() => exportCSV(filtered)}
          style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          ⬇️ Export CSV
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total Orders',  val: filtered.length,    color: '#3b82f6' },
          { label: 'Revenue',       val: fmt(totalRevenue),  color: '#10b981' },
          { label: 'Collected',     val: fmt(totalPaid),     color: '#a78bfa' },
          { label: 'Pending',       val: fmt(totalPending),  color: '#f59e0b' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Invoice, customer, phone..."
          style={{ ...inp, width: 220 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
          <option value="ALL">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>
        <select value={method} onChange={e => setMethod(e.target.value)} style={inp}>
          <option value="ALL">All Methods</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CREDIT">Credit</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} title="From date" />
        <span style={{ color: theme.textFaint, fontSize: 12 }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} title="To date" />
        {(search || status !== 'ALL' || method !== 'ALL' || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setStatus('ALL'); setMethod('ALL'); setDateFrom(''); setDateTo(''); }}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '8px 14px', borderRadius: 9, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Orders table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>No orders match your filters.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Invoice', 'Customer', 'Items', 'Amount', 'Method', 'Status', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => {
                const sc = STATUS_COLORS[o.paymentStatus] || STATUS_COLORS.UNPAID;
                const mc = METHOD_COLORS[o.paymentMethod] || '#94a3b8';
                const isOpen = expanded === o.id;
                return (
                  <>
                    <tr key={o.id} style={{ borderBottom: `1px solid ${theme.border}`, background: isOpen ? theme.hover : 'transparent' }}>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
                        #{o.invoiceNumber}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{o.customer?.name || 'Walk-in'}</div>
                        {o.customer?.phone && <div style={{ fontSize: 11, color: theme.textFaint }}>{o.customer.phone}</div>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: theme.textMuted }}>{o.items?.length ?? '—'}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: theme.text }}>{fmt(o.totalAmount)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: mc + '18', color: mc }}>{o.paymentMethod}</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, ...sc }}>{o.paymentStatus}</span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: theme.textFaint }}>
                        {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        <div style={{ fontSize: 10, color: theme.textFaint }}>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {o.items?.length > 0 && (
                          <button onClick={() => setExpanded(isOpen ? null : o.id)}
                            style={{ background: 'none', border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '4px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>
                            {isOpen ? '▲' : '▼'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Expanded items row */}
                    {isOpen && o.items?.length > 0 && (
                      <tr key={`${o.id}-items`} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td colSpan={8} style={{ padding: '0 14px 12px 40px' }}>
                          <div style={{ background: theme.hover, borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Order Items</div>
                            {o.items.map((item: any, i: number) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < o.items.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                                <span style={{ fontSize: 12, color: theme.text }}>{item.name}</span>
                                <span style={{ fontSize: 12, color: theme.textFaint }}>
                                  {item.quantity} × {fmt(item.unitPrice)} = <strong style={{ color: theme.text }}>{fmt(item.total || item.unitPrice * item.quantity)}</strong>
                                  {item.taxRate > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>+{item.taxRate}% GST</span>}
                                </span>
                              </div>
                            ))}
                            {/* Order totals */}
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.border}`, display: 'flex', gap: 20, fontSize: 12, color: theme.textFaint }}>
                              {o.subtotal != null    && <span>Subtotal: <b style={{ color: theme.text }}>{fmt(o.subtotal)}</b></span>}
                              {o.taxAmount > 0       && <span>Tax: <b style={{ color: '#f59e0b' }}>{fmt(o.taxAmount)}</b></span>}
                              {o.discountAmount > 0  && <span>Discount: <b style={{ color: '#10b981' }}>- {fmt(o.discountAmount)}</b></span>}
                              {o.notes               && <span>Note: <i>{o.notes}</i></span>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
