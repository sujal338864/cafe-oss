'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { theme } = useTheme();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [waking, setWaking] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  // Register fields
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Google registration extra step
  const [googleStep, setGoogleStep] = useState(false);
  const [googleInfo, setGoogleInfo] = useState<any>(null);
  const [gShopName, setGShopName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gLoading, setGLoading] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // ── Keep-alive ping so Render wakes before user clicks Sign In ──
  useEffect(() => {
    const ping = async () => {
      try {
        setWaking(true);
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, { method: 'GET' });
      } catch { /* ignore */ }
      finally { setWaking(false); }
    };
    ping();
  }, []);

  // ── Load Google Sign-In SDK ──────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handleGoogleCallback = useCallback(async (response: any) => {
    setError('');
    setGLoading(true);
    try {
      const { data } = await api.post('/api/auth/google', { credential: response.credential });

      if (data.isNewUser && !data.token) {
        // New Google user — needs shop details
        setGoogleInfo({ credential: response.credential, email: data.email, name: data.name });
        setGShopName('');
        setGPhone('');
        setGoogleStep(true);
        setGLoading(false);
        return;
      }
      // Existing user or new user with shop already created
      login(data.user, data.shop, data.token);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Google sign-in failed');
    } finally {
      setGLoading(false);
    }
  }, [login, router]);

  useEffect(() => {
    if (!googleReady || !window.google || !googleBtnRef.current || !GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'filled_black', size: 'large', width: '100%', text: 'continue_with',
    });
  }, [googleReady, tab, handleGoogleCallback]);

  const completeGoogleRegister = async () => {
    if (!gShopName.trim()) { setError('Shop name is required'); return; }
    if (!gPhone.trim()) { setError('Phone number is required'); return; }
    setGLoading(true); setError('');
    try {
      const { data } = await api.post('/api/auth/google', {
        credential: googleInfo.credential,
        shopName: gShopName.trim(),
        phone: gPhone.trim(),
      });
      login(data.user, data.shop, data.token);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Registration failed');
    } finally {
      setGLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      login(data.user, data.shop, data.token);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!shopName || !ownerName || !email || !regPass || !phone) {
      setError('All fields are required'); return;
    }
    setRegLoading(true); setError('');
    try {
      const { data } = await api.post('/api/auth/register', {
        shopName, ownerName, email, password: regPass, phone,
      });
      login(data.user, data.shop, data.token);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: theme.input, border: `1px solid ${theme.border}`,
    color: theme.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const btn = (primary = true): React.CSSProperties => ({
    width: '100%', padding: '13px', borderRadius: 11, border: 'none',
    cursor: loading || regLoading || gLoading ? 'not-allowed' : 'pointer',
    fontWeight: 700, fontSize: 15,
    background: primary ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : theme.hover,
    color: primary ? 'white' : theme.textMuted,
    opacity: loading || regLoading || gLoading ? 0.7 : 1,
  });
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, color: theme.textFaint,
    fontWeight: 700, textTransform: 'uppercase', marginBottom: 6,
  };

  // ── Google Extra Step Modal ──────────────────────────────
  if (googleStep && googleInfo) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 36, width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏪</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: theme.text }}>One last step!</div>
            <p style={{ color: theme.textFaint, fontSize: 13, marginTop: 6 }}>
              Signed in as <b style={{ color: theme.accent }}>{googleInfo.email}</b>.<br />
              Tell us about your shop to get started.
            </p>
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Shop Name *</label>
              <input value={gShopName} onChange={e => setGShopName(e.target.value)} placeholder="e.g. Kirana King" style={inp} />
            </div>
            <div>
              <label style={lbl}>Phone Number *</label>
              <input value={gPhone} onChange={e => setGPhone(e.target.value)} placeholder="+91 98765 43210" style={inp} />
            </div>
            <button onClick={completeGoogleRegister} disabled={gLoading} style={btn()}>
              {gLoading ? 'Creating your shop...' : 'Create Shop & Continue →'}
            </button>
            <button onClick={() => { setGoogleStep(false); setGoogleInfo(null); }} style={btn(false)}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>S</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: theme.text, margin: 0 }}>Shop OS</h1>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 4 }}>
            {tab === 'login' ? 'Sign in to your account' : 'Create your free shop'}
          </p>
          {waking && (
            <div style={{ marginTop: 8, fontSize: 11, color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: theme.accent, animation: 'pulse 1.2s infinite' }} />
              Waking up server…
            </div>
          )}
        </div>

        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 28 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: theme.input, borderRadius: 12, padding: 4 }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                style={{
                  flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: tab === t ? theme.accent : 'transparent',
                  color: tab === t ? 'white' : theme.textMuted
                }}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@yourshop.com" style={inp}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <div>
                <label style={lbl}>Password</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" style={inp}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <button onClick={handleLogin} disabled={loading} style={btn()}>
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>

              {GOOGLE_CLIENT_ID && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: theme.border }} />
                    <span style={{ fontSize: 11, color: theme.textFaint }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: theme.border }} />
                  </div>
                  <div ref={googleBtnRef} style={{ width: '100%' }} />
                  {gLoading && <div style={{ textAlign: 'center', color: theme.textFaint, fontSize: 13 }}>Signing in with Google...</div>}
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Shop Name *</label>
                <input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Kirana King" style={inp} />
              </div>
              <div>
                <label style={lbl}>Your Name *</label>
                <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" style={inp} />
              </div>
              <div>
                <label style={lbl}>Email *</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@yourshop.com" style={inp} />
              </div>
              <div>
                <label style={lbl}>Phone *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" style={inp} />
              </div>
              <div>
                <label style={lbl}>Password *</label>
                <input value={regPass} onChange={e => setRegPass(e.target.value)} type="password" placeholder="Min 8 characters" style={inp} />
              </div>
              <button onClick={handleRegister} disabled={regLoading} style={btn()}>
                {regLoading ? 'Creating shop...' : 'Create My Shop →'}
              </button>

              {GOOGLE_CLIENT_ID && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: theme.border }} />
                    <span style={{ fontSize: 11, color: theme.textFaint }}>OR register with</span>
                    <div style={{ flex: 1, height: 1, background: theme.border }} />
                  </div>
                  <div ref={googleBtnRef} style={{ width: '100%' }} />
                  {gLoading && <div style={{ textAlign: 'center', color: theme.textFaint, fontSize: 13 }}>Continuing with Google...</div>}
                </>
              )}
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: theme.textFaint, marginTop: 18 }}>
            Shop OS · Modern Shop Management
          </p>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  );
}
