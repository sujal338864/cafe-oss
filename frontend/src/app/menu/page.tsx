'use client';
import { useEffect, useState } from 'react';

type Product = { id: string; name: string; sellingPrice: number; description?: string; imageUrl?: string; category?: { name: string }; stock: number; taxRate: number; };
type CartItem = Product & { qty: number; note: string };

const fmt = (n: number) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');
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

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'menu'|'info'|'done'>('menu');
  const [shopName, setShopName] = useState('Our Menu');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [table, setTable] = useState('');
  const [notes, setNotes] = useState('');
  const [pay, setPay] = useState<'UPI'|'CASH'>('UPI');
  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ invoiceNumber: string; tokenNumber?: string; paymentStatus: string; whatsappSent: boolean } | null>(null);
  const [noteFor, setNoteFor] = useState<string|null>(null);

  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      lookupCustomer(digits);
    } else {
      setLoyaltyPoints(0);
      setPointsToRedeem(0);
    }
  }, [phone]);

  const lookupCustomer = async (digits: string) => {
    try {
      const data = await get(`/api/menu/customer?phone=${digits}`);
      if (data.loyaltyPoints) setLoyaltyPoints(data.loyaltyPoints);
      if (data.name && !name.trim()) setName(data.name);
    } catch (e) { console.warn('Lookup failed'); }
  };

  const load = async () => {
    try {
      const [p, s] = await Promise.allSettled([get('/api/menu'), get('/api/shop')]);
      if (p.status === 'fulfilled') {
        const prods: Product[] = p.value.products || [];
        setProducts(prods.filter(x => x.stock > 0));
        setCats(['All', ...Array.from(new Set(prods.map(x => x.category?.name).filter(Boolean) as string[]))]);
      }
      if (s.status === 'fulfilled') setShopName(s.value.shop?.name || s.value.name || 'Our Menu');
    } finally { setLoading(false); }
  };

  const addToCart = (p: Product) => setCart(c => { const ex = c.find(i => i.id === p.id); if (ex) return c.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i); return [...c, { ...p, qty: 1, note: '' }]; });
  const dec = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0));
  const inc = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i));
  const setNote = (id: string, note: string) => setCart(c => c.map(i => i.id === id ? { ...i, note } : i));

  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
  const tax = cart.reduce((s, i) => s + (i.sellingPrice * i.qty) * (i.taxRate / 100), 0);
  const REDEEM_RATE = 10;
  const total = subtotal + tax;
  const pointsDiscount = (pointsToRedeem / REDEEM_RATE) || 0;
  const finalTotal = Math.max(0, total - pointsDiscount);
  
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const filtered = products.filter(p => (cat === 'All' || p.category?.name === cat) && p.name.toLowerCase().includes(search.toLowerCase()));

  const placeOrder = async () => {
    if (!name.trim()) return;
    setPlacing(true);
    try {
      const d = await post('/api/menu/order', {
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        tableNumber: table.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: pay,
        redeemPoints: pointsToRedeem,
        items: cart.map(i => ({ productId: i.id, name: i.name, quantity: i.qty, unitPrice: i.sellingPrice, costPrice: 0, taxRate: i.taxRate, discount: 0 }))
      });
      setResult({
        invoiceNumber: d.order?.invoiceNumber || d.invoiceNumber || '',
        tokenNumber: d.tokenNumber,
        paymentStatus: d.paymentStatus || pay,
        whatsappSent: d.whatsappSent || false,
      });
      setStep('done');
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed to place order'); }
    finally { setPlacing(false); }
  };

  const G = '#080c08'; const C = '#0f1a0f'; const B = '#1a2e1a'; const T = '#f0fdf4'; const M = '#86efac'; const A = '#22c55e';
  const inp: any = { background: C, border: '1px solid ' + B, borderRadius: 10, padding: '12px 14px', color: T, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const COLS = ['#22c55e','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

  // ── Done screen ──────────────────────────────────────────────
  if (step === 'done' && result) {
    const isPaid = result.paymentStatus === 'PAID';
    const token = result.tokenNumber?.replace(/^0+/, '') || result.invoiceNumber?.replace('ONL-', '').replace(/^0+/, '') || '?';
    return (
      <div style={{ minHeight: '100vh', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
          {isPaid ? (
            <>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 38 }}>✓</div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: T, marginBottom: 6 }}>Order Confirmed!</h1>
              <p style={{ color: M, marginBottom: 4 }}>Thank you, <b style={{ color: T }}>{name}</b>!</p>
              {result.invoiceNumber && <p style={{ color: A, fontSize: 13, marginBottom: 16 }}>#{result.invoiceNumber}</p>}
              {result.whatsappSent && phone && (
                <div style={{ background: '#064e3b', border: '1px solid #065f46', borderRadius: 12, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#6ee7b7' }}>
                  📲 Bill sent to WhatsApp: <b style={{ color: T }}>{phone}</b>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 38 }}>🎫</div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: T, marginBottom: 6 }}>Order Placed!</h1>
              <p style={{ color: M, marginBottom: 16 }}>Please pay at the counter</p>
              {/* Token card */}
              <div style={{ background: 'linear-gradient(135deg,#f59e0b22,#d9770622)', border: '2px solid #f59e0b', borderRadius: 18, padding: '24px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 }}>Your Token Number</div>
                <div style={{ fontSize: 64, fontWeight: 900, color: '#fbbf24', lineHeight: 1, marginBottom: 8 }}>#{token}</div>
                <div style={{ fontSize: 13, color: M }}>Show this number at the counter to collect your order</div>
              </div>
            </>
          )}

          {/* Order summary */}
          <div style={{ background: C, border: '1px solid ' + B, borderRadius: 14, padding: 16, marginBottom: 20 }}>
            {cart.map((item, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < cart.length-1 ? '1px solid '+B : 'none', color: T, fontSize: 14 }}><span>{item.name} ×{item.qty}</span><span style={{ color: A, fontWeight: 700 }}>{fmt(item.sellingPrice * item.qty)}</span></div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid '+B, fontWeight: 800, fontSize: 16, color: T }}><span>Total</span><span style={{ color: A }}>{fmt(total)}</span></div>
            <div style={{ marginTop: 10, padding: '8px 12px', background: B, borderRadius: 8, color: M, fontSize: 13, textAlign: 'center' }}>
              {isPaid ? '📱 UPI payment confirmed' : '💵 Cash — Show token at counter'}
            </div>
          </div>

          {table && <p style={{ color: M, fontSize: 14, marginBottom: 16 }}>🪑 Table <b style={{ color: T }}>{table}</b></p>}
          <button onClick={() => { setCart([]); setStep('menu'); setName(''); setPhone(''); setTable(''); setNotes(''); setResult(null); }}
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: 'white', padding: '14px 36px', borderRadius: 50, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Order More
          </button>
        </div>
      </div>
    );
  }

  // ── Info / checkout step ───────────────────────────────────────
  if (step === 'info') return (
    <div style={{ minHeight: '100vh', background: G, fontFamily: 'system-ui,sans-serif', paddingBottom: 90 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid '+B, display: 'flex', alignItems: 'center', gap: 12, background: '#0a0f0a', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => setStep('menu')} style={{ background: B, border: 'none', color: M, width: 36, height: 36, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 17, color: T }}>Your Order</div>
      </div>
      <div style={{ padding: '18px 18px 0' }}>
        {/* Order summary */}
        <div style={{ background: C, border: '1px solid '+B, borderRadius: 14, padding: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: A, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>Summary</div>
          {cart.map((item, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T }}>{item.name}</div>
                  {item.note && <div style={{ fontSize: 11, color: M }}>📝 {item.note}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: B, borderRadius: 20, padding: '4px 9px' }}>
                    <button onClick={() => dec(item.id)} style={{ background: 'none', border: 'none', color: A, fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>−</button>
                    <span style={{ color: T, fontWeight: 700, minWidth: 14, textAlign: 'center' as const }}>{item.qty}</span>
                    <button onClick={() => inc(item.id)} style={{ background: 'none', border: 'none', color: A, fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>+</button>
                  </div>
                  <span style={{ color: A, fontWeight: 700, minWidth: 60, textAlign: 'right' as const, fontSize: 13 }}>{fmt(item.sellingPrice * item.qty)}</span>
                </div>
              </div>
              <button onClick={() => setNoteFor(noteFor === item.id ? null : item.id)} style={{ background: 'none', border: 'none', color: A, fontSize: 11, cursor: 'pointer', opacity: 0.7, padding: '0 0 5px' }}>
                {noteFor === item.id ? '▲ Hide note' : '+ Add note (less spice, etc.)'}
              </button>
              {noteFor === item.id && <input value={item.note} onChange={e => setNote(item.id, e.target.value)} placeholder="e.g. less sugar, extra hot..." style={{ ...inp, marginBottom: 6, fontSize: 12 }} />}
            </div>
          ))}
          <div style={{ borderTop: '1px solid '+B, marginTop: 6, paddingTop: 10 }}>
            {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: M, marginBottom: 3 }}><span>Tax</span><span>{fmt(Math.round(tax))}</span></div>}
            {pointsDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#f59e0b', marginBottom: 3 }}><span>Points Discount</span><span>-{fmt(pointsDiscount)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, color: T }}><span>Total</span><span style={{ color: A }}>{fmt(finalTotal)}</span></div>
          </div>
        </div>

        {/* Loyalty Redemption */}
        {loyaltyPoints >= 100 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>⭐ {loyaltyPoints} Points Available</div>
              <div style={{ fontSize: 11, color: M }}>Use points for instant discount</div>
            </div>
            <button onClick={() => setPointsToRedeem(pointsToRedeem > 0 ? 0 : Math.floor(loyaltyPoints / 100) * 100)} 
              style={{ background: pointsToRedeem > 0 ? '#f59e0b' : 'transparent', border: '1px solid #f59e0b', color: pointsToRedeem > 0 ? '#fff' : '#f59e0b', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              {pointsToRedeem > 0 ? 'Applied' : 'Redeem'}
            </button>
          </div>
        )}

        {/* Your details */}
        <div style={{ fontSize: 11, fontWeight: 700, color: A, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>Your Details</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 9, marginBottom: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name *" style={inp} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="📱 Mobile (get bill on WhatsApp)" type="tel" style={inp} />
          <input value={table} onChange={e => setTable(e.target.value)} placeholder="Table number (optional)" style={inp} />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requests..." rows={2} style={{ ...inp, resize: 'none' as const, fontFamily: 'inherit' }} />
        </div>

        {/* Payment method */}
        <div style={{ fontSize: 11, fontWeight: 700, color: A, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>How do you want to pay?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
          {[
            { v: 'UPI',  icon: '📱', l: 'Pay with UPI', s: 'GPay · PhonePe · Paytm' },
            { v: 'CASH', icon: '💵', l: 'Pay at Counter', s: 'Cash when you collect' },
          ].map(m => (
            <button key={m.v} onClick={() => setPay(m.v as any)}
              style={{ background: pay === m.v ? (m.v === 'UPI' ? 'linear-gradient(135deg,#1d4ed8,#3b82f6)' : 'linear-gradient(135deg,#b45309,#d97706)') : C, border: '2px solid ' + (pay === m.v ? (m.v === 'UPI' ? '#3b82f6' : '#f59e0b') : B), borderRadius: 11, padding: '14px 10px', cursor: 'pointer', textAlign: 'left' as const }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: T }}>{m.l}</div>
              <div style={{ fontSize: 10, color: M, marginTop: 2 }}>{m.s}</div>
              {m.v === 'CASH' && pay === 'CASH' && (
                <div style={{ marginTop: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>
                  🎫 You'll get a token number
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 18px', background: G, borderTop: '1px solid '+B }}>
        <button onClick={placeOrder} disabled={placing || !name.trim()}
          style={{ width: '100%', background: name.trim() ? 'linear-gradient(135deg,#22c55e,#16a34a)' : B, border: 'none', color: name.trim() ? 'white' : '#4b5563', padding: '14px', borderRadius: 13, fontWeight: 800, fontSize: 15, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
          {placing ? 'Placing...' : pay === 'UPI' ? `Pay ${fmt(finalTotal)} · UPI` : `Get Token · ${fmt(finalTotal)}`}
        </button>
      </div>
    </div>
  );

  // ── Menu browsing ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: G, fontFamily: 'system-ui,sans-serif', paddingBottom: count > 0 ? 88 : 20 }}>
      <div style={{ background: 'linear-gradient(180deg,#0a1a0a,#080c08)', padding: '24px 18px 14px', textAlign: 'center', borderBottom: '1px solid '+B }}>
        <div style={{ width: 50, height: 50, borderRadius: 13, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 24 }}>☕</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T, margin: '0 0 3px' }}>{shopName}</h1>
        <p style={{ fontSize: 12, color: M, margin: '0 0 12px' }}>Scan · Order · Enjoy</p>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..." style={{ ...inp, paddingLeft: 36 }} />
        </div>
      </div>
      {cats.length > 1 && (
        <div style={{ display: 'flex', gap: 7, padding: '11px 14px', overflowX: 'auto' as const, scrollbarWidth: 'none' as const }}>
          {cats.map(c => <button key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 50, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: cat === c ? 'linear-gradient(135deg,#22c55e,#16a34a)' : C, color: cat === c ? 'white' : M }}>{c}</button>)}
        </div>
      )}
      <div style={{ padding: '4px 12px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: A }}>Loading menu...</div> :
         filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: '#4b5563' }}>No items found</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            {filtered.map((p, idx) => {
              const inCart = cart.find(i => i.id === p.id);
              const col = COLS[idx % COLS.length];
              return (
                <div key={p.id} style={{ background: C, border: '1px solid ' + (inCart ? col+'66' : B), borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ width: '100%', aspectRatio: '4/3' as any, background: col+'22', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' as const }} /> : <span style={{ fontSize: 38, fontWeight: 900, color: col }}>{p.name[0].toUpperCase()}</span>}
                  </div>
                  <div style={{ padding: '10px 11px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T, marginBottom: 7, lineHeight: 1.3 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 7, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>{p.description}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: col }}>{fmt(p.sellingPrice)}</span>
                      {inCart ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: B, borderRadius: 20, padding: '4px 8px' }}>
                          <button onClick={() => dec(p.id)} style={{ background: 'none', border: 'none', color: col, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>−</button>
                          <span style={{ color: T, fontWeight: 800, fontSize: 13, minWidth: 14, textAlign: 'center' as const }}>{inCart.qty}</span>
                          <button onClick={() => inc(p.id)} style={{ background: 'none', border: 'none', color: col, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>+</button>
                        </div>
                      ) : <button onClick={() => addToCart(p)} style={{ background: col, border: 'none', color: 'white', width: 28, height: 28, borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {count > 0 && (
        <div style={{ position: 'fixed', bottom: 14, left: 14, right: 14, zIndex: 50 }}>
          <button onClick={() => setStep('info')} style={{ width: '100%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: 'white', padding: '14px 18px', borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 6px 24px rgba(34,197,94,0.4)' }}>
            <span style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: '2px 9px', fontSize: 12 }}>{count} items</span>
            <span>View Order</span>
            <span>{fmt(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}