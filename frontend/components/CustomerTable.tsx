"use client";

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalPurchases: number;
}

interface CustomerTableProps {
  customers: Customer[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}

export function CustomerTable({ customers, total, page, onPageChange }: CustomerTableProps) {
  const totalPages = Math.ceil(total / 20);
  const border = '1px solid rgba(255,255,255,0.07)';

  return (
    <div style={{ background: '#15151d', borderRadius: 14, border, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: border }}>
            {['Name', 'Phone', 'Email', 'Total Purchases'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} style={{ borderBottom: border }}>
              <td style={{ padding: '12px 16px', fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{c.name}</td>
              <td style={{ padding: '12px 16px', color: '#475569', fontSize: 13 }}>{c.phone || '—'}</td>
              <td style={{ padding: '12px 16px', color: '#475569', fontSize: 13 }}>{c.email || '—'}</td>
              <td style={{ padding: '12px 16px', fontWeight: 700, color: '#a78bfa', fontSize: 13 }}>{fmt(c.totalPurchases)}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#334155' }}>No customers found.</td></tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
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
