'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
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
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 16
          }}>🔑</div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0 }}>
            Forgot Password?
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 8 }}>
            Enter your email and we&apos;ll send a reset link.
          </p>
        </div>

        {sent ? (
          <div style={{
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 12, padding: '20px 24px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📬</div>
            <div style={{ color: '#10b981', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Check your inbox!
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              If an account exists for <strong style={{ color: 'white' }}>{email}</strong>,
              we&apos;ve sent a reset link. It expires in 1 hour.
            </div>
            <button
              onClick={() => router.push('/login')}
              style={{
                marginTop: 20, background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)',
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13
              }}
            >
              ← Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                EMAIL ADDRESS
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 14,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13
              }}>
                ⚠ {error}
              </div>
            )}

            <button
              id="forgot-submit"
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                border: 'none', color: 'white', padding: '14px',
                borderRadius: 10, fontWeight: 700, fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !email.trim() ? 0.6 : 1,
                transition: 'opacity .2s'
              }}
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/login')}
              style={{
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                fontSize: 13, textDecoration: 'underline', padding: 0
              }}
            >
              ← Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
