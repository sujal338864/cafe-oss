"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

export default function SuperLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { theme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use existing login API
      const res = await api.post('/api/auth/login', { email, password });
      const { user, token } = res.data;

      if (user.role !== 'SUPER_ADMIN') {
        throw new Error('Access Denied: Specialized Clearance Required');
      }

      // If they are super admin, call the login function from context (it saves cookie/user)
      login(user, res.data.shop, token);
      router.push('/super-admin');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 40, background: '#111', borderRadius: 24, border: '1px solid #333', boxShadow: '0 20px 80px rgba(0,0,0,0.8)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #7c3aed, #ef4444)', borderRadius: 20, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 0 30px rgba(124,58,237,0.5)' }}>
            👑
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' }}>Node Governance</h1>
          <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Global System Administrator Portal</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '12px 16px', borderRadius: 12, fontSize: 12, marginBottom: 24, textAlign: 'center', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Root ID</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="superadmin@shopos.com"
              style={{ width: '100%', padding: '14px 18px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none' }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Cipher Key</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{ width: '100%', padding: '14px 18px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none' }}
              onFocus={(e) => e.target.style.borderColor = '#ef4444'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', padding: '16px', background: loading ? '#333' : 'linear-gradient(to right, #7c3aed, #4f46e5)', 
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 10, transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(124,58,237,0.3)'
            }}
          >
            {loading ? 'Establishing Link...' : 'Authenticate'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/login" style={{ color: '#555', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>Return to Terminal</a>
        </div>
      </div>
    </div>
  );
}
