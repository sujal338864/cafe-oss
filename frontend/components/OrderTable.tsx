"use client";

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

interface Order {
  id: string;
  invoiceNumber: string;
  customer?: { name: string };
  totalAmount: number;
  paymentStatus: string;
  createdAt: string;
}

interface OrderTableProps {
  orders: Order[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}

const STATUS: Record<string, { bg: string; color: string }> = {
  PAID:    { bg: 'rgba(16,185,129,.14)',  color: '#10b981' },
  PARTIAL: { bg: 'rgba(245,158,11,.14)', color: '#f59e0b' },
  UNPAID:  { bg: 'rgba(239,68,68,.14)',  color: '#ef4444' },
};

export function OrderTable({ orders, total, page, onPageChange }: OrderTableProps) {
  const totalPages = Math.ceil(total / 20);
  const border = '1px solid rgba(255,255,255,0.07)';

  return (
    <div style={{ background: '#15151d', borderRadius: 14, border, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: border }}>
            {['Invoice #', 'Customer', 'Amount', 'Status', 'Date'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const sc = STATUS[o.paymentStatus] || { bg: 'rgba(148,163,184,.14)', color: '#94a3b8' };
            return (
              <tr key={o.id} style={{ borderBottom: border }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>{o.invoiceNumber}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#e2e8f0' }}>{o.customer?.name || 'Walk-in'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>{fmt(o.totalAmount)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ ...sc, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{o.paymentStatus}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>
                  {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            );
          })}
          {orders.length === 0 && (
            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#334155' }}>No orders found.</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: border }}>
        <span style={{ fontSize: 12, color: '#475569' }}>
          {total === 0 ? '0 results' : `Showing ${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={page === 1} onClick={() => onPageChange(page - 1)}
            style={{ padding: '6px 14px', borderRadius: 8, border, background: 'rgba(255,255,255,0.04)', color: page === 1 ? '#334155' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            ← Prev
          </button>
          <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
            style={{ padding: '6px 14px', borderRadius: 8, border, background: 'rgba(255,255,255,0.04)', color: page >= totalPages ? '#334155' : '#94a3b8', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
