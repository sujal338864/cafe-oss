'use client';
import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');
const COLORS = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#0891b2','#7c3aed'];

// paymentMethod enum the backend accepts: CASH | UPI | CARD | BANK_TRANSFER | CREDIT
const METHODS = [
  { value: 'CASH',          label: 'Cash' },
  { value: 'UPI',           label: 'UPI' },
  { value: 'CARD',          label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank' },
  { value: 'CREDIT',        label: 'Credit' },
];

type CartItem = { id: string; name: string; sellingPrice: number; costPrice: number; taxRate: number; qty: number; stock: number; };
type Receipt  = { invoiceNumber: string; items: CartItem[]; subtotal: number; taxAmount: number; discountAmount: number; total: number; method: string; customer: { name: string; phone?: string } | null; date: string; };

export default function POSPage() {
  const { theme } = useTheme();
  const [products,   setProducts]   = useState<any[]>([]);
  const [customers,  setCustomers]  = useState<any[]>([]);
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [search,     setSearch]     = useState('');
  const [method,     setMethod]     = useState('CASH');
  const [discount,   setDiscount]   = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt,    setReceipt]    = useState<Receipt | null>(null);

  // New customer form
  const [showNewCust, setShowNewCust] = useState(false);
  const [custForm,    setCustForm]    = useState({ name: '', phone: '' });
  const [custSaving,  setCustSaving]  = useState(false);
  const [custErr,     setCustErr]     = useState('');

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [pRes, cRes] = await Promise.allSettled([
        api.get('/api/products?limit=200'),
        api.get('/api/customers'),
      ]);
      if (pRes.status === 'fulfilled') setProducts(pRes.value.data.products || []);
      if (cRes.status === 'fulfilled') {
        const d = cRes.value.data;
        setCustomers(d.customers || d || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addToCart = (p: any) => setCart(c => {
    const ex = c.find(i => i.id === p.id);
    if (ex) return c.map(i => i.id === p.id ? { ...i, qty: Math.min(i.qty + 1, i.stock) } : i);
    return [...c, { id: p.id, name: p.name, sellingPrice: Number(p.sellingPrice), costPrice: Number(p.costPrice || 0), taxRate: Number(p.taxRate || 0), qty: 1, stock: p.stock }];
  });
  const dec = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0));
  const inc = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.min(i.qty + 1, i.stock) } : i));

  const subtotal     = cart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
  const taxAmount    = cart.reduce((s, i) => s + (i.sellingPrice * i.qty) * (i.taxRate / 100), 0);
  const discountAmt  = Math.min(discount, subtotal + taxAmount);
  const total        = subtotal + taxAmount - discountAmt;

  const saveNewCustomer = async () => {
    if (!custForm.name.trim()) { setCustErr('Name is required'); return; }
    setCustSaving(true); setCustErr('');
    try {
      const { data } = await api.post('/api/customers', {
        name:  custForm.name.trim(),
        phone: custForm.phone.trim() || undefined,
      });
      const newC = data.customer || data;
      setCustomers(prev => [...prev, newC]);
      setCustomerId(newC.id);
      setShowNewCust(false);
      setCustForm({ name: '', phone: '' });
    } catch (e: any) {
      setCustErr(e.response?.data?.error || 'Failed to add customer');
    } finally { setCustSaving(false); }
  };

  const checkout = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/orders', {
        customerId:     customerId || undefined,
        paymentMethod:  method,
        paymentStatus:  'PAID',
        discountAmount: discountAmt,
        items: cart.map(i => ({
          productId: i.id,
          name:      i.name,          // required by backend schema
          quantity:  i.qty,
          costPrice: i.costPrice,
          unitPrice: i.sellingPrice,
          taxRate:   i.taxRate,
          discount:  0,
        })),
      });

      const order = data.order || data;
      const customer = customers.find(c => c.id === customerId) || null;

      setReceipt({
        invoiceNumber: order.invoiceNumber,
        items:         [...cart],
        subtotal,
        taxAmount:     Math.round(taxAmount),
        discountAmount: discountAmt,
        total:         Number(order.totalAmount ?? total),
        method,
        customer,
        date: new Date().toISOString(),
      });

      setCart([]); setCustomerId(''); setDiscount(0);
      load(); // refresh stock
    } catch (e: any) {
      alert('Error: ' + (e.response?.data?.error || e.response?.data?.details?.[0]?.message || 'Checkout failed'));
    } finally { setSubmitting(false); }
  };

  const printBill = () => {
    const html = receiptRef.current?.innerHTML;
    if (!html) return;
    const w = window.open('', '_blank', 'width=380,height=620');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Bill</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:12px;color:#000;background:#fff;padding:12px;max-width:300px;margin:0 auto}
      .center{text-align:center}.bold{font-weight:bold}
      .shop{font-size:16px;font-weight:bold;text-align:center;margin-bottom:2px}
      .dash{border-top:1px dashed #000;margin:6px 0}
      .row{display:flex;justify-content:space-between;margin:2px 0}
      .total-row{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:4px}
      @media print{body{padding:0}}
    </style></head><body>${html}
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const inp: React.CSSProperties = {
    background: theme.input, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 9, padding: '9px 12px',
    fontSize: 13, width: '100%', outline: 'none',
  };

  // ── Receipt screen ────────────────────────────────────────────
  if (receipt) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✅</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>Sale Complete!</div>
          <div style={{ fontSize: 13, color: theme.textFaint }}>Invoice #{receipt.invoiceNumber}</div>
        </div>
      </div>

      {/* Printable bill */}
      <div style={{ background: '#fff', color: '#000', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 22px', width: '100%', maxWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
        <div ref={receiptRef}>
          <div className="shop" style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', fontFamily: 'Courier New, monospace' }}>KIRANA KING</div>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 6, fontFamily: 'Courier New, monospace' }}>
            {new Date(receipt.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ borderTop: '1px dashed #999', margin: '6px 0', fontFamily: 'monospace' }} />

          {receipt.customer && (
            <div style={{ fontSize: 11, marginBottom: 6, fontFamily: 'Courier New, monospace' }}>
              <div><strong>Customer:</strong> {receipt.customer.name}</div>
              {receipt.customer.phone && <div><strong>Phone:</strong> {receipt.customer.phone}</div>}
            </div>
          )}

          <div style={{ fontFamily: 'Courier New, monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: 3, marginBottom: 3 }}>
              <span style={{ flex: 1 }}>ITEM</span>
              <span style={{ width: 30, textAlign: 'center' }}>QTY</span>
              <span style={{ width: 75, textAlign: 'right' }}>AMT</span>
            </div>
            {receipt.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={{ flex: 1, overflow: 'hidden' }}>{item.name}</span>
                <span style={{ width: 30, textAlign: 'center' }}>{item.qty}</span>
                <span style={{ width: 75, textAlign: 'right' }}>{fmt(item.sellingPrice * item.qty)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px dashed #999', margin: '6px 0', fontFamily: 'monospace' }} />
          <div style={{ fontFamily: 'Courier New, monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <span>Subtotal</span><span>{fmt(receipt.subtotal)}</span>
            </div>
            {receipt.taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span>Tax</span><span>{fmt(receipt.taxAmount)}</span>
              </div>
            )}
            {receipt.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span>Discount</span><span>- {fmt(receipt.discountAmount)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px dashed #999', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 'bold' }}>
              <span>TOTAL</span><span>{fmt(receipt.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2, color: '#555' }}>
              <span>Payment</span><span>{receipt.method}</span>
            </div>
          </div>
          <div style={{ borderTop: '1px dashed #999', margin: '6px 0', fontFamily: 'monospace' }} />
          <div style={{ textAlign: 'center', fontSize: 11, color: '#555', fontFamily: 'Courier New, monospace' }}>Thank you! Please visit again.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={printBill}
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '12px 28px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🖨️ Print Bill
        </button>
        <button onClick={() => setReceipt(null)}
          style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '12px 24px', borderRadius: 11, fontWeight: 600, cursor: 'pointer' }}>
          New Sale
        </button>
      </div>
    </div>
  );

  // ── Main POS ─────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, height: 'calc(100vh - 108px)' }}>

      {/* Products panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>New Sale</h2>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
            style={{ ...inp, width: 240 }} />
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: theme.textFaint }}>Loading products...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, overflow: 'auto', paddingBottom: 8 }}>
            {filtered.map((p: any, idx: number) => (
              <div key={p.id} onClick={() => addToCart(p)}
                style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#7c3aed'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = theme.border}>
                <div style={{ width: '100%', aspectRatio: '1', background: COLORS[idx % COLORS.length] + '22', border: '1px solid ' + COLORS[idx % COLORS.length] + '44', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9 }} />
                    : <span style={{ fontSize: 28, fontWeight: 900, color: COLORS[idx % COLORS.length] }}>{p.name[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, lineHeight: 1.3, color: theme.text }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: 14 }}>{fmt(p.sellingPrice)}</span>
                  <span style={{ background: p.stock <= (p.lowStockAlert || 5) ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)', color: p.stock <= (p.lowStockAlert || 5) ? '#ef4444' : '#10b981', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.stock}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ gridColumn: 'span 3', padding: 36, textAlign: 'center', color: theme.textFaint }}>No products found.</div>}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, fontWeight: 700, fontSize: 14, color: theme.text }}>
          Bill {cart.length > 0 && <span style={{ color: '#a78bfa', fontWeight: 600, fontSize: 13 }}>({cart.length} items)</span>}
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {cart.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
              <div style={{ fontSize: 13 }}>Tap a product to add</div>
            </div>
          ) : cart.map(item => (
            <div key={item.id} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: theme.textFaint }}>{fmt(item.sellingPrice)} each</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: theme.hover, borderRadius: 7, padding: '3px 8px' }}>
                  <button onClick={() => dec(item.id)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>−</button>
                  <span style={{ fontWeight: 700, fontSize: 13, minWidth: 16, textAlign: 'center', color: theme.text }}>{item.qty}</span>
                  <button onClick={() => inc(item.id)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>+</button>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: theme.text, minWidth: 60, textAlign: 'right' }}>{fmt(item.sellingPrice * item.qty)}</span>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Customer selector */}
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">Walk-in Customer</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
                ))}
              </select>
              <button onClick={() => { setShowNewCust(true); setCustErr(''); setCustForm({ name: '', phone: '' }); }}
                title="Add new customer"
                style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: '#7c3aed', padding: '0 12px', borderRadius: 9, fontWeight: 800, fontSize: 20, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>+</button>
            </div>

            {/* Payment method */}
            <div style={{ display: 'flex', gap: 5 }}>
              {METHODS.map(m => (
                <button key={m.value} onClick={() => setMethod(m.value)} style={{
                  flex: 1, padding: '6px 2px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  background: method === m.value ? '#7c3aed' : theme.hover,
                  border: `1px solid ${method === m.value ? '#7c3aed' : theme.border}`,
                  color: method === m.value ? 'white' : theme.textMuted,
                }}>{m.label}</button>
              ))}
            </div>

            {/* Discount */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: theme.textFaint, whiteSpace: 'nowrap' }}>Discount Rs.</span>
              <input type="number" min="0" value={discount || ''} onChange={e => setDiscount(Number(e.target.value) || 0)}
                placeholder="0" style={{ ...inp }} />
            </div>

            {/* Totals */}
            <div style={{ fontSize: 12, color: theme.textFaint }}>
              {[
                ['Subtotal', fmt(subtotal)],
                taxAmount > 0 ? ['Tax', fmt(Math.round(taxAmount))] : null,
                discountAmt > 0 ? ['Discount', `- ${fmt(discountAmt)}`] : null,
              ].filter(Boolean).map(([l, v]: any) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span>{l}</span><span>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${theme.border}` }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#7c3aed' }}>{fmt(total)}</span>
            </div>

            <button onClick={checkout} disabled={submitting || cart.length === 0}
              style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 13, borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Processing...' : `Charge ${fmt(total)}`}
            </button>

            <button onClick={() => setCart([])}
              style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted, padding: 8, borderRadius: 9, cursor: 'pointer', fontSize: 12 }}>
              Clear Cart
            </button>
          </div>
        )}
      </div>

      {/* New Customer Modal */}
      {showNewCust && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowNewCust(false)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, width: '90%', maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>Add Customer</div>
              <button onClick={() => setShowNewCust(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>
            {custErr && <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{custErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Name *</label>
                <input value={custForm.name} onChange={e => setCustForm(v => ({ ...v, name: e.target.value }))}
                  placeholder="Customer name" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>
                  Mobile Number <span style={{ fontWeight: 400, fontSize: 10, textTransform: 'none' }}>(optional)</span>
                </label>
                <input value={custForm.phone} onChange={e => setCustForm(v => ({ ...v, phone: e.target.value }))}
                  placeholder="03xx-xxxxxxx" style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={saveNewCustomer} disabled={custSaving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 12, borderRadius: 10, fontWeight: 700, cursor: 'pointer', opacity: custSaving ? 0.7 : 1 }}>
                {custSaving ? 'Saving...' : 'Add Customer'}
              </button>
              <button onClick={() => { setShowNewCust(false); setCustomerId(''); }}
                style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
