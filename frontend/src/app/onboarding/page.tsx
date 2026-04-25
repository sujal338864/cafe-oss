'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

type Mode = 'INDEPENDENT' | 'FRANCHISE';
type Step = 'welcome' | 'mode' | 'plan' | 'setup';

export default function CompleteOnboarding() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<Mode>('INDEPENDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Independent fields
  const [shopName, setShopName] = useState('');
  const [category, setCategory] = useState('Cafe');
  const [city, setCity] = useState('');

  // Franchise fields
  const [orgName, setOrgName] = useState('');
  const [hqCity, setHqCity] = useState('');
  const [branches, setBranches] = useState('2');
  const [firstBranchName, setFirstBranchName] = useState('');

  useEffect(() => {
    // If the user already finished onboarding or data is missing, move them out
    if (user?.onboardingCompleted) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const selectMode = (selected: Mode) => {
    setMode(selected);
    setStep('plan');
  };

  const handleFinish = async () => {
    setError('');
    
    // Validation
    if (mode === 'INDEPENDENT') {
      if (!shopName || !city) return setError('Shop name and city are required.');
    } else {
      if (!orgName || !hqCity || !firstBranchName) return setError('Brand name, HQ city, and first branch name are required.');
    }

    setLoading(true);
    try {
      const payload = mode === 'INDEPENDENT'
        ? { mode, shopName, category, city }
        : { mode, orgName, orgSlug: orgName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'), hqCity, branchesCount: branches, shopName: firstBranchName, city: hqCity };

      const res = await api.post('/api/auth/onboard', payload);
      
      if (res.data.success) {
        // Hard refresh auth context to pull new shop/mode bindings
        await refreshUser();
        // Send user to HQ if franchise, else regular dashboard
        setTimeout(() => {
           if (mode === 'FRANCHISE') router.push('/dashboard/hq');
           else router.push('/dashboard');
        }, 500);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to complete setup');
      setLoading(false);
    }
  };

  // --- UI Theme Constants ---
  const bg = '#0f0f14';
  const card = '#18181f';
  const border = '#2a2a35';
  const text = '#f1f1f5';
  const muted = '#888899';
  const accent = '#7c3aed';

  const inpStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 16px', 
    background: bg, border: `1px solid ${border}`, borderRadius: 10, 
    color: text, fontSize: 15, outline: 'none'
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', sans-serif" }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: step === 'mode' ? 880 : 540, position: 'relative', zIndex: 1, animation: 'fadeIn 0.3s ease' }}>
        
        {/* --- STEP 1: WELCOME --- */}
        {step === 'welcome' && (
          <div style={{ textAlign: 'center', padding: 40, background: card, border: `1px solid ${border}`, borderRadius: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: text, margin: '0 0 12px' }}>Welcome to Cafe OS</h1>
            <p style={{ color: muted, fontSize: 18, marginBottom: 36 }}>Let's set up your business in exactly 2 minutes.</p>
            <button onClick={() => setStep('mode')} style={{ padding: '16px 32px', background: accent, color: 'white', border: 'none', borderRadius: 99, fontWeight: 800, fontSize: 18, cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              Get Started →
            </button>
          </div>
        )}

        {/* --- STEP 2: MODE SELECTION --- */}
        {step === 'mode' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ fontSize: 13, color: accent, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Step 1 of 3</div>
              <h2 style={{ fontSize: 28, fontWeight: 900, color: text, margin: 0 }}>Choose Business Type</h2>
              <p style={{ color: muted, marginTop: 10, fontSize: 16 }}>Select the structure that best matches your operations.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24 }}>
              {/* INDEPENDENT */}
              <button onClick={() => selectMode('INDEPENDENT')} style={{
                background: card, border: `1px solid ${border}`, borderRadius: 20, padding: 36, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
              }} onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'} onMouseLeave={e => e.currentTarget.style.borderColor = border}>
                <div style={{ fontSize: 40, marginBottom: 20 }}>🏪</div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: text, margin: '0 0 10px' }}>Independent Shop</h3>
                <p style={{ color: muted, fontSize: 14, lineHeight: 1.6, margin: 0, height: 44 }}>
                  Perfect for a single cafe, bakery, or local restaurant.
                </p>
                <div style={{ marginTop: 20, borderTop: `1px solid ${border}`, paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Full POS & Billing', 'Inventory & Menus', 'Sales Analytics', 'AI Marketing OS'].map(f => (
                    <div key={f} style={{ fontSize: 13, color: muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#10b981' }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </button>

              {/* FRANCHISE */}
              <button onClick={() => selectMode('FRANCHISE')} style={{
                background: card, border: `1px solid ${border}`, borderRadius: 20, padding: 36, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
              }} onMouseEnter={e => e.currentTarget.style.borderColor = accent} onMouseLeave={e => e.currentTarget.style.borderColor = border}>
                <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />
                <div style={{ fontSize: 40, marginBottom: 20 }}>🏢</div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: text, margin: '0 0 10px' }}>Franchise / Chain</h3>
                <p style={{ color: muted, fontSize: 14, lineHeight: 1.6, margin: 0, height: 44 }}>
                  For growing brands managing multiple branches from a central HQ.
                </p>
                <div style={{ marginTop: 20, borderTop: `1px solid ${border}`, paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Everything in Independent', 'Cross-Branch HQ Dashboard', 'Central Menu Sync', 'Role Management (HQ vs Branch)'].map((f, i) => (
                    <div key={f} style={{ fontSize: 13, color: i===0?muted:text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: i===0?'#10b981':accent }}>{i===0?'✓':'+'}</span> {f}
                    </div>
                  ))}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 3: PLAN SELECTION --- */}
        {step === 'plan' && (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 20, padding: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 13, color: accent, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Step 2 of 3</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: text, margin: '0 0 8px' }}>Select Your Plan</h2>
              <p style={{ color: muted, fontSize: 15, margin: 0 }}>Start with a free 14-day trial. Cancel anytime.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              {mode === 'INDEPENDENT' ? (
                <>
                  {[{ n: 'Starter', p: 'Free', b: 'Essential POS & Menus' }, { n: 'Growth', p: '₹499/mo', b: 'Advanced Analytics & Advanced Inventory' }, { n: 'Pro', p: '₹999/mo', b: 'AI Marketing OS & Full API Access' }].map(pl => (
                    <div key={pl.n} onClick={() => setStep('setup')} style={{ border: `1px solid ${border}`, padding: '20px 24px', borderRadius: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                         <div style={{ fontWeight: 800, fontSize: 18, color: text }}>{pl.n}</div>
                         <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{pl.b}</div>
                       </div>
                       <div style={{ fontWeight: 800, fontSize: 18, color: accent }}>{pl.p}</div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[{ n: 'HQ Pro', p: '₹1,999/mo', b: 'Up to 5 Branches + HQ Dashboard' }, { n: 'Enterprise', p: 'Custom', b: 'Unlimited Branches + Dedicated Support' }].map(pl => (
                    <div key={pl.n} onClick={() => setStep('setup')} style={{ border: `1px solid ${accent}55`, background: `rgba(124,58,237,0.05)`, padding: '20px 24px', borderRadius: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                         <div style={{ fontWeight: 800, fontSize: 18, color: text }}>{pl.n}</div>
                         <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{pl.b}</div>
                       </div>
                       <div style={{ fontWeight: 800, fontSize: 18, color: accent }}>{pl.p}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <button onClick={() => setStep('mode')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 13, width: '100%', padding: 8 }}>← Back to mode selection</button>
          </div>
        )}

        {/* --- STEP 4: BUSINESS SETUP --- */}
        {step === 'setup' && (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 20, padding: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 13, color: accent, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Final Step</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: text, margin: '0 0 8px' }}>Business Details</h2>
              <p style={{ color: muted, fontSize: 15, margin: 0 }}>Configure your workspace.</p>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 600 }}>{error}</div>}

            {mode === 'INDEPENDENT' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>Shop Name *</label>
                  <input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Daily Roast Coffee" style={inpStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>City *</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai" style={inpStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={inpStyle}>
                    <option value="Cafe">Cafe</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Retail">Retail Store</option>
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>Brand / Organization Name *</label>
                  <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. The Coffee Chain HQ" style={inpStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>HQ City *</label>
                  <input value={hqCity} onChange={e => setHqCity(e.target.value)} placeholder="e.g. New Delhi" style={inpStyle} />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>Expected Branches</label>
                    <select value={branches} onChange={e => setBranches(e.target.value)} style={inpStyle}>
                      <option value="2-5">2 - 5</option>
                      <option value="6-20">6 - 20</option>
                      <option value="21+">21+</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: muted, marginBottom: 8, textTransform: 'uppercase' }}>First Branch Name *</label>
                    <input value={firstBranchName} onChange={e => setFirstBranchName(e.target.value)} placeholder="e.g. Bandra West Outlet" style={inpStyle} />
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleFinish} disabled={loading} style={{ width: '100%', padding: '16px', background: loading ? border : accent, color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Building your workspace...' : '🚀 Launch Cafe OS'}
            </button>
            <button onClick={() => setStep('plan')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 13, width: '100%', padding: '16px 8px 0' }}>← Back to plans</button>
          </div>
        )}

      </div>
    </div>
  );
}
