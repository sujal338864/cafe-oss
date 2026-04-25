'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');
  const [showPass, setShowPass]     = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  const strength = (p: string) => {
    if (p.length === 0) return 0;
    if (p.length < 6) return 1;
    if (p.length < 8) return 2;
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return 4;
    return 3;
  };
  const strengthLabel = ['', 'Too short', 'Weak', 'Good', 'Strong'];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const s = strength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif", padding: 20
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
        padding: '40px 36px', width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #dc2626, #9333ea)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 16
          }}>🔐</div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0 }}>
            Set New Password
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8 }}>
            Choose a strong password for your account.
          </p>
        </div>

        {success ? (
          <div style={{
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 12, padding: '24px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: '#10b981', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              Password Updated!
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 20 }}>
              You can now log in with your new password.
            </div>
            <button
              onClick={() => router.push('/login')}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                border: 'none', color: 'white', padding: '12px 28px',
                borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer'
              }}
            >
              Go to Login →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* New password */}
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                NEW PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reset-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{
                    width: '100%', padding: '13px 44px 13px 16px', borderRadius: 10, fontSize: 14,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'white', outline: 'none', boxSizing: 'border-box'
                  }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Strength bar */}
              {password && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= s ? strengthColor[s] : 'rgba(255,255,255,0.1)', transition: 'background .3s' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: strengthColor[s], marginTop: 3 }}>{strengthLabel[s]}</div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                CONFIRM PASSWORD
              </label>
              <input
                id="reset-confirm"
                type={showPass ? 'text' : 'password'}
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 14,
                  background: confirm && confirm !== password ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${confirm && confirm !== password ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  color: 'white', outline: 'none', boxSizing: 'border-box'
                }}
              />
              {confirm && confirm !== password && (
                <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13
              }}>⚠ {error}</div>
            )}

            <button
              id="reset-submit"
              type="submit"
              disabled={loading || !password || !confirm || !token}
              style={{
                background: 'linear-gradient(135deg, #dc2626, #9333ea)',
                border: 'none', color: 'white', padding: '14px',
                borderRadius: 10, fontWeight: 700, fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !password || !confirm ? 0.6 : 1,
                transition: 'opacity .2s'
              }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f0c29', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
