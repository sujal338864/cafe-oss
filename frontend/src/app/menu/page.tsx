'use client';
import { useEffect, useState, Suspense, useRef, memo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

type Product = { id: string; name: string; sellingPrice: number; description?: string; imageUrl?: string; categoryId?: string; stock: number; taxRate: number; };
type Category = { id: string; name: string; color?: string };
type CartItem = Product & { qty: number; note: string };

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function get(path: string) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function post(path: string, body: any) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw { response: { data: d } };
  return d;
}

/* ─── Skeleton ─── */
function SkeletonItem() {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #f1f1f1' }}>
      <div style={{ width: 64, height: 64, borderRadius: 14, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: '60%', background: '#f0f0f0', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 12, width: '35%', background: '#f0f0f0', borderRadius: 6 }} />
      </div>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f0f0', alignSelf: 'center' }} />
    </div>
  );
}

/* ─── Product Row (memoized) ─── */
const ProductItem = memo(function ProductItem({ p, inCart, onAdd, onInc, onDec }: {
  p: Product; inCart?: CartItem; onAdd: () => void; onInc: () => void; onDec: () => void;
}) {
  const outOfStock = p.stock <= 0;
  return (
    <div className="product-row" style={{
      display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
      opacity: outOfStock ? 0.45 : 1,
    }}>
      {/* Thumbnail */}
      <div style={{
        width: 64, height: 64, borderRadius: 14, flexShrink: 0, overflow: 'hidden',
        background: p.imageUrl ? '#f8f8f8' : 'linear-gradient(135deg,#f0f0f0,#e8e8e8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {p.imageUrl
          ? <img src={p.imageUrl} alt="" width={64} height={64} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 22, fontWeight: 800, color: '#bbb' }}>{p.name[0]}</span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', lineHeight: 1.3, marginBottom: 2 }}>{p.name}</div>
        {p.description && <div style={{ fontSize: 12, color: '#999', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.description}</div>}
        <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginTop: 4 }}>{fmt(p.sellingPrice)}</div>
      </div>

      {/* Add / Qty */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {outOfStock ? (
          <span style={{ fontSize: 11, color: '#ccc', fontWeight: 600 }}>Sold out</span>
        ) : inCart ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: '#111', borderRadius: 10, padding: '4px 6px',
          }}>
            <button onClick={onDec} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', width: 28, height: 28, lineHeight: '28px', fontWeight: 700 }}>−</button>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'center' as const }}>{inCart.qty}</span>
            <button onClick={onInc} style={{ background: 'none', border: 'none', color: '#4ade80', fontSize: 18, cursor: 'pointer', width: 28, height: 28, lineHeight: '28px', fontWeight: 700 }}>+</button>
          </div>
        ) : (
          <button onClick={onAdd} style={{
            background: '#fff', border: '1.5px solid #e5e5e5', color: '#16a34a', width: 36, height: 36,
            borderRadius: 10, fontSize: 22, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>+</button>
        )}
      </div>
    </div>
  );
});

