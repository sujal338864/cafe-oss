'use client';
import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import { getOptimizedImage } from '@/lib/cloudinary';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');
const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#7c3aed'];

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank' },
  { value: 'CREDIT', label: 'Credit' },
];

type CartItem = { id: string; name: string; sellingPrice: number; costPrice: number; taxRate: number; qty: number; stock: number; };
type Receipt = { id: string; invoiceNumber: string; items: CartItem[]; subtotal: number; taxAmount: number; discountAmount: number; total: number; method: string; customer: { id: string; name: string; phone?: string; loyaltyPoints?: number } | null; date: string; pointsEarned?: number; };

type CustomerInfo = { id: string; name: string; phone: string; loyaltyPoints: number; totalPurchases: number; };
type PendingOrder = { id: string; invoiceNumber: string; createdAt: string; totalAmount: number; notes: string; customer: { name: string; phone: string } | null; items: { name: string; quantity: number; }[]; };

type Tab = 'pos' | 'pending';

export default function POSPage() {
  const { theme } = useTheme();
  const { socket } = useSocket();
  const [tab, setTab] = useState<Tab>('pos');
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('CASH');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [waSending, setWaSending] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [shop, setShop] = useState<any>(null);

  // Phone-first customer lookup
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneLooking, setPhoneLooking] = useState(false);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [custStatus, setCustStatus] = useState<'idle' | 'found' | 'new' | 'walkin'>('idle');
  const [newCustName, setNewCustName] = useState('');
  const [custSaving, setCustSaving] = useState(false);
  const [custErr, setCustErr] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);

  // Pending (Pay at Counter) orders
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadProducts(); loadShop(); }, []);
  useEffect(() => { if (tab === 'pending') loadPending(); }, [tab]);

  // WebSocket: instant pending order updates instead of 30s polling (saves ~0.8GB/month)
  useEffect(() => {
    if (!socket) return;
    const refresh = () => { if (tab === 'pending') loadPending(); };
    socket.on('ORDER_CREATED', refresh);
    socket.on('ORDER_UPDATED', refresh);
    return () => { socket.off('ORDER_CREATED', refresh); socket.off('ORDER_UPDATED', refresh); };
  }, [socket, tab]);

  const loadProducts = async () => {
    try {
      const pRes = await api.get('/api/products?limit=50');
      setProducts(pRes.data.products || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadShop = async () => {
    try {
      const res = await api.get('/api/shop/profile');
      setShop(res.data);
    } catch (e) { console.error('Failed to load shop profile'); }
  };

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      // Fetch UNPAID scanner-menu orders (invoiceNumber starts with ONL-)
      const res = await api.get('/api/orders?paymentStatus=UNPAID&limit=50');
      const orders = (res.data.orders || []).filter((o: any) => o.invoiceNumber?.startsWith('ONL-'));
      setPendingOrders(orders);
    } catch (e) { console.error(e); }
    finally { setPendingLoading(false); }
  };

  const lookupPhone = async (phone: string) => {
    if (phone.replace(/\D/g, '').length < 10) return;
    setPhoneLooking(true);
    setCustErr('');
    try {
      const res = await api.get(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
      if (res.data.found) {
        setCustomer(res.data.customer);
        setCustStatus('found');
      }
    } catch (e: any) {
      if (e.response?.status === 404) {
        setCustomer(null);
        setCustStatus('new');
      }
    } finally { setPhoneLooking(false); }
  };

  const registerCustomer = async () => {
    if (!newCustName.trim()) { setCustErr('Name is required'); return; }
    setCustSaving(true); setCustErr('');
    try {
      const { data } = await api.post('/api/customers', {
        name: newCustName.trim(),
        phone: phoneInput.trim(),
      });
      const c = data.customer || data;
      setCustomer({ id: c.id, name: c.name, phone: c.phone, loyaltyPoints: c.loyaltyPoints || 0, totalPurchases: c.totalPurchases || 0 });
      setCustStatus('found');
      setNewCustName('');
    } catch (e: any) {
      setCustErr(e.response?.data?.error || 'Failed to register customer');
    } finally { setCustSaving(false); }
  };

  const clearCustomer = () => {
    setPhoneInput(''); setCustomer(null); setCustStatus('idle');
    setNewCustName(''); setCustErr(''); setRedeemPoints(false);
  };

  const addToCart = (p: any) => setCart(c => {
    const ex = c.find(i => i.id === p.id);
    if (ex) return c.map(i => i.id === p.id ? { ...i, qty: Math.min(i.qty + 1, i.stock) } : i);
    return [...c, { id: p.id, name: p.name, sellingPrice: Number(p.sellingPrice), costPrice: Number(p.costPrice || 0), taxRate: Number(p.taxRate || 0), qty: 1, stock: p.stock }];
  });
  const dec = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0));
  const inc = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.min(i.qty + 1, i.stock) } : i));

  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
  const taxAmount = cart.reduce((s, i) => s + (i.sellingPrice * i.qty) * (i.taxRate / 100), 0);
  const discountAmt = Math.min(discount, subtotal + taxAmount);

  // Loyalty redemption: 100 pts = Rs.10
  const REDEEM_RATE = 10;
  const maxRedeemable = customer ? Math.floor(customer.loyaltyPoints / 100) * REDEEM_RATE : 0;
  const pointsDiscount = redeemPoints && customer ? maxRedeemable : 0;
  const pointsToRedeem = redeemPoints && customer ? Math.floor(maxRedeemable / REDEEM_RATE) * 100 : 0;
  const total = Math.max(0, subtotal + taxAmount - discountAmt - pointsDiscount);

  const checkout = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/orders', {
        customerId: customer?.id,
        paymentMethod: method,
        paymentStatus: 'PAID',
        discountAmount: discountAmt,
        redeemPoints: pointsToRedeem,
        items: cart.map(i => ({
          productId: i.id,
          name: i.name,
          quantity: i.qty,
          costPrice: i.costPrice,
          unitPrice: i.sellingPrice,
          taxRate: i.taxRate,
          discount: 0,
        })),
      });

      const order = data.order || data;
      setReceipt({
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        items: [...cart],
        subtotal,
        taxAmount: Math.round(taxAmount),
        discountAmount: discountAmt + pointsDiscount,
        total: Number(order.totalAmount ?? total),
        method,
        customer: customer ? { ...customer, loyaltyPoints: (customer.loyaltyPoints ?? 0) + (data.pointsEarned ?? 0) - pointsToRedeem } : null,
        date: new Date().toISOString(),
        pointsEarned: data.pointsEarned,
      });
      setWaSent(false);
      setCart([]); clearCustomer(); setDiscount(0);
      loadProducts();
    } catch (e: any) {
      const details = e.response?.data?.details;
      const errMsg = details
        ? details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join('\n')
        : (e.response?.data?.error || 'Checkout failed');
      alert('Error: ' + errMsg);
    } finally { setSubmitting(false); }
  };

  const sendWhatsApp = async () => {
    if (!receipt?.id || !receipt.customer?.phone) return;
    setWaSending(true);
    try {
      await api.post(`/api/orders/${receipt.id}/whatsapp`);
      setWaSent(true);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to send WhatsApp');
    } finally { setWaSending(false); }
  };

  const markPaid = async (orderId: string) => {
    setMarkingPaid(orderId);
    try {
      await api.put(`/api/orders/${orderId}/payment`, { paymentStatus: 'PAID' });
      loadPending();
      // Auto-open invoice for printing
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const url = API + `/api/menu/order/${orderId}/invoice`;
      window.open(url, '_blank');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to mark paid');
    } finally { setMarkingPaid(null); }
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

      {/* Loyalty points earned */}
      {receipt.pointsEarned && receipt.pointsEarned > 0 && (
        <div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
          <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13 }}>⭐ +{receipt.pointsEarned} points earned · Balance: {receipt.customer?.loyaltyPoints ?? 0} pts</span>
        </div>
      )}

      {/* Printable bill */}
      <div style={{ background: '#fff', color: '#000', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 22px', width: '100%', maxWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
        <div ref={receiptRef}>
          <div className="shop" style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', fontFamily: 'Courier New, monospace' }}>{shop?.name || 'Cafe OS'}</div>
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
            {receipt.pointsEarned && receipt.pointsEarned > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#6d28d9' }}>⭐ +{receipt.pointsEarned} loyalty points earned</div>
            )}
          </div>
          <div style={{ borderTop: '1px dashed #999', margin: '6px 0', fontFamily: 'monospace' }} />
          <div style={{ textAlign: 'center', fontSize: 11, color: '#555', fontFamily: 'Courier New, monospace' }}>Thank you! Please visit again.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={printBill}
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🖨️ Print Bill
        </button>
        {receipt.customer?.phone && (
          <button onClick={sendWhatsApp} disabled={waSending || waSent}
            style={{ background: waSent ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: waSent ? 'default' : 'pointer', opacity: waSending ? 0.7 : 1 }}>
            {waSent ? '✅ Sent!' : waSending ? 'Sending...' : '📲 Send on WhatsApp'}
          </button>
        )}
        <button onClick={() => setReceipt(null)}
          style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '12px 20px', borderRadius: 11, fontWeight: 600, cursor: 'pointer' }}>
          New Sale
        </button>
      </div>
    </div>
  );

  // ── Pending Orders tab ─────────────────────────────────────────
  if (tab === 'pending') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('pos')} style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>
            ← Back to POS
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0, lineHeight: '36px' }}>
            Pending Orders {pendingOrders.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 20, padding: '2px 8px', fontSize: 12, marginLeft: 6 }}>{pendingOrders.length}</span>}
          </h2>
        </div>
        <button onClick={loadPending} disabled={pendingLoading}
          style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '8px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 12 }}>
          {pendingLoading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {pendingLoading && pendingOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: theme.textFaint }}>Loading pending orders...</div>
      ) : pendingOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: theme.textFaint }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No pending orders</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>All scanner orders have been processed</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingOrders.map(order => {
            const token = order.invoiceNumber.replace('ONL-', '').replace(/^0+/, '') || '1';
            const elapsed = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);
            return (
              <div key={order.id} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
                {/* Token badge */}
                <div style={{ width: 64, height: 64, borderRadius: 14, background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>Token</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1 }}>#{token}</div>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{order.customer?.name || 'Walk-in'}</div>
                  {order.customer?.phone && <div style={{ fontSize: 12, color: theme.textFaint }}>📱 {order.customer.phone}</div>}
                  <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 2 }}>
                    {order.items?.slice(0, 3).map((i: any) => `${i.name} ×${i.quantity}`).join(' · ')}
                    {order.items?.length > 3 && ` +${order.items.length - 3} more`}
                  </div>
                  <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>⏱ {elapsed} min ago</div>
                </div>
                {/* Amount + action */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 8 }}>{fmt(order.totalAmount)}</div>
                  <button onClick={() => markPaid(order.id)} disabled={markingPaid === order.id}
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: markingPaid === order.id ? 0.7 : 1 }}>
                    {markingPaid === order.id ? 'Marking...' : '✅ Mark Paid'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Main POS ─────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 108px)' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[{ id: 'pos', label: '🛒 New Sale' }, { id: 'pending', label: `⏳ Pay at Counter${pendingOrders.length ? ` (${pendingOrders.length})` : ''}` }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id as Tab); if (t.id === 'pending') loadPending(); }}
            style={{
              padding: '8px 18px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: tab === t.id ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : theme.hover,
              color: tab === t.id ? 'white' : theme.textMuted
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: 16, flex: 1, overflow: 'hidden' }}>
        {/* Products panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.card, padding: '10px 16px', borderRadius: 12, border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.text, margin: 0 }}>Sale</h2>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search products..."
                style={{ ...inp, width: 200, padding: '7px 12px' }} />
            </div>

            {/* Customer Lookup moved to Top Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end', maxWidth: 600 }}>
              {custStatus === 'idle' && (
                <div style={{ position: 'relative', width: 220 }}>
                  <input
                    value={phoneInput}
                    onChange={e => {
                      setPhoneInput(e.target.value);
                      if (e.target.value.replace(/\D/g, '').length >= 10) lookupPhone(e.target.value);
                      if (e.target.value === '') { setCustomer(null); setCustStatus('idle'); }
                    }}
                    placeholder="📱 Customer Phone..."
                    type="tel"
                    style={{ ...inp, padding: '7px 12px' }}
                  />
                  {phoneLooking && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: theme.textFaint }}>...</span>}
                </div>
              )}

              {custStatus === 'found' && customer && (
                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{customer.name} ({customer.loyaltyPoints} pts)</div>
                  <button onClick={clearCustomer} style={{ background: 'none', border: 'none', color: theme.textFaint, cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              )}

              {custStatus === 'new' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#f59e0b' }}>New: {phoneInput}</span>
                  <input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Name"
                    style={{ ...inp, width: 120, padding: '6px 10px', fontSize: 12 }} />
                  <button onClick={registerCustomer} disabled={custSaving}
                    style={{ background: '#f59e0b', border: 'none', color: 'white', padding: '6px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    {custSaving ? '...' : 'Add'}
                  </button>
                  <button onClick={() => setCustStatus('walkin')} style={{ background: 'none', border: 'none', color: theme.textFaint, fontSize: 11, cursor: 'pointer' }}>Skip</button>
                </div>
              )}

              {custStatus === 'walkin' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>👤 Walk-in</span>
                  <button onClick={clearCustomer} style={{ background: 'none', border: 'none', color: theme.textFaint, cursor: 'pointer', fontSize: 11 }}>Change</button>
                </div>
              )}
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textFaint }}>Loading products...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, overflow: 'auto', paddingBottom: 8 }}>
              {filtered.map((p: any, idx: number) => {
                const isOutOfStock = p.stock <= 0;
                const isNotAvailable = p.isAvailable === false;
                const isLocked = isOutOfStock || isNotAvailable;

                return (
                  <div key={p.id} onClick={() => !isLocked && addToCart(p)}
                    style={{
                      background: theme.card,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 12, padding: 14,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      transition: 'border-color .15s',
                      opacity: isLocked ? 0.6 : 1
                    }}
                    onMouseEnter={e => { if (!isLocked) (e.currentTarget as HTMLElement).style.borderColor = '#7c3aed'; }}
                    onMouseLeave={e => { if (!isLocked) (e.currentTarget as HTMLElement).style.borderColor = theme.border; }}>
                    <div style={{ width: '100%', aspectRatio: '1', background: COLORS[idx % COLORS.length] + '22', border: '1px solid ' + COLORS[idx % COLORS.length] + '44', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' }}>
                      {p.imageUrl
                        ? <img src={getOptimizedImage(p.imageUrl, 200) || ''} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9 }} />
                        : <span style={{ fontSize: 28, fontWeight: 900, color: COLORS[idx % COLORS.length] }}>{p.name[0].toUpperCase()}</span>
                      }
                      {isLocked && (
                        <div style={{ position: 'absolute', background: 'rgba(0,0,0,0.4)', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: 'white', fontWeight: 800, fontSize: 11, padding: '4px 8px', background: isNotAvailable ? '#dc2626' : '#ef4444', borderRadius: 5 }}>
                            {isNotAvailable ? 'UNAVAILABLE' : 'OUT OF STOCK'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, lineHeight: 1.3, color: theme.text }}>{p.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#a78bfa', fontWeight: 800, fontSize: 14 }}>{fmt(p.sellingPrice)}</span>
                      {isLocked ? (
                        <span style={{ background: isNotAvailable ? 'rgba(220,38,38,.15)' : 'rgba(239,68,68,.15)', color: isNotAvailable ? '#dc2626' : '#ef4444', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800 }}>
                          {isNotAvailable ? 'Unavailable' : 'Sold Out'}
                        </span>
                      ) : (
                        <span style={{ background: p.stock <= (p.lowStockAlert || 5) ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)', color: p.stock <= (p.lowStockAlert || 5) ? '#ef4444' : '#10b981', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.stock}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div style={{ gridColumn: 'span 3', padding: 36, textAlign: 'center', color: theme.textFaint }}>No products found.</div>}
            </div>
          )}
        </div>

        {/* Cart panel */}
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '6px 14px', borderBottom: `1px solid ${theme.border}`, fontWeight: 800, fontSize: 13, color: theme.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Current Bill</span>
            {cart.length > 0 && <span style={{ color: '#a78bfa', fontWeight: 600, fontSize: 11 }}>{cart.length} items</span>}
          </div>

          {/* Cart items - Extra Compact View */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
                <div style={{ fontSize: 13 }}>Cart is empty</div>
              </div>
            ) : cart.map(item => (
              <div key={item.id} style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ flex: 1 }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: theme.textFaint, fontWeight: 400 }}>{fmt(item.sellingPrice)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: 6, overflow: 'hidden' }}>
                    <button onClick={() => dec(item.id)} style={{ background: theme.hover, border: 'none', color: theme.text, cursor: 'pointer', fontSize: 14, width: 24, height: 24 }}>−</button>
                    <span style={{ fontWeight: 800, fontSize: 12, minWidth: 20, textAlign: 'center', color: theme.text, background: theme.card }}>{item.qty}</span>
                    <button onClick={() => inc(item.id)} style={{ background: theme.hover, border: 'none', color: theme.text, cursor: 'pointer', fontSize: 14, width: 24, height: 24 }}>+</button>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: theme.text, minWidth: 70, textAlign: 'right' }}>{fmt(item.sellingPrice * item.qty)}</span>
                </div>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>

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
                  placeholder="0" style={inp} />
              </div>

              {/* Loyalty points redemption */}
              {customer && customer.loyaltyPoints >= 100 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 9, padding: '8px 12px' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>⭐ {customer.loyaltyPoints} points available</div>
                    <div style={{ fontSize: 11, color: theme.textFaint }}>Redeem {pointsToRedeem} pts = Rs.{maxRedeemable} off</div>
                  </div>
                  <button onClick={() => setRedeemPoints(r => !r)}
                    style={{ background: redeemPoints ? '#7c3aed' : theme.hover, border: `1px solid ${redeemPoints ? '#7c3aed' : theme.border}`, color: redeemPoints ? 'white' : theme.textMuted, padding: '5px 12px', borderRadius: 7, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                    {redeemPoints ? 'Applied ✓' : 'Redeem'}
                  </button>
                </div>
              )}

              {/* Totals */}
              <div style={{ fontSize: 12, color: theme.textFaint }}>
                {[
                  ['Subtotal', fmt(subtotal)],
                  taxAmount > 0 ? ['Tax', fmt(Math.round(taxAmount))] : null,
                  discountAmt > 0 ? ['Discount', `- ${fmt(discountAmt)}`] : null,
                  pointsDiscount > 0 ? ['Points Redeem', `- ${fmt(pointsDiscount)}`] : null,
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
      </div>
    </div>
  );
}
