"use client";

import { Edit, Trash2 } from "lucide-react";

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

interface Product {
  id: string;
  name: string;
  sku?: string;
  sellingPrice: number;
  stock: number;
  lowStockAlert: number;
}

interface ProductTableProps {
  products: Product[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
}

export function ProductTable({ products, total, page, onPageChange, onEdit, onDelete }: ProductTableProps) {
  const totalPages = Math.ceil(total / 20);
  const border = '1px solid rgba(255,255,255,0.07)';

  return (
    <div style={{ background: '#15151d', borderRadius: 14, border, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: border }}>
            {['Product Name', 'SKU', 'Price', 'Stock', 'Status', 'Actions'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const isLow = p.stock <= p.lowStockAlert;
            return (
              <tr key={p.id} style={{ borderBottom: border }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{p.name}</td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize: 12, fontFamily: 'monospace' }}>{p.sku || '—'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>{fmt(p.sellingPrice)}</td>
                <td style={{ padding: '12px 16px', color: isLow ? '#f59e0b' : '#e2e8f0', fontWeight: 700, fontSize: 13 }}>{p.stock}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: isLow ? 'rgba(245,158,11,.14)' : 'rgba(16,185,129,.14)',
                    color: isLow ? '#f59e0b' : '#10b981'
                  }}>
                    {isLow ? 'Low Stock' : 'In Stock'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {onEdit && (
                      <button onClick={() => onEdit(p)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(96,165,250,.14)', color: '#60a5fa', cursor: 'pointer' }}>
                        <Edit size={13} />
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(p.id)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,.14)', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#334155' }}>No products found.</td></tr>
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
