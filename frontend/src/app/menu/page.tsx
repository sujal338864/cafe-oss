'use client';
import { useEffect, useState, Suspense, useRef, memo, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShoppingCart, Plus, Minus, ArrowLeft, Check, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { getOptimizedImage } from '@/lib/cloudinary';

type Product = { id: string; name: string; sellingPrice: number; description?: string; imageUrl?: string; categoryId?: string; stock: number; taxRate: number; originalPrice?: number; discountedPrice?: number; activeRule?: string | null; isAvailable?: boolean; };
type Category = { id: string; name: string; color?: string };
type CartItem = Product & { qty: number; note: string };

const fmt = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm animate-pulse">
      <div className="w-full aspect-[4/3] bg-slate-200" />
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-200 rounded w-1/2 mb-4" />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="h-5 bg-slate-200 rounded w-1/3" />
          <div className="h-8 w-8 bg-slate-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ─── Product Card (memoized) ─── */
const ProductItem = memo(function ProductItem({ p, inCart, onAdd, onInc, onDec }: {
  p: Product; inCart?: CartItem; onAdd: () => void; onInc: () => void; onDec: () => void;
}) {
  const outOfStock = p.stock <= 0;
  const isAvailable = p.isAvailable !== false;
  const isLocked = outOfStock || !isAvailable;

  return (
    <div className={`group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 relative ${isLocked ? 'opacity-50 grayscale' : ''}`}>
      {/* Thumbnail */}
      <div className="w-full aspect-[4/3] relative overflow-hidden bg-slate-50 flex items-center justify-center">
        {p.imageUrl
          ? <img src={getOptimizedImage(p.imageUrl, 400) || ''} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <span className="text-4xl font-bold text-slate-200">{p.name[0]}</span>
        }
        {p.activeRule && (
          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide flex items-center gap-1 shadow-sm">
            <Sparkles size={10} /> {p.activeRule}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <div className="font-semibold text-sm text-slate-800 leading-tight mb-1 line-clamp-1">{p.name}</div>
        {p.description && <div className="text-xs text-slate-500 line-clamp-2 leading-snug mb-3 flex-1">{p.description}</div>}
        
        <div className="mt-auto pt-2 flex items-center justify-between border-t border-slate-50/50">
          <div className="flex flex-col">
            <div className={`font-bold text-sm ${p.activeRule ? 'text-emerald-600' : 'text-slate-900'}`}>
              {fmt(p.discountedPrice || p.sellingPrice)}
            </div>
            {p.activeRule && (
              <div className="text-[10px] text-slate-400 line-through -mt-0.5">{fmt(p.originalPrice || p.sellingPrice)}</div>
            )}
          </div>

          <div className="flex items-center">
            {isLocked ? (
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-tight ${!isAvailable ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                {!isAvailable ? 'Unavailable' : 'Sold out'}
              </span>
            ) : inCart ? (
              <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg overflow-hidden shadow-sm">
                <button onClick={onDec} className="w-7 h-8 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-95"><Minus size={14} strokeWidth={3} /></button>
                <span className="w-6 text-center font-bold text-xs text-emerald-800">{inCart.qty}</span>
                <button onClick={onInc} className="w-7 h-8 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-95"><Plus size={14} strokeWidth={3} /></button>
              </div>
            ) : (
              <button onClick={onAdd} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200 active:scale-95 shadow-sm">
                <Plus size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── Recommendations Row ─── */
const RecommendationRow = ({ items, onAdd }: { items: Product[], onAdd: (p: Product) => void }) => {
  if (!items.length) return null;
  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 mb-3 ml-1">
        <Sparkles size={16} /> Chef Recommended
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
        {items.map(p => (
          <div key={p.id} className="snap-start shrink-0 w-[140px] bg-white rounded-2xl border border-slate-100 p-2 shadow-sm relative group hover:shadow-md transition-shadow">
            <div className="w-full h-20 rounded-xl bg-slate-50 mb-2 overflow-hidden flex items-center justify-center">
              {p.imageUrl ? (
                <img src={getOptimizedImage(p.imageUrl, 280) || ''} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <span className="text-2xl font-bold text-slate-200">{p.name[0]}</span>
              )}
            </div>
            <div className="font-bold text-xs text-slate-800 leading-tight h-7 overflow-hidden mb-1">{p.name}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-bold text-[13px] text-slate-900">{fmt(p.sellingPrice)}</span>
              <button onClick={() => onAdd(p)} className="w-7 h-7 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors active:scale-95 border border-emerald-100 hover:border-transparent">
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function MenuPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Loading...</div>}>
      <MenuContent />
    </Suspense>
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
  const [error, setError] = useState(false);
  const [step, setStep] = useState<'menu' | 'cart' | 'info' | 'done'>('menu');
  const queryClient = useQueryClient();

  // 1. RECOMMENDATIONS
  const { data: recData } = useQuery({
    queryKey: ['menu_recommendations', shopId],
    queryFn: () => get(`/api/menu/recommendations?shopId=${shopId}`).then(d => d.recommendations),
    enabled: !!shopId && (step === 'cart' || step === 'info'),
    staleTime: 300000 // 5 min
  });
  const recommendations = recData || [];

  // 2. MAIN MENU DATA
  const { data: menuData, isLoading: loading } = useQuery({
    queryKey: ['menu_data', shopId],
    queryFn: async () => {
      // Clear any stale localStorage cache
      localStorage.removeItem(`menu_cache_${shopId}`);
      const data = await get(`/api/menu?shopId=${shopId}&fresh=true`);
      console.log('[MENU DEBUG] API response:', data?.products?.length, 'products');
      return data;
    },
    enabled: !!shopId,
    staleTime: 60000, // 1 min
  });

  const [shopName, setShopName] = useState('Our Menu');
  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [activePromo, setActivePromo] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [table, setTable] = useState('');
  const [notes, setNotes] = useState('');
  const [pay, setPay] = useState<'UPI' | 'CASH'>('UPI');
  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{ id?: string; invoiceNumber: string; tokenNumber?: string; paymentStatus: string; status: string; whatsappSent: boolean } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loyaltyRate, setLoyaltyRate] = useState(0.1);
  const [redeemRate, setRedeemRate] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestError, setLatestError] = useState<string | null>(null);
  const isDebug = searchParams.get('debug') === '1';

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

  const refreshStatus = useCallback(async () => {
    if (!result?.id) return;
    setIsRefreshing(true);
    try {
      const d = await get(`/api/menu/order/${result.id}/status?_t=${Date.now()}`);
      setResult(r => r ? { ...r, paymentStatus: d.paymentStatus || r.paymentStatus, status: d.status || r.status } : r);
    } catch { }
    setTimeout(() => setIsRefreshing(false), 800);
  }, [result?.id]);

  useEffect(() => {
    if (step !== 'done' || !result?.id) return;
    const isDone = result.status === 'COMPLETED' && result.paymentStatus === 'PAID';
    if (isDone) return;
    const interval = setInterval(async () => {
      try {
        const d = await get(`/api/menu/order/${result.id}/status?_t=${Date.now()}`);
        if (d.status === 'COMPLETED' && d.paymentStatus === 'PAID') {
          setResult(r => r ? { ...r, paymentStatus: 'PAID', status: 'COMPLETED' } : r);
          clearInterval(interval);
        } else {
          setResult(r => r ? { ...r, paymentStatus: d.paymentStatus || r.paymentStatus, status: d.status || r.status } : r);
        }
      } catch { }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, result?.id, result?.paymentStatus, result?.status]);

  useEffect(() => {
    if (menuData) {
      setProducts(menuData.products || []);
      setAllCategories(menuData.categories || []);
      setShopName(menuData.shop?.name || 'Our Menu');
      setPricingEnabled(!!menuData.shop?.pricingEnabled);
      if (menuData.loyaltyRate) setLoyaltyRate(menuData.loyaltyRate);
      if (menuData.redeemRate) setRedeemRate(menuData.redeemRate);
      const firstActive = (menuData.products || []).find((p: Product) => p.activeRule);
      if (firstActive) setActivePromo(firstActive.activeRule);
    }
  }, [menuData]);

  useEffect(() => {
    const t = searchParams.get('table') || searchParams.get('tableNumber') || searchParams.get('t');
    if (t) setTable(t);
  }, [searchParams]);

  const lookupCustomer = async (digits: string) => {
    try {
      setLatestError(null);
      const data = await get(`/api/menu/customer?phone=${digits}&shopId=${shopId}`);
      if (data.loyaltyPoints) setLoyaltyPoints(data.loyaltyPoints);
      if (data.name && !name.trim()) setName(data.name);
      if (!data.name) setLatestError('No customer found for this number');
    } catch (err: any) {
      setLatestError(err.message || 'Connection failed');
      console.error('[MENU] Customer lookup error:', err);
    }
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
  const tax = cart.reduce((s, i) => s + (i.sellingPrice * i.qty) * ((i.taxRate || 0) / 100), 0);
  const REDEEM_RATE = redeemRate || 10;
  const total = subtotal + tax;
  const pointsDiscount = (pointsToRedeem / REDEEM_RATE) || 0;
  const finalTotal = Math.max(0, total - pointsDiscount);
  const pointsEarned = Math.floor(finalTotal * loyaltyRate);

  const cats = useMemo(() => ['All', ...allCategories.map(c => c.name)], [allCategories]);
  const catMap = useMemo(() => Object.fromEntries(allCategories.map(c => [c.id, c.name])), [allCategories]);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const filtered = useMemo(() => products.filter(p => (cat === 'All' || catMap[p.categoryId || ''] === cat) && p.name.toLowerCase().includes(debouncedSearch.toLowerCase())), [products, cat, catMap, debouncedSearch]);

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
        tokenNumber: d.tokenNumber, paymentStatus: d.paymentStatus || pay, status: d.order?.status || 'PENDING', whatsappSent: d.whatsappSent || false,
      });
      setStep('done');
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed to place order'); }
    finally { setPlacing(false); }
  };

  if (!shopId) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-sans font-medium">Invalid menu link</div>;

  /* ═══════ DONE SCREEN ═══════ */
  if (step === 'done' && result) {
    const isPaid = result.paymentStatus === 'PAID';
    const token = result.tokenNumber?.replace(/^0+/, '') || result.invoiceNumber?.replace('ONL-', '').replace(/^0+/, '') || '?';
    const orderStatus = result.status || 'PENDING';
    const stages = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'];
    const stageLabels = ['✓ Confirmed', '🔥 Preparing', '✅ Ready', '🎉 Done'];
    const currentStage = stages.indexOf(orderStatus);
    const isKitchenActive = currentStage >= 0;
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center animate-slide-up">

          {/* Live Order Status Tracker */}
          {isKitchenActive && (
            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-center gap-2 mb-4">
                {stages.map((s, i) => {
                  const done = i <= currentStage;
                  const active = i === currentStage;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                        active ? 'w-10 h-10 bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.2)] font-bold' : 
                        done ? 'w-8 h-8 bg-emerald-500 text-white font-bold' : 
                        'w-8 h-8 bg-slate-200 text-slate-400 font-bold'
                      }`}>
                        {done && (!active || i === stages.length - 1) ? <Check size={16} strokeWidth={3} /> : i + 1}
                      </div>
                      {i < stages.length - 1 && (
                        <div className={`w-8 h-1 rounded-full transition-all duration-300 ${i < currentStage ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-emerald-600 font-bold text-sm tracking-wide uppercase mb-1">{stageLabels[currentStage]}</div>
              {currentStage < stages.length - 1 && (
                <div className="flex flex-col items-center gap-3 mt-2">
                  <div className="text-[11px] text-slate-400 font-medium">Auto-updating...</div>
                  <button onClick={refreshStatus} disabled={isRefreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition-all shadow-sm">
                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
                  </button>
                </div>
              )}
            </div>
          )}

          {isPaid ? (
            <>
              <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                <Check size={40} strokeWidth={3} />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-1">Order Confirmed!</h1>
              <p className="text-slate-500 mb-1 font-medium">Thank you, <b className="text-slate-900">{name}</b></p>
              {result.invoiceNumber && <p className="text-emerald-600 font-bold text-sm mb-6">#{result.invoiceNumber}</p>}
              
              {result.whatsappSent && phone && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-sm text-emerald-800 font-medium flex items-center justify-center gap-2">
                  <span className="text-xl">📲</span> Bill sent to WhatsApp <b>{phone}</b>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
                <span className="text-4xl">🎫</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-1">Order Placed!</h1>
              <p className="text-slate-500 mb-6 font-medium">Please pay at the counter</p>
              
              <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-8 mb-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(251,191,36,0.5)_10px,rgba(251,191,36,0.5)_20px)]" />
                <div className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Your Token</div>
                <div className="text-6xl font-black text-amber-600 leading-none">#{token}</div>
                <div className="text-sm font-medium text-amber-800 mt-4">Show at counter to collect your order</div>
              </div>
            </>
          )}

          <div className="bg-slate-50 rounded-2xl p-5 mb-6 text-left border border-slate-100">
            {cart.map((item, i) => (
              <div key={i} className={`flex justify-between py-2 text-sm ${i < cart.length - 1 ? 'border-b border-slate-200/60' : ''}`}>
                <span className="text-slate-600 font-medium">{item.name} <span className="text-slate-400">×{item.qty}</span></span>
                <span className="font-bold text-slate-900">{fmt(item.sellingPrice * item.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between mt-3 pt-3 border-t-2 border-slate-200 font-black text-lg text-slate-900">
              <span>Total</span>
              <span className="text-emerald-600">{fmt(total)}</span>
            </div>
          </div>

          {result?.id && isPaid && (
            <button onClick={() => window.open(API + '/api/menu/order/' + result.id + '/invoice')}
              className="w-full bg-slate-50 border-2 border-slate-200 text-slate-600 p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mb-4 hover:bg-slate-100 hover:text-slate-900 transition-colors active:scale-95">
              📄 Download Invoice
            </button>
          )}
          
          {table && <p className="text-slate-500 font-medium mb-6">🪑 Table <b className="text-slate-900">{table}</b></p>}
          
          <button onClick={() => { setCart([]); setStep('menu'); setName(''); setPhone(''); setTable(''); setNotes(''); setResult(null); setPointsToRedeem(0); }}
            className="w-full bg-slate-900 border-none text-white p-4 rounded-xl font-bold text-base hover:bg-slate-800 transition-all active:scale-95 shadow-[0_4px_14px_rgba(0,0,0,0.15)]">
            Order More
          </button>
        </div>
      </div>
    );
  }

  /* ═══════ CHECKOUT / INFO SCREEN ═══════ */
  if (step === 'info') return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32 animate-fade-in relative">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => setStep(cart.length > 0 ? 'cart' : 'menu')} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-700 transition-colors active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <div className="font-bold text-lg text-slate-900">Checkout</div>
      </div>
      
      <div className="p-4 max-w-xl mx-auto space-y-6">
        {/* Order Summary */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">Order Summary</div>
          
          <RecommendationRow items={recommendations} onAdd={addToCart} />
          
          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {cart.map((item, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {item.name}
                      {(item.taxRate || 0) > 0 && <span className="ml-2 inline-block text-[10px] text-slate-400 font-medium bg-slate-200/50 px-1 py-0.5 rounded align-middle">+{item.taxRate}% tax</span>}
                    </div>
                    {item.note && <div className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1"><span>📝</span> {item.note}</div>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                      <button onClick={() => dec(item.id)} className="w-6 h-6 flex items-center justify-center text-slate-600 rounded bg-slate-50 hover:bg-slate-100 active:scale-95"><Minus size={14} /></button>
                      <span className="font-bold text-sm w-5 text-center">{item.qty}</span>
                      <button onClick={() => inc(item.id)} className="w-6 h-6 flex items-center justify-center text-emerald-600 rounded bg-emerald-50 hover:bg-emerald-100 active:scale-95"><Plus size={14} /></button>
                    </div>
                    <span className="font-bold text-sm text-slate-900 w-14 text-right">{fmt(item.sellingPrice * item.qty)}</span>
                  </div>
                </div>
                <div className="px-3 mt-1.5">
                  <button onClick={() => setNoteFor(noteFor === item.id ? null : item.id)} className="text-[11px] font-semibold text-slate-400 hover:text-emerald-500 flex items-center gap-1 transition-colors">
                    {noteFor === item.id ? <><Minus size={10} /> Hide note</> : <><Plus size={10} /> Add instruction</>}
                  </button>
                  {noteFor === item.id && (
                     <div className="mt-2 animate-fade-in">
                        <input value={item.note} onChange={e => setNote(item.id, e.target.value)} placeholder="e.g. less spice, no sugar..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400" />
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-sm text-slate-500 mb-1.5 px-1 font-medium"><span>Item Total</span><span>{fmt(subtotal)}</span></div>
            {tax > 0 && <div className="flex justify-between text-sm text-slate-500 mb-1.5 px-1 font-medium"><span>Taxes</span><span>{fmt(Math.round(tax))}</span></div>}
            {pointsDiscount > 0 && <div className="flex justify-between text-sm text-amber-500 mb-1.5 px-1 font-bold"><span>Points Applied</span><span>−{fmt(pointsDiscount)}</span></div>}
            <div className="flex justify-between items-center text-lg font-black text-slate-900 mt-3 bg-slate-50 p-3 rounded-xl"><span>Total Pay</span><span className="text-emerald-600">{fmt(finalTotal)}</span></div>
          </div>
        </div>

        {/* Loyalty Points */}
        {loyaltyPoints >= 100 && (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-3xl p-5 flex justify-between items-center shadow-sm">
            <div>
              <div className="text-sm font-black text-amber-800 flex items-center gap-1.5"><Sparkles size={16} className="text-amber-500" /> {loyaltyPoints} Points Available</div>
              <div className="text-[11px] text-amber-700/80 font-medium mt-0.5">Use for instant discount on this order</div>
            </div>
            <button onClick={() => setPointsToRedeem(pointsToRedeem > 0 ? 0 : Math.floor(loyaltyPoints / 100) * 100)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${pointsToRedeem > 0 ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-white border text-amber-600 border-amber-200 hover:bg-amber-50'}`}>
              {pointsToRedeem > 0 ? '✓ Applied' : 'Redeem Now'}
            </button>
          </div>
        )}

        {/* Forms */}
        <div className="space-y-6">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex justify-between items-end">
              <span>Your Details</span>
              {loyaltyPoints > 0 && name && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] lowercase flex items-center gap-1 tracking-normal"><Sparkles size={10} /> {loyaltyPoints} pts</span>}
            </div>
            
            <div className="bg-white border border-slate-100 rounded-3xl p-5 space-y-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name *" className="w-full bg-slate-50 text-slate-900 border border-transparent rounded-xl px-4 py-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium" />
              <div className="relative">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number (for WhatsApp bill)" type="tel" className="w-full bg-slate-50 text-slate-900 border border-transparent rounded-xl px-4 py-3.5 pr-28 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black tracking-wide text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                  {pointsEarned > 0 ? `+${pointsEarned} PTS` : 'EARN PTS'}
                </div>
              </div>
              <input value={table} onChange={e => setTable(e.target.value)} placeholder="Table number (if dining in)" className="w-full bg-slate-50 text-slate-900 border border-transparent rounded-xl px-4 py-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium" />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests or instructions?" rows={2} className="w-full bg-slate-50 text-slate-900 border border-transparent rounded-xl px-4 py-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium resize-none overflow-hidden" />
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Payment Method</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { v: 'UPI', icon: '📱', l: 'Pay via UPI', s: 'GPay, PhonePe, Paytm' },
                { v: 'CASH', icon: '💵', l: 'Pay at Counter', s: 'Collect token & pay' },
              ].map(m => (
                 <button key={m.v} onClick={() => setPay(m.v as any)} 
                    className={`p-4 rounded-3xl border-2 text-left transition-all active:scale-95 ${pay === m.v ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'border-slate-100 bg-white hover:border-slate-300'}`}>
                    <div className="text-2xl mb-2">{m.icon}</div>
                    <div className="font-bold text-sm mb-1">{m.l}</div>
                    <div className={`text-[10px] font-medium leading-tight ${pay === m.v ? 'text-slate-300' : 'text-slate-500'}`}>{m.s}</div>
                 </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50">
        <div className="max-w-xl mx-auto">
           <button onClick={placeOrder} disabled={placing || !name.trim()}
             className={`w-full py-4 rounded-2xl font-black text-sm transition-all focus:outline-none ${name.trim() && !placing ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.98] -translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
             {placing ? 'Processing Order...' : pay === 'UPI' ? `Pay ${fmt(finalTotal)}` : `Generate Token · ${fmt(finalTotal)}`}
           </button>
        </div>
      </div>
    </div>
  );

  /* ═══════ CART DRAWER ═══════ */
  if (step === 'cart') return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32 animate-fade-in relative">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('menu')} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-700 transition-colors active:scale-95">
            <ArrowLeft size={20} />
          </button>
          <div className="font-bold text-lg text-slate-900">Your Cart</div>
        </div>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{count} items</span>
      </div>
      
      <div className="p-4 max-w-xl mx-auto">
        {cart.length === 0 ? (
          <div className="text-center py-24 px-4 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mt-4">
            <div className="text-6xl mb-4 opacity-50 grayscale mx-auto w-fit">🛒</div>
            <div className="font-bold text-xl text-slate-900 mb-2">Your cart is empty</div>
            <div className="text-slate-500 font-medium mb-8">Looks like you haven't added anything yet.</div>
            <button onClick={() => setStep('menu')} className="bg-emerald-50 text-emerald-600 font-bold px-6 py-3 rounded-full hover:bg-emerald-100 active:scale-95 transition-all">Browse Menu</button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 p-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            {cart.map((item, i) => (
              <div key={item.id} className="flex gap-4 p-4 items-center bg-white group hover:bg-slate-50 transition-colors rounded-2xl relative" style={{ animation: `slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.05}s both` }}>
                <div className="w-16 h-16 rounded-xl bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center relative">
                  {item.imageUrl ? <img src={getOptimizedImage(item.imageUrl, 128) || ''} className="w-full h-full object-cover" /> : <ShoppingCart className="text-slate-300" />}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-semibold text-sm text-slate-900 leading-tight mb-1 truncate">{item.name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{fmt(item.sellingPrice)}</span>
                    {item.originalPrice && <span className="font-medium text-slate-400 text-xs line-through">{fmt(item.originalPrice)}</span>}
                    {(item.taxRate || 0) > 0 && <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1 py-0.5 rounded">+{item.taxRate}% tax</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                    <button onClick={() => dec(item.id)} className="w-7 h-7 flex items-center justify-center text-slate-600 rounded-md bg-slate-50 hover:bg-slate-100 active:scale-95"><Minus size={14} strokeWidth={2.5} /></button>
                    <span className="font-bold text-[13px] w-5 text-center text-slate-800">{item.qty}</span>
                    <button onClick={() => inc(item.id)} className="w-7 h-7 flex items-center justify-center text-white rounded-md bg-slate-900 hover:bg-slate-800 active:scale-95"><Plus size={14} strokeWidth={2.5} /></button>
                  </div>
                  <div className="font-bold text-sm text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{fmt(item.sellingPrice * item.qty)}</div>
                </div>
                {i < cart.length - 1 && <div className="absolute bottom-0 left-20 right-4 h-px bg-slate-100" />}
              </div>
            ))}
            
            <div className="p-4 bg-slate-50 rounded-2xl mx-2 mb-2 mt-2 space-y-1.5">
               <div className="flex justify-between items-center">
                 <span className="text-slate-500 font-semibold text-sm">Item Total</span>
                 <span className="font-bold text-sm text-slate-700">{fmt(subtotal)}</span>
               </div>
               {tax > 0 && (
                 <div className="flex justify-between items-center">
                   <span className="text-slate-500 font-semibold text-sm">Taxes</span>
                   <span className="font-bold text-sm text-slate-700">{fmt(Math.round(tax))}</span>
                 </div>
               )}
               <div className="flex justify-between items-center border-t border-slate-200/60 pt-2 mt-1">
                 <span className="text-slate-800 font-bold text-sm">Grand Total</span>
                 <span className="font-black text-lg text-slate-900">{fmt(total)}</span>
               </div>
            </div>
            
            <div className="mt-6 px-2">
              <RecommendationRow items={recommendations} onAdd={addToCart} />
            </div>
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50 animate-slide-up">
           <div className="max-w-xl mx-auto flex items-center gap-4">
              <div className="flex flex-col">
                 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount</span>
                 <span className="font-black text-xl text-slate-900 leading-none">{fmt(total)}</span>
              </div>
              <button onClick={() => setStep('info')} className="flex-1 bg-emerald-500 text-white py-3.5 px-6 rounded-2xl font-black text-sm flex justify-between items-center hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20">
                <span>Proceed to Checkout</span>
                <div className="bg-white/20 p-1.5 rounded-lg"><ArrowLeft size={16} className="rotate-180" /></div>
              </button>
           </div>
        </div>
      )}
    </div>
  );

  /* ═══════ MENU SCREEN ═══════ */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight tracking-tight">{shopName}</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Browse our premium menu</p>
          </div>
          {count > 0 && (
            <button onClick={() => setStep('cart')} className="bg-slate-900 text-white rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm active:scale-95">
              <ShoppingCart size={16} /> 
              <span className="bg-emerald-400 text-slate-900 rounded-md px-1.5 py-0.5 text-xs font-black">{count}</span>
            </button>
          )}
        </div>
        
        <div className="relative max-w-7xl mx-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search size={18} /></span>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search for coffee, desserts..."
            className="w-full bg-slate-100/80 border border-transparent rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400 font-medium" 
          />
        </div>

        {/* Dynamic Pricing Banner */}
        {pricingEnabled && activePromo && (
          <div className="mt-4 max-w-7xl mx-auto bg-gradient-to-r from-emerald-600 to-green-500 rounded-xl p-3 text-white flex items-center gap-3 shadow-sm animate-pulse-slow">
            <Sparkles size={20} className="text-emerald-100" />
            <div>
              <div className="text-sm font-bold tracking-wide uppercase">{activePromo} IS LIVE!</div>
              <div className="text-xs text-emerald-50 opacity-90">Special discounts applied automatically</div>
            </div>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      {cats.length > 1 && (
        <div className="sticky top-[120px] z-15 bg-slate-50/90 backdrop-blur-md border-b border-slate-100/50 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex gap-2 px-4 overflow-x-auto snap-x hide-scrollbar max-w-7xl mx-auto" style={{ scrollbarWidth: 'none' }}>
            {cats.map(c => (
              <button key={c} onClick={() => setCat(c)} 
                className={`shrink-0 px-4 py-2 rounded-full font-semibold text-xs tracking-wide transition-all active:scale-95 border ${
                  cat === c ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="px-4 py-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
            <div className="font-semibold text-lg text-slate-800 mb-2">Something went wrong</div>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['menu_data'] })} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold mt-4 hover:bg-slate-800 active:scale-95 transition-all">Retry loading menu</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="text-5xl mb-4 opacity-50 filter grayscale">🍽️</div>
            <div className="font-bold text-lg text-slate-800">No items found</div>
            <div className="text-sm text-slate-500 mt-2">Try searching for something else or changing categories</div>
            <div className="mt-8 p-4 bg-slate-100 rounded-xl text-left text-xs text-slate-500 font-mono inline-block max-w-[300px] w-full break-all">
              <div className="font-bold text-slate-700 mb-1 font-sans">DEBUG INFO:</div>
              <div><b>Shop ID:</b> {shopId}</div>
              <div><b>Loaded:</b> {products.length} products</div>
              {isDebug && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <div><b>API:</b> {API}</div>
                  <div><b>Status:</b> {latestError || 'Ready'}</div>
                </div>
              )}
              <button onClick={() => window.location.reload()} className="mt-3 px-3 py-1.5 bg-white border border-slate-200 rounded font-bold text-slate-800 block w-full">Force Refresh</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
            {filtered.map(p => {
              const inCart = cart.find(i => i.id === p.id);
              return <ProductItem key={p.id} p={p} inCart={inCart} onAdd={() => addToCart(p)} onInc={() => inc(p.id)} onDec={() => dec(p.id)} />;
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Bar */}
      {count > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up max-w-xl mx-auto">
          <button onClick={() => setStep('cart')} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold flex justify-between items-center shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:bg-slate-800 active:scale-[0.98] transition-all border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="bg-emerald-400 text-slate-900 rounded-lg px-2.5 py-1 text-sm font-black">{count}</span>
              <span className="text-sm font-semibold text-slate-100 tracking-wide uppercase">View Cart</span>
            </div>
            <span className="font-black text-lg text-emerald-400">{fmt(total)}</span>
          </button>
        </div>
      )}
      <style jsx>{`
        @keyframes pulse-slow {
          0% { opacity: 1; }
          50% { opacity: 0.9; }
          100% { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}