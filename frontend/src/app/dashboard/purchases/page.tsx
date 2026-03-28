'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');

type PurchaseItem = { productId: string; name: string; quantity: number; costPrice: number; currentStock: number };

export default function PurchasesPage() {
  const { theme } = useTheme();
  const [purchases,  setPurchases]  = useState<any[]>([]);
  const [suppliers,  setSuppliers]  = useState<any[]>([]);
  const [products,   setProducts]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [prodSearch, setProdSearch] = useState('');

  // PO form
  const [supplierId,     setSupplierId]     = useState('');
  const [billNumber,     setBillNumber]     = useState('');
  const [purchaseDate,   setPurchaseDate]   = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus,  setPaymentStatus]  = useState('PAID');
  const [paidAmount,     setPaidAmount]     = useState('');
  const [notes,          setNotes]          = useState('');
  const [items,          setItems]          = useState<PurchaseItem[]>([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [poRes, supRes, prodRes] = await Promise.allSettled([
        api.get('/api/purchases?limit=50'),
        api.get('/api/suppliers?limit=50'),
        api.get('/api/products?limit=50'),
      ]);
      if (poRes.status   === 'fulfilled') setPurchases(poRes.value.data.purchases || []);
      if (supRes.status  === 'fulfilled') setSuppliers(supRes.value.data.suppliers || []);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data.products  || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openModal = () => {
    setSupplierId(''); setBillNumber(''); setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPaymentStatus('PAID'); setPaidAmount(''); setNotes(''); setItems([]); setError('');
    setShowModal(true);
  };

  const addProduct = (p: any) => {
    if (items.find(i => i.productId === p.id)) return;
    setItems(prev => [...prev, { productId: p.id, name: p.name, quantity: 1, costPrice: Number(p.costPrice) || 0, currentStock: p.stock }]);
    setProdSearch('');
  };

  const updateItem = (productId: string, field: 'quantity' | 'costPrice', val: number) => {
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, [field]: val } : i));
  };

  const removeItem = (productId: string) => setItems(prev => prev.filter(i => i.productId !== productId));

  const totalAmount = items.reduce((s, i) => s + i.quantity * i.costPrice, 0);

  const save = async () => {
    if (!supplierId)    { setError('Please select a supplier'); return; }
    if (items.length === 0) { setError('Add at least one product'); return; }
    for (const i of items) {
      if (i.quantity <= 0)  { setError(`Quantity must be > 0 for ${i.name}`); return; }
      if (i.costPrice <= 0) { setError(`Cost price must be > 0 for ${i.name}`); return; }
    }
    setSaving(true); setError('');
    try {
      await api.post('/api/purchases', {
        supplierId,
        billNumber:    billNumber || undefined,
        purchaseDate:  new Date(purchaseDate).toISOString(),
        paymentStatus,
        paidAmount:    paymentStatus === 'PAID' ? totalAmount : (Number(paidAmount) || 0),
        notes:         notes || undefined,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })),
      });
      setShowModal(false);
      loadAll();
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.data?.details?.[0]?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { background: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, padding: '9px 12px', fontSize: 13, width: '100%', outline: 'none' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 };

  const filteredProds = products.filter(p =>
    !items.find(i => i.productId === p.id) &&
    p.name.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const totalPOs    = purchases.length;
  const totalSpent  = purchases.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
  const unpaidPOs   = purchases.filter(p => p.paymentStatus !== 'PAID').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Purchase Orders</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>Restock inventory from suppliers</p>
        </div>
        <button onClick={openModal}
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + New Purchase Order
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { label: 'Total POs',    value: totalPOs,       color: '#a78bfa' },
          { label: 'Total Spent',  value: fmt(totalSpent),color: '#ef4444' },
          { label: 'Unpaid POs',   value: unpaidPOs,      color: unpaidPOs > 0 ? '#f59e0b' : '#10b981' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Purchases Table */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading...</div>
        ) : purchases.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📦</div>
            <div style={{ color: theme.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No purchase orders yet</div>
            <div style={{ color: theme.textFaint, fontSize: 13, marginBottom: 20 }}>Create a PO to restock from a supplier — stock will update automatically</div>
            <button onClick={openModal} style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
              + Create First PO
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Bill No.', 'Supplier', 'Items', 'Total', 'Paid', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p: any) => {
                const paid = p.paymentStatus === 'PAID';
                const partial = p.paymentStatus === 'PARTIAL';
                const statusColor = paid ? '#10b981' : partial ? '#f59e0b' : '#ef4444';
                const statusBg = paid ? 'rgba(16,185,129,.12)' : partial ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)';
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>{p.billNumber}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: theme.text }}>{p.supplier?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: theme.textMuted }}>{p.items?.length ?? '—'} items</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: theme.text }}>{fmt(p.totalAmount)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: theme.textMuted }}>{fmt(p.paidAmount)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: statusBg, color: statusColor, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.paymentStatus}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: theme.textFaint }}>
                      {new Date(p.purchaseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create PO Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 700, marginTop: 10 }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: theme.text }}>New Purchase Order</div>
                <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 2 }}>Stock will be updated automatically on save</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</button>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}

            {/* Top fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              <div>
                <label style={lbl}>Supplier *</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={inp}>
                  <option value="">— Select supplier —</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Bill / Invoice Number</label>
                <input value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="Auto-generated if blank" style={inp} />
              </div>
              <div>
                <label style={lbl}>Purchase Date</label>
                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Payment Status</label>
                <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} style={inp}>
                  <option value="PAID">Paid</option>
                  <option value="PARTIAL">Partially Paid</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>
              {paymentStatus !== 'PAID' && (
                <div>
                  <label style={lbl}>Amount Paid (Rs.)</label>
                  <input type="number" min="0" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0" style={inp} />
                </div>
              )}
              <div style={{ gridColumn: paymentStatus !== 'PAID' ? '2' : '1 / -1' }}>
                <label style={lbl}>Notes (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks..." style={inp} />
              </div>
            </div>

            {/* Product search */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Add Products</label>
              <input value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                placeholder="Search product to add..."
                style={inp} />
              {prodSearch && (
                <div style={{ background: theme.input, border: `1px solid ${theme.border}`, borderRadius: 9, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {filteredProds.slice(0, 8).map(p => (
                    <div key={p.id} onClick={() => addProduct(p)}
                      style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = theme.hover}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <span style={{ fontSize: 13, color: theme.text }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: theme.textFaint }}>Stock: {p.stock} · Cost: {fmt(p.costPrice)}</span>
                    </div>
                  ))}
                  {filteredProds.length === 0 && <div style={{ padding: '10px 14px', color: theme.textFaint, fontSize: 13 }}>No products found</div>}
                </div>
              )}
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: theme.hover }}>
                      {['Product', 'Current Stock', 'Qty to Add', 'Cost Price (Rs.)', 'Subtotal', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.productId} style={{ borderTop: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: theme.text }}>{item.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: theme.textFaint }}>{item.currentStock}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <input type="number" min="1" value={item.quantity}
                            onChange={e => updateItem(item.productId, 'quantity', Math.max(1, Number(e.target.value)))}
                            style={{ ...inp, width: 70, padding: '6px 8px' }} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <input type="number" min="0.01" step="0.01" value={item.costPrice}
                            onChange={e => updateItem(item.productId, 'costPrice', Number(e.target.value))}
                            style={{ ...inp, width: 100, padding: '6px 8px' }} />
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#a78bfa' }}>{fmt(item.quantity * item.costPrice)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={() => removeItem(item.productId)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>×</button>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${theme.border}`, background: theme.hover }}>
                      <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: theme.text }}>Total</td>
                      <td style={{ padding: '10px 12px', fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{fmt(totalAmount)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Save buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving & Updating Stock...' : `✓ Save PO · ${fmt(totalAmount)}`}
              </button>
              <button onClick={() => setShowModal(false)}
                style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '13px 20px', borderRadius: 10, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
