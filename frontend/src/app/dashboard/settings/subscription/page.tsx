'use client';
import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

export default function SubscriptionPage() {
  const { theme } = useTheme();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const loadShop = async () => {
    try {
      const { data } = await api.get('/api/shop/profile');
      setShop(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadShop(); }, []);

  const handleUpgrade = async (plan: string) => {
    setUpgrading(true);
    try {
      // Simulate Payment setup. Simulating successful PUT trigger
      await api.post('/api/shop/upgrade', { plan });
      alert(`Success! Unlocking ${plan} features.`);
      
      // Update AuthContext LocalStorage before reloading
      const sStr = localStorage.getItem('shop_os_shop');
      if (sStr) {
        const s = JSON.parse(sStr);
        s.plan = plan;
        localStorage.setItem('shop_os_shop', JSON.stringify(s));
      }

      loadShop(); // Reload local state
      window.location.reload(); // Hard reload to paint top-right layout
    } catch (e) {
      alert('Upgrade simulation failed.');
    } finally { setUpgrading(false); }
  };

  const card: React.CSSProperties = {
    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '24px', flex: 1, display: 'flex', flexDirection: 'column'
  };

  if (loading) return <div style={{ color: theme.textMuted, padding: 40, textAlign: 'center' }}>Loading Plan details...</div>;

  const currentPlan = shop?.plan || 'STARTER';

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Subscription</h2>
        <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>Scale your business with advanced analytics and AI insights.</p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
        {/* Starter Plan */}
        <div style={{ ...card, opacity: currentPlan === 'STARTER' ? 1 : 0.6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Basic</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginTop: 4 }}>Starter</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginTop: 12 }}>Rs. 0 <span style={{ fontSize: 13, color: theme.textFaint }}>/mo</span></div>
          
          <div style={{ flex: 1, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Standard POS Sales', 'Basic Inventory', 'Multi-staff Access'].map(f => (
              <div key={f} style={{ fontSize: 13, color: theme.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>✓</span> {f}
              </div>
            ))}
          </div>

          <button disabled style={{ marginTop: 24, width: '100%', padding: '11px', borderRadius: 9, background: theme.border, color: theme.textMuted, border: 'none', fontWeight: 700 }}>
            {currentPlan === 'STARTER' ? 'Current Plan' : 'Free Tier'}
          </button>
        </div>

        {/* Pro Plan */}
        <div style={{ ...card, border: `2px solid #7c3aed`, background: 'rgba(124, 58, 237, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase' }}>Recommended</div>
            {currentPlan === 'PRO' && <span style={{ background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800 }}>ACTIVE</span>}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginTop: 4 }}>Pro Scale</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginTop: 12 }}>Rs. 999 <span style={{ fontSize: 13, color: theme.textFaint }}>/mo</span></div>

          <div style={{ flex: 1, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Everything in Starter',
              '🤖 AI Business Consultant Consultant',
              '📈 Advanced demand predictions',
              '📊 Heavy aggregates analytics pipeline'
            ].map(f => (
              <div key={f} style={{ fontSize: 13, color: theme.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#7c3aed' }}>✓</span> {f}
              </div>
            ))}
          </div>

          {currentPlan === 'STARTER' ? (
            <button onClick={() => handleUpgrade('PRO')} disabled={upgrading}
              style={{ marginTop: 24, width: '100%', padding: '12px', borderRadius: 9, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
              {upgrading ? 'Upgrading...' : 'Simulate Upgrade 🚀'}
            </button>
          ) : (
            <button disabled style={{ marginTop: 24, width: '100%', padding: '11px', borderRadius: 9, background: theme.border, color: theme.textMuted, border: 'none', fontWeight: 700 }}>
              Current Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