export default function MenuPage() {
  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { scroll-behavior: smooth; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .product-row { transition: background 0.15s; }
        .product-row:active { background: rgba(0,0,0,0.02); }
        input:focus, textarea:focus { border-color: #16a34a !important; outline: none; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Loading...</div>}>
        <MenuContent />
      </Suspense>
    </>
  );
}

function MenuContent() {
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shopId');

  const [products, setProducts] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeout = useRef<NodeJS.Timeout>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [step, setStep] = useState<'menu' | 'cart' | 'info' | 'done'>('menu');
  const [shopName, setShopName] = useState('Our Menu');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [table, setTable] = useState('');
  const [notes, setNotes] = useState('');
  const [pay, setPay] = useState<'UPI' | 'CASH'>('UPI');
  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ id?: string; invoiceNumber: string; tokenNumber?: string; paymentStatus: string; whatsappSent: boolean } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  useEffect(() => {
    const t = searchParams.get('table') || searchParams.get('tableNumber') || searchParams.get('t');
    if (t) setTable(t);
  }, [searchParams]);

  useEffect(() => { if (shopId) load(); }, [shopId]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 150);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) lookupCustomer(digits);
    else { setLoyaltyPoints(0); setPointsToRedeem(0); }
  }, [phone]);

  useEffect(() => {
    if (step !== 'done' || !result?.id || result.paymentStatus === 'PAID') return;
    const interval = setInterval(async () => {
      try {
        const d = await get(`/api/menu/order/${result.id}/status`);
        if (d.paymentStatus === 'PAID') setResult(r => r ? { ...r, paymentStatus: 'PAID' } : r);
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [step, result?.id, result?.paymentStatus]);

  const lookupCustomer = async (digits: string) => {
    try {
      const data = await get(`/api/menu/customer?phone=${digits}&shopId=${shopId}`);
      if (data.loyaltyPoints) setLoyaltyPoints(data.loyaltyPoints);
      if (data.name && !name.trim()) setName(data.name);
    } catch {}
  };

  const load = async () => {
    setError(false);
    try {
      const data = await get(`/api/menu?shopId=${shopId}`);
      setProducts((data.products || []).filter((x: Product) => x.stock > 0));
      setAllCategories(data.categories || []);
      setShopName(data.shop?.name || 'Our Menu');
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  const addToCart = useCallback((p: Product) => setCart(c => {
    const ex = c.find(i => i.id === p.id);
    if (ex) return c.map(i => i.id === p.id ? { ...i, qty: Math.min(i.qty + 1, p.stock) } : i);
    return [...c, { ...p, qty: 1, note: '' }];
  }), []);
  const dec = useCallback((id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0)), []);
  const inc = useCallback((id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i)), []);
  const setNote = useCallback((id: string, note: string) => setCart(c => c.map(i => i.id === id ? { ...i, note } : i)), []);

  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
  const tax = cart.reduce((s, i) => s + (i.sellingPrice * i.qty) * (i.taxRate / 100), 0);
  const REDEEM_RATE = 10;
  const total = subtotal + tax;
  const pointsDiscount = (pointsToRedeem / REDEEM_RATE) || 0;
  const finalTotal = Math.max(0, total - pointsDiscount);

  const cats = ['All', ...allCategories.map(c => c.name)];
  const catMap = Object.fromEntries(allCategories.map(c => [c.id, c.name]));
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const filtered = products.filter(p => (cat === 'All' || catMap[p.categoryId || ''] === cat) && p.name.toLowerCase().includes(debouncedSearch.toLowerCase()));

  // Shared styles
  const inp: any = { background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 12, padding: '13px 14px', color: '#1a1a1a', fontSize: 15, width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s' };
  const glass: any = { background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' };

  const placeOrder = async () => {
    if (!name.trim()) return;
    setPlacing(true);
    try {
      const d = await post('/api/menu/order', {
        shopId, customerName: name.trim(), customerPhone: phone.trim() || undefined,
        tableNumber: table.trim() || undefined, notes: notes.trim() || undefined,
        paymentMethod: pay, redeemPoints: pointsToRedeem,
        items: cart.map(i => ({ productId: i.id, name: i.name, quantity: i.qty, unitPrice: i.sellingPrice, costPrice: 0, taxRate: i.taxRate, discount: 0 }))
      });
      setResult({
        id: d.order?.id || '', invoiceNumber: d.order?.invoiceNumber || d.invoiceNumber || '',
        tokenNumber: d.tokenNumber, paymentStatus: d.paymentStatus || pay, whatsappSent: d.whatsappSent || false,
      });
      setStep('done');
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed to place order'); }
    finally { setPlacing(false); }
  };

  if (!shopId) return <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontFamily: 'system-ui' }}>Invalid menu link</div>;

  /* ═══════ DONE SCREEN ═══════ */
  if (step === 'done' && result) {
    const isPaid = result.paymentStatus === 'PAID';
    const token = result.tokenNumber?.replace(/^0+/, '') || result.invoiceNumber?.replace('ONL-', '').replace(/^0+/, '') || '?';
    return (
      <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, animation: 'fadeUp 0.4s ease-out' }}>
          {isPaid ? (
            <>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, color: '#fff' }}>✓</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 4 }}>Order Confirmed!</h1>
              <p style={{ color: '#666', marginBottom: 4, fontSize: 15 }}>Thank you, <b style={{ color: '#111' }}>{name}</b></p>
              {result.invoiceNumber && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 20 }}>#{result.invoiceNumber}</p>}
              {result.whatsappSent && phone && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#15803d' }}>
                  📲 Bill sent to WhatsApp: <b>{phone}</b>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, color: '#fff' }}>🎫</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 4 }}>Order Placed!</h1>
              <p style={{ color: '#666', marginBottom: 20, fontSize: 15 }}>Please pay at the counter</p>
              <div style={{ background: '#fffbeb', border: '2px solid #fbbf24', borderRadius: 20, padding: '28px 16px', marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 }}>Your Token</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: '#b45309', lineHeight: 1 }}>#{token}</div>
                <div style={{ fontSize: 13, color: '#a16207', marginTop: 8 }}>Show at counter to collect your order</div>
              </div>
            </>
          )}

          <div style={{ ...glass, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16, padding: 16, marginBottom: 20, textAlign: 'left' as const }}>
            {cart.map((item, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < cart.length - 1 ? '1px solid #f1f1f1' : 'none', fontSize: 14, color: '#333' }}><span>{item.name} ×{item.qty}</span><span style={{ fontWeight: 700 }}>{fmt(item.sellingPrice * item.qty)}</span></div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e5e5', fontWeight: 800, fontSize: 16, color: '#111' }}><span>Total</span><span>{fmt(total)}</span></div>
          </div>

          {result?.id && isPaid && (
            <button onClick={() => window.open(API + '/api/menu/order/' + result.id + '/invoice')}
              style={{ width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#475569', padding: 12, borderRadius: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
              📄 Download Invoice
            </button>
          )}
          {table && <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>🪑 Table <b style={{ color: '#111' }}>{table}</b></p>}
          <button onClick={() => { setCart([]); setStep('menu'); setName(''); setPhone(''); setTable(''); setNotes(''); setResult(null); setPointsToRedeem(0); }}
            style={{ width: '100%', background: '#111', border: 'none', color: '#fff', padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Order More
          </button>
        </div>
      </div>
    );
  }

  /* ═══════ CHECKOUT / INFO SCREEN ═══════ */
  if (step === 'info') return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'system-ui', paddingBottom: 100, animation: 'fadeUp 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ ...glass, padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => setStep(cart.length > 0 ? 'cart' : 'menu')} style={{ background: '#f5f5f5', border: 'none', color: '#333', width: 36, height: 36, borderRadius: 12, fontSize: 18, cursor: 'pointer', fontWeight: 600 }}>←</button>
        <div style={{ fontWeight: 700, fontSize: 17, color: '#111' }}>Checkout</div>
      </div>
      <div style={{ padding: '18px 18px 0', maxWidth: 480, margin: '0 auto' }}>
        {/* Order Summary */}
        <div style={{ ...glass, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>Order Summary</div>
          {cart.map((item, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{item.name}</div>
                  {item.note && <div style={{ fontSize: 12, color: '#888' }}>📝 {item.note}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f5f5f5', borderRadius: 8, padding: '2px 4px' }}>
                    <button onClick={() => dec(item.id)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', width: 24, height: 24 }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 13, minWidth: 16, textAlign: 'center' as const, color: '#111' }}>{item.qty}</span>
                    <button onClick={() => inc(item.id)} style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 16, cursor: 'pointer', width: 24, height: 24 }}>+</button>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, minWidth: 55, textAlign: 'right' as const, color: '#111' }}>{fmt(item.sellingPrice * item.qty)}</span>
                </div>
              </div>
              <button onClick={() => setNoteFor(noteFor === item.id ? null : item.id)} style={{ background: 'none', border: 'none', color: '#999', fontSize: 11, cursor: 'pointer', padding: '0 0 4px' }}>
                {noteFor === item.id ? '▲ Hide' : '+ Add note'}
              </button>
              {noteFor === item.id && <input value={item.note} onChange={e => setNote(item.id, e.target.value)} placeholder="e.g. less spice..." style={{ ...inp, marginBottom: 6, fontSize: 13, padding: '8px 12px' }} />}
            </div>
          ))}
          <div style={{ borderTop: '1px solid #f1f1f1', marginTop: 6, paddingTop: 10 }}>
            {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888', marginBottom: 3 }}><span>Tax</span><span>{fmt(Math.round(tax))}</span></div>}
            {pointsDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f59e0b', marginBottom: 3 }}><span>Points</span><span>−{fmt(pointsDiscount)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, color: '#111' }}><span>Total</span><span>{fmt(finalTotal)}</span></div>
          </div>
        </div>

        {/* Loyalty Points */}
        {loyaltyPoints >= 100 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 14, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>⭐ {loyaltyPoints} Points</div>
              <div style={{ fontSize: 11, color: '#a16207' }}>Use for instant discount</div>
            </div>
            <button onClick={() => setPointsToRedeem(pointsToRedeem > 0 ? 0 : Math.floor(loyaltyPoints / 100) * 100)}
              style={{ background: pointsToRedeem > 0 ? '#f59e0b' : 'transparent', border: '1.5px solid #f59e0b', color: pointsToRedeem > 0 ? '#fff' : '#b45309', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
              {pointsToRedeem > 0 ? '✓ Applied' : 'Redeem'}
            </button>
          </div>
        )}

        {/* Your Details */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Your Details</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 20 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name *" style={inp} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile (get bill on WhatsApp)" type="tel" style={inp} />
          <input value={table} onChange={e => setTable(e.target.value)} placeholder="Table number (optional)" style={inp} />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requests..." rows={2} style={{ ...inp, resize: 'none' as const, fontFamily: 'inherit' }} />
        </div>

        {/* Payment */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Payment</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { v: 'UPI', icon: '📱', l: 'UPI', s: 'GPay · PhonePe' },
            { v: 'CASH', icon: '💵', l: 'Counter', s: 'Pay when you collect' },
          ].map(m => (
            <button key={m.v} onClick={() => setPay(m.v as any)}
              style={{
                background: pay === m.v ? '#111' : '#fff', border: '1.5px solid ' + (pay === m.v ? '#111' : '#e5e5e5'),
                borderRadius: 14, padding: '14px 12px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: pay === m.v ? '#fff' : '#111' }}>{m.l}</div>
              <div style={{ fontSize: 11, color: pay === m.v ? '#999' : '#888', marginTop: 2 }}>{m.s}</div>
              {m.v === 'CASH' && pay === 'CASH' && <div style={{ marginTop: 6, fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>🎫 You'll get a token</div>}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 18px', ...glass, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button onClick={placeOrder} disabled={placing || !name.trim()}
          style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', background: name.trim() ? '#111' : '#e5e5e5', border: 'none', color: name.trim() ? '#fff' : '#999', padding: 15, borderRadius: 14, fontWeight: 800, fontSize: 15, cursor: name.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
          {placing ? 'Placing order...' : pay === 'UPI' ? `Pay ${fmt(finalTotal)}` : `Get Token · ${fmt(finalTotal)}`}
        </button>
      </div>
    </div>
  );

  /* ═══════ CART DRAWER ═══════ */
  if (step === 'cart') return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'system-ui', paddingBottom: 100, animation: 'fadeUp 0.25s ease-out' }}>
      <div style={{ ...glass, padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setStep('menu')} style={{ background: '#f5f5f5', border: 'none', color: '#333', width: 36, height: 36, borderRadius: 12, fontSize: 18, cursor: 'pointer', fontWeight: 600 }}>←</button>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#111' }}>Your Cart</div>
        </div>
        <span style={{ fontSize: 13, color: '#999' }}>{count} items</span>
      </div>
      <div style={{ padding: '10px 18px', maxWidth: 480, margin: '0 auto' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Cart is empty</div>
            <div style={{ fontSize: 13 }}>Add items from the menu</div>
          </div>
        ) : (
          <>
            {cart.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #f1f1f1', animation: `fadeUp 0.2s ease-out ${i * 0.05}s both` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{fmt(item.sellingPrice)} each</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f5f5f5', borderRadius: 10, padding: '4px 6px' }}>
                    <button onClick={() => dec(item.id)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', width: 28, height: 28, fontWeight: 700 }}>−</button>
                    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'center' as const, color: '#111' }}>{item.qty}</span>
                    <button onClick={() => inc(item.id)} style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 18, cursor: 'pointer', width: 28, height: 28, fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, minWidth: 55, textAlign: 'right' as const, color: '#111' }}>{fmt(item.sellingPrice * item.qty)}</span>
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e5e5e5', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, color: '#111' }}>
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </>
        )}
      </div>
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 18px', ...glass, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={() => setStep('info')}
            style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', background: '#111', border: 'none', color: '#fff', padding: 15, borderRadius: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            Checkout · {fmt(total)}
          </button>
        </div>
      )}
    </div>
  );

  /* ═══════ MENU SCREEN ═══════ */
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'system-ui', paddingBottom: count > 0 ? 80 : 20 }}>
      {/* Header */}
      <div style={{ ...glass, padding: '20px 18px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', margin: 0, lineHeight: 1.2 }}>{shopName}</h1>
            <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>Browse our menu</p>
          </div>
          {count > 0 && (
            <button onClick={() => setStep('cart')} style={{
              background: '#111', border: 'none', color: '#fff', borderRadius: 12, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              🛒 <span style={{ background: '#4ade80', color: '#000', borderRadius: 6, padding: '1px 6px', fontSize: 12, fontWeight: 800 }}>{count}</span>
            </button>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#bbb' }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..."
            style={{ ...inp, paddingLeft: 38, background: '#f5f5f5', border: '1px solid transparent', borderRadius: 12 }} />
        </div>
      </div>

      {/* Category Tabs */}
      {cats.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 18px', overflowX: 'auto' as const, scrollbarWidth: 'none' as const, position: 'sticky', top: 118, zIndex: 15, ...glass, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              flexShrink: 0, padding: '7px 16px', borderRadius: 50, border: cat === c ? 'none' : '1px solid #e5e5e5',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              background: cat === c ? '#111' : '#fff', color: cat === c ? '#fff' : '#555',
            }}>{c}</button>
          ))}
        </div>
      )}

      {/* Product List */}
      <div style={{ padding: '4px 18px', maxWidth: 480, margin: '0 auto' }}>
        {loading ? (
          <>{Array.from({ length: 6 }).map((_, i) => <SkeletonItem key={i} />)}</>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>😕</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#333', marginBottom: 8 }}>Something went wrong</div>
            <button onClick={load} style={{ background: '#111', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>No items found</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Try a different search or category</div>
          </div>
        ) : (
          filtered.map(p => {
            const inCart = cart.find(i => i.id === p.id);
            return <ProductItem key={p.id} p={p} inCart={inCart} onAdd={() => addToCart(p)} onInc={() => inc(p.id)} onDec={() => dec(p.id)} />;
          })
        )}
      </div>

      {/* Floating Cart Bar */}
      {count > 0 && (
        <div style={{ position: 'fixed', bottom: 14, left: 14, right: 14, zIndex: 50, animation: 'slideUp 0.25s ease-out' }}>
          <button onClick={() => setStep('cart')} style={{
            width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex', background: '#111',
            border: 'none', color: '#fff', padding: '14px 18px', borderRadius: 16, fontWeight: 700,
            fontSize: 14, cursor: 'pointer', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          }}>
            <span style={{ background: '#4ade80', color: '#000', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>{count}</span>
            <span>View Cart</span>
            <span style={{ fontWeight: 900 }}>{fmt(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}