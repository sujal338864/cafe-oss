'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GrowthKPIs {
  revenue: { thisWeek: number; lastWeek: number; thisMonth: number; growthPct: number; avgBasket: number; monthOrders: number; };
  customers: { total: number; newThisWeek: number; repeatRate: number; inactive30d: number; inactive60d: number; };
  products: { topItems: { name: string; revenue: number; quantity: number }[]; lowItems: { name: string; stock: number; price: number }[]; };
}
interface SegmentCounts { VIP: number; FREQUENT: number; NEW: number; INACTIVE_30D: number; INACTIVE_60D: number; HIGH_SPENDER: number; }
interface SuggestedAction { id: string; type: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; icon: string; title: string; description: string; metric: string; ctaLabel: string; ctaHref: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const pct = (n: any) => `${Number(n || 0).toFixed(1)}%`;
const growthColor = (g: number) => g >= 0 ? '#10b981' : '#ef4444';
const growthIcon  = (g: number) => g >= 0 ? '▲' : '▼';
const PRIORITY_COLOR: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };

// ─── Segment Card Config ──────────────────────────────────────────────────────

const SEGMENTS = [
  { key: 'VIP',          label: 'VIP Customers',    desc: '3+ orders, above-avg spend',     icon: '🏆', color: '#f59e0b' },
  { key: 'FREQUENT',     label: 'Frequent Buyers',  desc: '3+ orders in last 30 days',      icon: '⚡', color: '#3b82f6' },
  { key: 'NEW',          label: 'New Customers',    desc: 'Joined in the last 14 days',     icon: '✨', color: '#10b981' },
  { key: 'INACTIVE_30D', label: 'Inactive 30d',     desc: 'No visit in 30–90 days',         icon: '⏰', color: '#f59e0b' },
  { key: 'INACTIVE_60D', label: 'Inactive 60d+',    desc: 'No visit in 60+ days',           icon: '🚨', color: '#ef4444' },
  { key: 'HIGH_SPENDER', label: 'High Spenders',    desc: 'Total purchases above ₹5,000',   icon: '💰', color: '#7c3aed' },
];

// ─── Coupon Modal ─────────────────────────────────────────────────────────────

