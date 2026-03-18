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
  const [result, setResult] = useState<{ id?: string; invoiceNumber: string; tokenNumber?: string; paymentStatus: string; whatsappSent: boolean } | null>(null);
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
        id: d.order?.id || '',
        invoiceNumber: d.order?.invoiceNumber || d.invoiceNumber || '',
        tokenNumber: d.tokenNumber,
        paymentStatus: d.paymentStatus || pay,
        whatsappSent: d.whatsappSent || false,
      });
      setStep('done');
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed to place order'); }
    finally { setPlacing(false); }
  };

  // ── DESIGN SYSTEM (Light Theme) ──────────────────────────────────────────────
  const BG = '#f9fafb';
  const CARD = '#ffffff';
  const BORDER = '#f3f4f6';
  const TEXT_MAIN = '#111827';
  const TEXT_MUTED = '#6b7280';
  const ACCENT = '#10b981';
  const ACCENT_BG = '#ecfdf5';
  
  const inp: any = { background: BG, border: 'none', borderRadius: 16, padding: '16px', color: TEXT_MAIN, fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' as const };
  const COLS = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4'];

  // ── Done screen ──────────────────────────────────────────────
  if (step === 'done' && result) {
    const isPaid = result.paymentStatus === 'PAID';
    const token = result.tokenNumber?.replace(/^0+/, '') || result.invoiceNumber?.replace('ONL-', '').replace(/^0+/, '') || '?';
    
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: '40px 20px', fontFamily: 'system-ui,sans-serif', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' as const, justifyContent: 'center' }}>
        
        {/* Top Section */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {isPaid ? (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, boxShadow: '0 8px 16px rgba(16,185,129,0.1)' }}>✓</div>
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, boxShadow: '0 8px 16px rgba(217,119,6,0.1)' }}>🎫</div>
          )}
          
          <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT_MAIN, margin: '0 0 8px' }}>
            {isPaid ? 'Order Placed Successfully' : 'Please Pay at Counter'}
          </h1>
          <p style={{ color: TEXT_MUTED, fontSize: 15, margin: 0 }}>
            {isPaid ? 'Your food is being prepared' : `Your token number is #${token}`}
          </p>
        </div>

        {/* Order Details Card */}
        <div style={{ background: CARD, borderRadius: 24, padding: 24, boxShadow: '0 4px 30px rgba(0,0,0,0.03)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed ' + BORDER }}>
            <span style={{ color: TEXT_MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Order ID</span>
            <span style={{ color: TEXT_MAIN, fontSize: 14, fontWeight: 700 }}>#{result.invoiceNumber}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {cart.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: TEXT_MAIN, fontWeight: 700 }}>{item.qty}×</span>
                  <span style={{ color: TEXT_MUTED, fontWeight: 500 }}>{item.name}</span>
                </div>
                <span style={{ color: TEXT_MAIN, fontWeight: 700 }}>{fmt(item.sellingPrice * item.qty)}</span>
              </div>
            ))}
          </div>

          <div style={{ margin: '20px 0', borderBottom: '1px solid ' + BORDER }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: TEXT_MAIN, fontWeight: 700, fontSize: 16 }}>Total Amount</span>
            <span style={{ color: ACCENT, fontWeight: 800, fontSize: 18 }}>{fmt(finalTotal)}</span>
          </div>
          
          {table && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid ' + BORDER, textAlign: 'center' as const, color: TEXT_MUTED, fontSize: 14, fontWeight: 600 }}>
              🪑 Delivering to Table {table}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {result?.id && (
            <button onClick={() => window.open((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/menu/order/' + result.id + '/invoice')}
              style={{ background: TEXT_MAIN, color: 'white', border: 'none', padding: 16, borderRadius: 16, fontWeight: 700, fontSize: 15, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              📄 Download Invoice (PDF)
            </button>
          )}
          
          <button onClick={() => { setCart([]); setStep('menu'); setName(''); setPhone(''); setTable(''); setNotes(''); setResult(null); setPointsToRedeem(0); }}
            style={{ background: CARD, color: TEXT_MAIN, border: 'none', padding: 16, borderRadius: 16, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            Order More
          </button>
        </div>

        {/* Bottom Note */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ color: TEXT_MUTED, fontSize: 13, fontWeight: 500 }}>Thank you for ordering ❤️</p>
        </div>
      </div>
    );
  }

  // ── Info / checkout step ───────────────────────────────────────
  if (step === 'info') return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui,sans-serif', paddingBottom: 110, maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', background: BG, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => setStep('menu')} style={{ background: CARD, border: 'none', width: 44, height: 44, borderRadius: 22, fontSize: 20, cursor: 'pointer', color: TEXT_MAIN, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>←</button>
        <div style={{ fontWeight: 800, fontSize: 20, color: TEXT_MAIN }}>Checkout</div>
      </div>

      <div style={{ padding: '0 20px' }}>
        
        {/* Order summary */}
        <div style={{ background: CARD, borderRadius: 24, padding: 20, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16 }}>Your Order</div>
          
          {cart.map((item, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_MAIN, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ color: ACCENT, fontWeight: 700, fontSize: 14 }}>{fmt(item.sellingPrice * item.qty)}</div>
                </div>
                
                {/* Minimal Counter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: BG, borderRadius: 24, padding: '6px 12px' }}>
                  <button onClick={() => dec(item.id)} style={{ background: 'none', border: 'none', color: TEXT_MAIN, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>−</button>
                  <span style={{ color: TEXT_MAIN, fontWeight: 800, minWidth: 16, textAlign: 'center' as const, fontSize: 14 }}>{item.qty}</span>
                  <button onClick={() => inc(item.id)} style={{ background: 'none', border: 'none', color: TEXT_MAIN, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>+</button>
                </div>
              </div>

              {/* Note input */}
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setNoteFor(noteFor === item.id ? null : item.id)} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  {noteFor === item.id ? '▲ Hide note' : '+ Add note'}
                </button>
                {noteFor === item.id && <input value={item.note} onChange={e => setNote(item.id, e.target.value)} placeholder="e.g. less spice, extra hot..." style={{ ...inp, marginTop: 8, padding: '12px 16px', fontSize: 13 }} />}
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid ' + BORDER, marginTop: 16, paddingTop: 16 }}>
            {tax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: TEXT_MUTED, marginBottom: 8, fontWeight: 500 }}><span>Taxes</span><span>{fmt(Math.round(tax))}</span></div>}
            {pointsDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#f59e0b', marginBottom: 8, fontWeight: 600 }}><span>Points Discount</span><span>-{fmt(pointsDiscount)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, color: TEXT_MAIN, marginTop: 4 }}><span>Total</span><span>{fmt(finalTotal)}</span></div>
          </div>
        </div>

        {/* Loyalty Redemption */}
        {loyaltyPoints >= 100 && (
          <div style={{ background: '#fffbeb', border: 'none', borderRadius: 20, padding: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(245,158,11,0.05)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706', marginBottom: 4 }}>⭐ {loyaltyPoints} Points Available</div>
              <div style={{ fontSize: 12, color: '#b45309', fontWeight: 500 }}>Use points for instant discount</div>
            </div>
            <button onClick={() => setPointsToRedeem(pointsToRedeem > 0 ? 0 : Math.floor(loyaltyPoints / 100) * 100)} 
              style={{ background: pointsToRedeem > 0 ? '#f59e0b' : CARD, color: pointsToRedeem > 0 ? '#fff' : '#d97706', border: 'none', borderRadius: 14, padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              {pointsToRedeem > 0 ? 'Applied' : 'Redeem'}
            </button>
          </div>
        )}

        {/* Your details */}
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>Details</div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12, marginBottom: 24 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your Name *" style={inp} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile Number (optional)" type="tel" style={inp} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
             <input value={table} onChange={e => setTable(e.target.value)} placeholder="Table No." style={inp} />
             <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any requests?" style={inp} />
          </div>
        </div>

        {/* Payment method */}
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>Payment Method</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { v: 'UPI',  icon: '💳', l: 'Pay Online', s: 'UPI / Cards' },
            { v: 'CASH', icon: '💵', l: 'Pay at Counter', s: 'Cash' },
          ].map(m => (
            <button key={m.v} onClick={() => setPay(m.v as any)}
              style={{ background: pay === m.v ? TEXT_MAIN : CARD, border: 'none', borderRadius: 20, padding: '16px', cursor: 'pointer', textAlign: 'left' as const, boxShadow: pay === m.v ? '0 8px 16px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.03)', transition: 'all 0.2s' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: pay === m.v ? 'white' : TEXT_MAIN }}>{m.l}</div>
              <div style={{ fontSize: 11, color: pay === m.v ? '#9ca3af' : TEXT_MUTED, marginTop: 4, fontWeight: 500 }}>{m.s}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Fixed Checkout Bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', padding: '16px 20px', background: 'rgba(249, 250, 251, 0.9)', backdropFilter: 'blur(10px)', boxSizing: 'border-box' as const }}>
        <button onClick={placeOrder} disabled={placing || !name.trim()}
          style={{ width: '100%', background: name.trim() ? TEXT_MAIN : '#d1d5db', border: 'none', color: 'white', padding: '18px', borderRadius: 16, fontWeight: 800, fontSize: 16, cursor: name.trim() ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, boxShadow: name.trim() ? '0 8px 20px rgba(0,0,0,0.15)' : 'none' }}>
          {placing ? 'Processing...' : `Confirm Order — ${fmt(finalTotal)}`}
        </button>
      </div>
    </div>
  );

  // ── Menu browsing ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui,sans-serif', paddingBottom: count > 0 ? 100 : 20, maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      
      {/* Sticky Header */}
      <div style={{ background: 'rgba(249, 250, 251, 0.9)', backdropFilter: 'blur(10px)', padding: '24px 20px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: ACCENT_BG, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 10px rgba(16,185,129,0.1)' }}>☕</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: TEXT_MAIN, margin: '0 0 2px' }}>{shopName}</h1>
            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, fontWeight: 500 }}>Scan · Order · Enjoy</p>
          </div>
        </div>
        
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for dishes..." style={{ ...inp, paddingLeft: 42, background: CARD, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }} />
        </div>
      </div>

      {cats.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '0 20px 16px', overflowX: 'auto' as const, scrollbarWidth: 'none' as const }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} 
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 20, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: cat === c ? TEXT_MAIN : CARD, color: cat === c ? 'white' : TEXT_MUTED, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Product Grid */}
      <div style={{ padding: '0 20px' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60, color: TEXT_MUTED, fontWeight: 600 }}>Loading menu...</div> :
         filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 60, color: TEXT_MUTED, fontWeight: 600 }}>No items found</div> : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
            {filtered.map((p, idx) => {
              const inCart = cart.find(i => i.id === p.id);
              const col = COLS[idx % COLS.length];
              
              return (
                <div key={p.id} style={{ background: CARD, borderRadius: 24, padding: 16, display: 'flex', gap: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  
                  {/* Info Column */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, justifyContent: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: TEXT_MAIN, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: TEXT_MAIN, marginBottom: p.description ? 8 : 12 }}>{fmt(p.sellingPrice)}</div>
                    {p.description && <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.4, marginBottom: 12, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>{p.description}</div>}
                    
                    {/* Add Button */}
                    <div>
                      {inCart ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: BG, borderRadius: 20, padding: '6px 12px' }}>
                          <button onClick={() => dec(p.id)} style={{ background: 'none', border: 'none', color: TEXT_MAIN, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>−</button>
                          <span style={{ color: TEXT_MAIN, fontWeight: 800, fontSize: 14, minWidth: 16, textAlign: 'center' as const }}>{inCart.qty}</span>
                          <button onClick={() => inc(p.id)} style={{ background: 'none', border: 'none', color: TEXT_MAIN, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(p)} style={{ background: ACCENT_BG, border: 'none', color: ACCENT, padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          + Add
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Image Column */}
                  <div style={{ width: 110, height: 110, borderRadius: 16, background: p.imageUrl ? 'transparent' : `${col}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {p.imageUrl ? 
                      <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' as const }} /> : 
                      <span style={{ fontSize: 32, fontWeight: 900, color: col }}>{p.name[0].toUpperCase()}</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating View Cart Button */}
      {count > 0 && (
        <div style={{ position: 'fixed', bottom: 20, left: 0, right: 0, maxWidth: 480, margin: '0 auto', padding: '0 20px', zIndex: 50, boxSizing: 'border-box' as const }}>
          <button onClick={() => setStep('info')} style={{ width: '100%', background: TEXT_MAIN, border: 'none', color: 'white', padding: '16px 20px', borderRadius: 20, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 10px', fontSize: 13 }}>{count} items</span>
            <span>View Order</span>
            <span>{fmt(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}