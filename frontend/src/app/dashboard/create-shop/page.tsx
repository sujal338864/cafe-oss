'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';

export default function CreateShopPage() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { switchShop } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/api/shop/create', { name });
      if (res.data.success) {
        await switchShop(res.data.shop.id);
        router.push('/dashboard');
      }
    } catch (e) {
      alert('Failed to launch cafe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ 
        background: theme.card, 
        border: `1px solid ${theme.border}`, 
        borderRadius: 32, 
        padding: 50, 
        width: '100%', 
        maxWidth: 500, 
        boxShadow: '0 40px 100px -20px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 70, marginBottom: 20 }}>🏗️</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: theme.text, margin: '0 0 10px 0', letterSpacing: '-0.02em' }}>
          Launch Your Next Empire
        </h1>
        <p style={{ fontSize: 16, color: theme.textFaint, marginBottom: 40 }}>
          Welcome back! Tell us the name of your new cafe and we'll have it ready in seconds.
        </p>

        <div style={{ textAlign: 'left', marginBottom: 30 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: theme.textFaint, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>
            New Cafe Name
          </label>
          <input 
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Skyline Brews"
            style={{ 
              width: '100%', 
              padding: '18px 20px', 
              borderRadius: 16, 
              background: theme.bg, 
              border: `2px solid ${theme.border}`, 
              color: theme.text, 
              fontSize: 18, 
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#7c3aed'}
            onBlur={e => e.target.style.borderColor = theme.border}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <button 
            onClick={handleCreate}
            disabled={loading}
            style={{ 
              flex: 2, 
              background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', 
              border: 'none', 
              color: 'white', 
              padding: '18px', 
              borderRadius: 16, 
              fontWeight: 900, 
              fontSize: 16, 
              cursor: loading ? 'not-allowed' : 'pointer', 
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 10px 30px rgba(124,58,237,0.4)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            {loading ? 'Initializing Systems...' : 'Launch Cafe Now 🚀'}
          </button>
          
          <button 
            onClick={() => router.back()}
            style={{ 
              flex: 1, 
              background: theme.hover, 
              border: `1px solid ${theme.border}`, 
              color: theme.textMuted, 
              padding: '18px', 
              borderRadius: 16, 
              fontWeight: 700, 
              fontSize: 16, 
              cursor: 'pointer' 
            }}
          >
            Go Back
          </button>
        </div>

        <p style={{ marginTop: 30, fontSize: 12, color: theme.textFaint }}>
          * Creating a new shop will generate a unique owner identity and an isolated database space for this cafe.
        </p>
      </div>
    </div>
  );
}