function CouponModal({ theme, onClose, onSubmit, isLoading }: { theme: any; onClose: () => void; onSubmit: (d: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState({ code: '', type: 'PERCENTAGE', value: '', minOrder: '', maxUses: '', isFirstOnly: false, expiresAt: '', description: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const inp: React.CSSProperties = { width: '100%', background: theme.hover, border: `1px solid ${theme.border}`, borderRadius: 9, padding: '10px 14px', color: theme.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: 11, color: theme.textFaint, fontWeight: 700, marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.value) return toast.error('Code and value are required');
    onSubmit({
      code: form.code.toUpperCase().trim(),
      type: form.type,
      value: parseFloat(form.value),
      minOrder: form.minOrder ? parseFloat(form.minOrder) : 0,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      isFirstOnly: form.isFirstOnly,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      description: form.description || null,
      isActive: true,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 32, width: '100%', maxWidth: 520, animation: 'fadeIn 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: theme.text, margin: 0 }}>🎟️ Create Coupon</h3>
            <p style={{ fontSize: 12, color: theme.textFaint, margin: '4px 0 0' }}>Offer discounts to drive orders and win back customers</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: theme.textFaint, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Coupon Code *</label>
              <input style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.1em' }}
                value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="SAVE20" required maxLength={20} />
            </div>
            <div>
              <label style={lbl}>Type *</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="PERCENTAGE">Percentage Discount (%)</option>
                <option value="FLAT">Flat Discount (₹)</option>
                <option value="FIRST_ORDER">First Order Only</option>
              </select>
            </div>
            <div>
              <label style={lbl}>{form.type === 'PERCENTAGE' ? 'Discount %' : 'Discount ₹'} *</label>
              <input style={inp} type="number" min="0.01" max={form.type === 'PERCENTAGE' ? 100 : undefined} step="0.01"
                value={form.value} onChange={e => set('value', e.target.value)} placeholder={form.type === 'PERCENTAGE' ? '20' : '100'} required />
            </div>
            <div>
              <label style={lbl}>Minimum Order (₹)</label>
              <input style={inp} type="number" min="0" value={form.minOrder} onChange={e => set('minOrder', e.target.value)} placeholder="0 = no minimum" />
            </div>
            <div>
              <label style={lbl}>Max Uses</label>
              <input style={inp} type="number" min="1" value={form.maxUses} onChange={e => set('maxUses', e.target.value)} placeholder="Blank = unlimited" />
            </div>
            <div>
              <label style={lbl}>Expiry Date</label>
              <input style={inp} type="date" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Description (optional)</label>
            <input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Summer sale — 20% off all orders" maxLength={200} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, cursor: 'pointer', fontSize: 13, color: theme.textMuted }}>
            <input type="checkbox" checked={form.isFirstOnly} onChange={e => set('isFirstOnly', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
            <span>First order only (new customer coupon)</span>
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1px solid ${theme.border}`, background: 'none', color: theme.textMuted, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? 'Creating…' : '🎟️ Create Coupon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Loyalty Tier Modal ────────────────────────────────────────────────────────

function LoyaltyTierModal({ theme, onClose, onSubmit, isLoading, editingTier }: { theme: any; onClose: () => void; onSubmit: (d: any) => void; isLoading: boolean; editingTier?: any }) {
  const [form, setForm] = useState({ 
    name: editingTier?.name || '', 
    minPoints: editingTier?.minPoints || '', 
    discountRate: editingTier?.discountRate || '', 
    badgeColor: editingTier?.badgeColor || '#7c3aed' 
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const inp: React.CSSProperties = { width: '100%', background: theme.hover, border: `1px solid ${theme.border}`, borderRadius: 9, padding: '10px 14px', color: theme.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: 11, color: theme.textFaint, fontWeight: 700, marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.minPoints || !form.discountRate) return toast.error('Check fields');
    onSubmit({
      id: editingTier?.id,
      name: form.name.trim(),
      minPoints: parseInt(form.minPoints as string),
      discountRate: parseFloat(form.discountRate as string),
      badgeColor: form.badgeColor,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 22, padding: 32, width: '100%', maxWidth: 420, animation: 'fadeIn 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: theme.text, margin: 0 }}>👑 {editingTier ? 'Edit Tier' : 'New Tier'}</h3>
            <p style={{ fontSize: 12, color: theme.textFaint, margin: '4px 0 0' }}>Auto-assign VIP statuses to your loyal customers.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: theme.textFaint, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Tier Name *</label>
            <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Gold Member" required maxLength={30} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Min Lifetime Spend (₹) *</label>
              <input style={inp} type="number" min="0" value={form.minPoints} onChange={e => set('minPoints', e.target.value)} placeholder="5000" required />
            </div>
            <div>
              <label style={lbl}>Auto Discount (%) *</label>
              <input style={inp} type="number" min="0" max="100" step="0.1" value={form.discountRate} onChange={e => set('discountRate', e.target.value)} placeholder="5" required />
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={lbl}>Badge Color</label>
            <input type="color" value={form.badgeColor} onChange={e => set('badgeColor', e.target.value)} style={{ width: '100%', height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1px solid ${theme.border}`, background: 'none', color: theme.textMuted, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button type="submit" disabled={isLoading} style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? 'Saving…' : '✅ Save Tier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function Skel({ w = '100%', h = 20 }: { w?: string | number; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 8, background: 'rgba(120,120,120,0.12)', animation: 'shimmer 1.5s ease-in-out infinite', backgroundSize: '200% 100%' }} />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Queries ──
  const { data, isLoading } = useQuery({
    queryKey: ['growth_dashboard'],
    queryFn: () => api.get('/api/growth/dashboard').then(r => r.data as { kpis: GrowthKPIs; segments: SegmentCounts; actions: SuggestedAction[] }),
    staleTime: 60_000,
    enabled: mounted
  });

  const { data: couponData, isLoading: couponsLoading } = useQuery({
    queryKey: ['growth_coupons'],
    queryFn: () => api.get('/api/growth/coupons').then(r => r.data),
    staleTime: 30_000,
    enabled: mounted
  });

  const { data: segData, isLoading: segLoading } = useQuery({
    queryKey: ['growth_seg_customers', activeSegment],
    queryFn: () => api.get(`/api/growth/segments/${activeSegment}`).then(r => r.data),
    enabled: !!activeSegment && mounted,
    staleTime: 60_000,
  });

  const { data: tiersData, isLoading: tiersLoading } = useQuery({
    queryKey: ['loyalty_tiers'],
    queryFn: () => api.get('/api/growth/loyalty-tiers').then(r => r.data),
    staleTime: 30_000,
    enabled: mounted
  });

  // ── Mutations ──
  const createCoupon = useMutation({
    mutationFn: (payload: any) => api.post('/api/growth/coupons', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth_coupons'] });
      setShowCouponForm(false);
      toast.success('Coupon created successfully!');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create coupon'),
  });

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => api.delete(`/api/growth/coupons/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['growth_coupons'] }); toast.success('Coupon deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete coupon'),
  });

  const saveTier = useMutation({
    mutationFn: (payload: any) => api.post('/api/growth/loyalty-tiers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty_tiers'] });
      setShowTierForm(false);
      setEditingTier(null);
      toast.success('Tier saved successfully!');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save tier'),
  });

  const deleteTier = useMutation({
    mutationFn: (id: string) => api.delete(`/api/growth/loyalty-tiers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loyalty_tiers'] }); toast.success('Tier deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete tier'),
  });

  if (!mounted) return null;

  const kpis     = data?.kpis;
  const segments = data?.segments;
  const actions  = data?.actions || [];
  const coupons  = couponData?.coupons || [];
  const tiers    = tiersData?.tiers || [];
  const migrationRequired = couponData?.migrationRequired;

  const card: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`,
    borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        @keyframes shimmer { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: none } }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🚀</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: theme.text, margin: 0 }}>Growth Engine</h1>
            <p style={{ color: theme.textFaint, fontSize: 13, margin: 0 }}>Revenue intelligence · Customer retention · Coupons</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { queryClient.invalidateQueries({ queryKey: ['growth_dashboard'] }); toast.success('Refreshed!'); }}
            style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '9px 16px', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
          <button onClick={() => setShowCouponForm(true)}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white', border: 'none', padding: '9px 20px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
            + Create Coupon
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        {[
          {
            title: 'Week Revenue', color: '#10b981',
            value: isLoading ? null : fmt(kpis?.revenue.thisWeek),
            sub: isLoading ? null : (
              <span style={{ color: growthColor(kpis?.revenue.growthPct || 0), fontWeight: 700, fontSize: 12 }}>
                {growthIcon(kpis?.revenue.growthPct || 0)} {Math.abs(kpis?.revenue.growthPct || 0)}% vs last week
              </span>
            )
          },
          {
            title: 'Month Revenue', color: '#3b82f6',
            value: isLoading ? null : fmt(kpis?.revenue.thisMonth),
            sub: isLoading ? null : `${kpis?.revenue.monthOrders || 0} orders this month`
          },
          {
            title: 'Repeat Rate', color: '#a78bfa',
            value: isLoading ? null : pct(kpis?.customers.repeatRate),
            sub: isLoading ? null : (
              <span style={{ color: (kpis?.customers.repeatRate || 0) >= 25 ? '#10b981' : '#f59e0b', fontSize: 12 }}>
                {(kpis?.customers.repeatRate || 0) >= 25 ? '✓ Healthy' : 'Below 25% target'}
              </span>
            )
          },
          {
            title: 'New Customers', color: '#10b981',
            value: isLoading ? null : String(kpis?.customers.newThisWeek || 0),
            sub: 'joined this week'
          },
          {
            title: 'At Risk (30d)', color: '#f59e0b',
            value: isLoading ? null : String(kpis?.customers.inactive30d || 0),
            sub: isLoading ? null : (
              <span style={{ color: (kpis?.customers.inactive30d || 0) > 10 ? '#f59e0b' : theme.textFaint, fontSize: 12 }}>
                {(kpis?.customers.inactive30d || 0) > 10 ? '⚠ Action needed' : 'inactive customers'}
              </span>
            )
          },
          {
            title: 'Avg Basket', color: '#f59e0b',
            value: isLoading ? null : fmt(kpis?.revenue.avgBasket),
            sub: 'per order this week'
          }
        ].map((k, i) => (
          <div key={k.title} style={{ ...card, animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: k.color }} />
            <div style={{ fontSize: 10, color: theme.textFaint, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{k.title}</div>
            {isLoading
              ? <><Skel h={28} w="70%" /><div style={{ marginTop: 6 }}><Skel h={14} w="50%" /></div></>
              : <>
                  <div style={{ fontSize: 26, fontWeight: 900, color: theme.text, marginBottom: 5 }}>{k.value}</div>
                  <div style={{ fontSize: 12, color: theme.textFaint, fontWeight: 600 }}>{k.sub}</div>
                </>
            }
          </div>
        ))}
      </div>

      {/* ── CUSTOMER SEGMENTS ──────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 900, color: theme.text, marginBottom: 14 }}>👥 Customer Segments</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          {SEGMENTS.map((seg, i) => {
            const count = segments?.[seg.key as keyof SegmentCounts] ?? 0;
            const active = activeSegment === seg.key;
            return (
              <div key={seg.key}
                onClick={() => setActiveSegment(active ? null : seg.key)}
                style={{
                  background: theme.card, border: `1.5px solid ${active ? seg.color : theme.border}`,
                  borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
                  transition: 'all 0.15s', animation: `fadeIn 0.3s ease ${i * 0.06}s both`,
                  boxShadow: active ? `0 0 0 3px ${seg.color}22` : 'none'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${seg.color}22`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = active ? `0 0 0 3px ${seg.color}22` : 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${seg.color}18`, border: `1px solid ${seg.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                    {seg.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: theme.text }}>{seg.label}</div>
                    <div style={{ fontSize: 11, color: theme.textFaint }}>{seg.desc}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isLoading
                    ? <Skel w={40} h={28} />
                    : <div style={{ fontSize: 30, fontWeight: 900, color: seg.color }}>{count}</div>
                  }
                  <div style={{ fontSize: 10, color: seg.color, fontWeight: 800, background: `${seg.color}15`, padding: '4px 10px', borderRadius: 8 }}>
                    {active ? 'Hide ▲' : 'View ▼'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Segment Customer Table (expandable) */}
        {activeSegment && (
          <div style={{ ...card, marginTop: 14, animation: 'fadeIn 0.2s ease', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: theme.text }}>
                {SEGMENTS.find(s => s.key === activeSegment)?.icon} {SEGMENTS.find(s => s.key === activeSegment)?.label} — Customer List
              </div>
              <button onClick={() => setActiveSegment(null)} style={{ background: 'none', border: 'none', color: theme.textFaint, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            {segLoading ? (
              <div style={{ padding: 24 }}><Skel h={60} /></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Name', 'Phone', 'Total Spend', 'Orders', 'Loyalty Pts', 'Last Visit'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(segData?.customers || []).length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '28px 16px', textAlign: 'center', color: theme.textFaint, fontSize: 13 }}>No customers in this segment yet.</td></tr>
                    ) : (
                      (segData?.customers || []).slice(0, 15).map((c: any) => (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '11px 16px', fontWeight: 700, color: theme.text }}>{c.name}</td>
                          <td style={{ padding: '11px 16px', color: theme.textMuted, fontFamily: 'monospace', fontSize: 12 }}>{c.phone || '—'}</td>
                          <td style={{ padding: '11px 16px', fontWeight: 800, color: '#10b981' }}>{fmt(c.totalPurchases)}</td>
                          <td style={{ padding: '11px 16px', color: theme.textMuted, textAlign: 'center' }}>{c.orderCount ?? '—'}</td>
                          <td style={{ padding: '11px 16px', color: '#a78bfa', fontWeight: 700 }}>{c.loyaltyPoints ?? 0} pts</td>
                          <td style={{ padding: '11px 16px', color: theme.textFaint, fontSize: 12 }}>
                            {c.lastOrderAt
                              ? new Date(c.lastOrderAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                              : c.createdAt
                                ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                                : '—'
                            }
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ACTIONS + PRODUCTS (2-col) ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Suggested Actions */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 900, color: theme.text, marginBottom: 16 }}>💡 Suggested Actions</div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3].map(i => <Skel key={i} h={80} />)}
            </div>
          ) : actions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: theme.textFaint }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: theme.text, marginBottom: 4 }}>All looking great!</div>
              <div style={{ fontSize: 12 }}>No urgent actions needed right now.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {actions.map((action, i) => (
                <div key={action.id} style={{ background: theme.hover, borderRadius: 12, padding: '14px 16px', border: `1px solid ${PRIORITY_COLOR[action.priority]}2a`, animation: `slideIn 0.25s ease ${i * 0.07}s both` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{action.icon}</span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, lineHeight: 1.3 }}>{action.title}</div>
                    </div>
                    <span style={{ background: `${PRIORITY_COLOR[action.priority]}20`, color: PRIORITY_COLOR[action.priority], fontSize: 9, fontWeight: 900, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {action.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10, lineHeight: 1.55 }}>{action.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: theme.textFaint }}>📊 {action.metric}</div>
                    <a href={action.ctaHref} style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textDecoration: 'none', background: 'rgba(124,58,237,0.1)', padding: '4px 10px', borderRadius: 7 }}>
                      {action.ctaLabel} →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Performance */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 900, color: theme.text, marginBottom: 16 }}>📊 Product Performance (30d)</div>

          {/* Top performers */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>🏅 Top Sellers</div>
            {isLoading ? <Skel h={80} /> : (kpis?.products.topItems || []).length === 0 ? (
              <div style={{ fontSize: 12, color: theme.textFaint, padding: '8px 0' }}>No sales data yet. Start selling! 🛒</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(kpis?.products.topItems || []).map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#10b981', fontWeight: 900, width: 16, textAlign: 'center' }}>#{i + 1}</span>
                      <div style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>{p.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#10b981' }}>{fmt(p.revenue)}</div>
                      <div style={{ fontSize: 10, color: theme.textFaint }}>{p.quantity} sold</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low performers */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>⚠️ Zero Sales (30d)</div>
            {isLoading ? <Skel h={60} /> : (kpis?.products.lowItems || []).length === 0 ? (
              <div style={{ fontSize: 12, color: '#10b981', padding: '8px 0' }}>✓ All products have sold recently!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(kpis?.products.lowItems || []).map(p => (
                  <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>{fmt(p.price)}</div>
                      <div style={{ fontSize: 10, color: theme.textFaint }}>{p.stock} in stock</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── COUPON MANAGER ────────────────────────────────────────────────── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: theme.text }}>🎟️ Coupon Manager</div>
            <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>Create and manage discount codes for customers</div>
          </div>
          <button onClick={() => setShowCouponForm(true)}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 9, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            + New Coupon
          </button>
        </div>

        {couponsLoading ? (
          <div style={{ padding: 24 }}><Skel h={100} /></div>
        ) : migrationRequired ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: theme.text, marginBottom: 6 }}>One-Time Setup Required</div>
            <div style={{ fontSize: 13, color: theme.textFaint, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
              Run this command in your backend terminal to enable the Coupon Engine:
            </div>
            <code style={{ display: 'inline-block', background: theme.hover, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '12px 24px', fontSize: 13, color: '#10b981', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
              npx prisma migrate dev --name add_growth_engine
            </code>
            <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 14 }}>Then refresh this page — coupons will be ready instantly.</div>
          </div>
        ) : coupons.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: theme.textFaint }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎟️</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: theme.text, marginBottom: 4 }}>No coupons yet</div>
            <div style={{ fontSize: 12 }}>Create your first coupon to start driving orders</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Code', 'Type', 'Discount', 'Min Order', 'Uses', 'Expires', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 900, color: '#7c3aed', letterSpacing: '0.08em', fontSize: 13 }}>{c.code}</td>
                    <td style={{ padding: '12px 16px', color: theme.textMuted, fontSize: 12 }}>{c.type}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: theme.text }}>{c.type === 'PERCENTAGE' ? `${c.value}%` : fmt(c.value)}</td>
                    <td style={{ padding: '12px 16px', color: theme.textMuted }}>{Number(c.minOrder) > 0 ? fmt(c.minOrder) : '—'}</td>
                    <td style={{ padding: '12px 16px', color: theme.textMuted }}>{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ' / ∞'}</td>
                    <td style={{ padding: '12px 16px', color: theme.textFaint, fontSize: 12 }}>
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Never'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: c.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: c.isActive ? '#10b981' : '#ef4444', padding: '3px 9px', borderRadius: 14, fontSize: 11, fontWeight: 800 }}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => { if (confirm(`Delete coupon ${c.code}? This cannot be undone.`)) deleteCoupon.mutate(c.id); }}
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── LOYALTY TIERS MANAGER ────────────────────────────────────────────── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: theme.text }}>👑 Loyalty Tiers</div>
            <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>Automatically apply discounts based on lifetime customer spend</div>
          </div>
          <button onClick={() => { setEditingTier(null); setShowTierForm(true); }}
            style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)', padding: '9px 18px', borderRadius: 9, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            + New Tier
          </button>
        </div>

        {tiersLoading ? (
          <div style={{ padding: 24 }}><Skel h={80} /></div>
        ) : tiers.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: theme.textFaint }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👑</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: theme.text, marginBottom: 4 }}>No loyalty tiers configured</div>
            <div style={{ fontSize: 12 }}>Create tiers (e.g. Gold/Platinum) to automatically reward frequent buyers</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Tier Name', 'Required Spend', 'Auto Discount', 'Badge', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiers.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: theme.text, fontSize: 13 }}>{t.name}</td>
                    <td style={{ padding: '12px 16px', color: theme.textMuted, fontSize: 12 }}>₹{t.minPoints.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10b981' }}>{t.discountRate}% off</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ background: t.badgeColor, color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, display: 'inline-block' }}>VIP</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={() => { setEditingTier(t); setShowTierForm(true); }}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', marginRight: 12, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Edit</button>
                      <button onClick={() => { if (confirm(`Delete tier ${t.name}?`)) deleteTier.mutate(t.id); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── COUPON MODAL ─────────────────────────────────────────────────── */}
      {showCouponForm && (
        <CouponModal
          theme={theme}
          onClose={() => setShowCouponForm(false)}
          onSubmit={(d) => createCoupon.mutate(d)}
          isLoading={createCoupon.isPending}
        />
      )}

      {/* ── LOYALTY TIER MODAL ───────────────────────────────────────────── */}
      {showTierForm && (
        <LoyaltyTierModal
          theme={theme}
          onClose={() => { setShowTierForm(false); setEditingTier(null); }}
          onSubmit={(d) => saveTier.mutate(d)}
          isLoading={saveTier.isPending}
          editingTier={editingTier}
        />
      )}
    </div>
  );
}
