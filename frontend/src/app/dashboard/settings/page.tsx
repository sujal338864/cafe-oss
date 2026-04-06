'use client';
import { useState, useEffect } from 'react';
import { useTheme, THEMES, ThemeName } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

export default function SettingsPage() {
  const { theme, themeName, setTheme } = useTheme();
  const { user } = useAuth();

  // Shop profile
  const [shop,       setShop]       = useState<any>(null);
  const [shopForm,   setShopForm]   = useState({ name: '', phone: '', email: '', address: '', upiId: '', currency: 'Rs.' });
  const [shopSaving, setShopSaving] = useState(false);
  const [shopMsg,    setShopMsg]    = useState('');

  // Invoice settings
  const [invForm,   setInvForm]   = useState({ template: 'standard', footer: '', showGst: true });
  const [invSaving, setInvSaving] = useState(false);
  const [invMsg,    setInvMsg]    = useState('');

  // Password
  const [pwForm,   setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg,    setPwMsg]    = useState('');
  const [pwErr,    setPwErr]    = useState('');

  useEffect(() => { loadShop(); }, []);

  const loadShop = async () => {
    try {
      const { data } = await api.get('/api/shop/profile');
      setShop(data);
      setShopForm({
        name:     data.name     || '',
        phone:    data.phone    || '',
        email:    data.email    || '',
        address:  data.address  || '',
        upiId:    data.upiId    || '',
        currency: data.currency || 'Rs.',
      });

      if (data.invoiceSettings) {
        try {
          const inv = JSON.parse(data.invoiceSettings);
          setInvForm({
            template: inv.template || 'standard',
            footer: inv.footer || '',
            showGst: inv.showGst !== false
          });
        } catch (e) {}
      }
    } catch (e) { console.error(e); }
  };

  const saveInvoiceSettings = async () => {
    setInvSaving(true); setInvMsg('');
    try {
      await api.put('/api/shop/invoice-settings', { invoiceSettings: JSON.stringify(invForm) });
      setInvMsg('✓ Invoice settings saved!');
      setTimeout(() => setInvMsg(''), 3000);
    } catch (e: any) {
      setInvMsg('✗ Failed to save invoice settings');
    } finally { setInvSaving(false); }
  };

  const saveShop = async () => {
    setShopSaving(true); setShopMsg('');
    try {
      await api.put('/api/shop/profile', shopForm);
      setShopMsg('✓ Shop profile saved!');
      setTimeout(() => setShopMsg(''), 3000);
    } catch (e: any) {
      setShopMsg('✗ ' + (e.response?.data?.error || 'Failed to save'));
    } finally { setShopSaving(false); }
  };

  const savePassword = async () => {
    setPwErr(''); setPwMsg('');
    if (!pwForm.currentPassword)     { setPwErr('Enter current password'); return; }
    if (pwForm.newPassword.length < 6) { setPwErr('New password must be at least 6 characters'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwErr('Passwords do not match'); return; }
    setPwSaving(true);
    try {
      await api.put('/api/auth/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg('✓ Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPwMsg(''), 3000);
    } catch (e: any) {
      setPwErr(e.response?.data?.error || 'Failed to change password');
    } finally { setPwSaving(false); }
  };

  const card: React.CSSProperties  = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, marginBottom: 16 };
  const cardHead: React.CSSProperties = { padding: '16px 20px', borderBottom: `1px solid ${theme.border}` };
  const cardBody: React.CSSProperties = { padding: '20px' };
  const inp: React.CSSProperties = { background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, padding: '10px 13px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 5 };

  const themeOptions: { name: ThemeName; label: string; preview: string[]; desc: string }[] = [
    { name: 'dark',   label: 'Dark',   preview: ['#0f0f12','#15151d','#a78bfa'], desc: 'Classic dark mode'  },
    { name: 'light',  label: 'Light',  preview: ['#f1f5f9','#ffffff','#7c3aed'], desc: 'Clean light mode'   },
    { name: 'purple', label: 'Purple', preview: ['#13111a','#1a1625','#c084fc'], desc: 'Deep purple night'  },
    { name: 'ocean',  label: 'Ocean',  preview: ['#0a1628','#0f1e35','#38bdf8'], desc: 'Deep ocean blue'    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Settings</h2>
        <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>Manage your shop profile and preferences</p>
      </div>

      {/* ── Shop Profile ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>Shop Profile</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Basic information about your shop</div>
        </div>
        <div style={cardBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { l: 'Shop Name',    k: 'name',    ph: 'e.g. Kirana King' },
              { l: 'Phone',        k: 'phone',   ph: '03xx-xxxxxxx' },
              { l: 'Email',        k: 'email',   ph: 'shop@email.com', type: 'email' },
              { l: 'Currency',     k: 'currency',ph: 'Rs.' },
            ].map(({ l, k, ph, type }) => (
              <div key={k}>
                <label style={lbl}>{l}</label>
                <input type={type || 'text'} value={(shopForm as any)[k]} placeholder={ph}
                  onChange={e => setShopForm(v => ({ ...v, [k]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Address</label>
              <input value={shopForm.address} placeholder="Full shop address"
                onChange={e => setShopForm(v => ({ ...v, address: e.target.value }))} style={inp} />
            </div>
          </div>
        </div>
      </div>

      {/* ── UPI Payment ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>💳 UPI Payment</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
            Your UPI ID is shown on the QR code in POS when customer pays by UPI
          </div>
        </div>
        <div style={cardBody}>
          <label style={lbl}>UPI ID</label>
          <input value={shopForm.upiId} placeholder="e.g. shopname@gpay or 03001234567@easypaisa"
            onChange={e => setShopForm(v => ({ ...v, upiId: e.target.value }))} style={inp} />
          {shopForm.upiId && (
            <div style={{ marginTop: 10, background: theme.hover, borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>UPI ID set: <span style={{ fontFamily: 'monospace', color: theme.accent }}>{shopForm.upiId}</span></div>
                <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>This will appear on QR codes and payment requests in POS</div>
              </div>
            </div>
          )}
          {shopMsg && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 9, background: shopMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: shopMsg.startsWith('✓') ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
              {shopMsg}
            </div>
          )}
          <button onClick={saveShop} disabled={shopSaving}
            style={{ marginTop: 16, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '11px 28px', borderRadius: 10, fontWeight: 700, cursor: shopSaving ? 'not-allowed' : 'pointer', opacity: shopSaving ? 0.7 : 1 }}>
            {shopSaving ? 'Saving...' : 'Save Shop Profile'}
          </button>
        </div>
      </div>

      {/* ── Invoice Structure ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>🧾 Invoice Layout & Structure</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Customize how your bills look like (Standard vs Cafe Thermal)</div>
        </div>
        <div style={cardBody}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Layout Template</label>
              <select value={invForm.template} onChange={e => setInvForm(v => ({ ...v, template: e.target.value }))} style={inp}>
                <option value="standard" style={{background: theme.card || '#111827'}}>Standard Layout (A5 Receipt)</option>
                <option value="thermal" style={{background: theme.card || '#111827'}}>Small Thermal Layout (58mm Roll)</option>
              </select>
            </div>

            <div>
              <label style={lbl}>Custom Footer / Notes</label>
              <input value={invForm.footer} placeholder="e.g. Thank you for visiting! | WiFi: Caffe123"
                onChange={e => setInvForm(v => ({ ...v, footer: e.target.value }))} style={inp} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={invForm.showGst} onChange={e => setInvForm(v => ({ ...v, showGst: e.target.checked }))} style={{ cursor: 'pointer' }} id="showGst" />
              <label htmlFor="showGst" style={{ fontSize: 13, color: theme.text, cursor: 'pointer' }}>Print Shop GST on Bill</label>
            </div>
          </div>

          {invMsg && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 9, background: invMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: invMsg.startsWith('✓') ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
              {invMsg}
            </div>
          )}

          <button onClick={saveInvoiceSettings} disabled={invSaving}
            style={{ marginTop: 16, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '11px 28px', borderRadius: 10, fontWeight: 700, cursor: invSaving ? 'not-allowed' : 'pointer', opacity: invSaving ? 0.7 : 1 }}>
            {invSaving ? 'Saving...' : 'Save Invoice Configuration'}
          </button>
        </div>
      </div>

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>Appearance</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Choose your interface theme</div>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {themeOptions.map(t => (
            <div key={t.name} onClick={() => setTheme(t.name)}
              style={{ border: `2px solid ${themeName === t.name ? theme.accent : theme.border}`, borderRadius: 12, padding: 16, cursor: 'pointer', background: themeName === t.name ? theme.accentBg : 'transparent', transition: 'all .15s' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {t.preview.map((c, i) => (
                  <div key={i} style={{ width: i === 0 ? 40 : i === 1 ? 28 : 18, height: 26, borderRadius: 6, background: c, border: '1px solid rgba(128,128,128,.2)' }} />
                ))}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{t.label}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{t.desc}</div>
              {themeName === t.name && <div style={{ fontSize: 11, color: theme.accent, fontWeight: 700, marginTop: 6 }}>● Active</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Account ──────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>Account</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Logged in as {user?.name} ({user?.email})</div>
        </div>
        <div style={cardBody}>
          <div style={{ fontWeight: 600, fontSize: 13, color: theme.text, marginBottom: 14 }}>Change Password</div>
          {pwErr && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{pwErr}</div>}
          {pwMsg && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', color: '#10b981', fontSize: 13, marginBottom: 14 }}>{pwMsg}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { l: 'Current Password',  k: 'currentPassword' },
              { l: 'New Password',      k: 'newPassword' },
              { l: 'Confirm Password',  k: 'confirmPassword' },
            ].map(({ l, k }) => (
              <div key={k}>
                <label style={lbl}>{l}</label>
                <input type="password" value={(pwForm as any)[k]}
                  onChange={e => setPwForm(v => ({ ...v, [k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <button onClick={savePassword} disabled={pwSaving}
            style={{ marginTop: 16, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '11px 28px', borderRadius: 10, fontWeight: 700, cursor: pwSaving ? 'not-allowed' : 'pointer', opacity: pwSaving ? 0.7 : 1 }}>
            {pwSaving ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* ── Subscription & PRO Features ─────────────────────────────── */}
      <div style={{ ...card, background: 'linear-gradient(145deg, rgba(124,58,237,0.05), rgba(59,130,246,0.05))', borderColor: '#7c3aed', marginBottom: 20 }}>
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.text, margin: 0 }}>
                {shop?.plan === 'PRO' ? '💎 ShopOS PRO' : '🚀 Upgrade to PRO'}
              </h2>
              <span style={{ 
                background: shop?.plan === 'PRO' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#7c3aed,#3b82f6)', 
                color: 'white', borderRadius: 8, padding: '2px 10px', fontSize: 10, fontWeight: 900 
              }}>
                {shop?.plan || 'STARTER'}
              </span>
            </div>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>
              {shop?.plan === 'PRO' 
                ? 'All premium features are active for your shop. Thank you for your support!' 
                : 'Unlock AI Analytics, WhatsApp integration, and unlimited staff management.'}
            </p>
            {shop?.plan !== 'PRO' && (
              <div style={{ display: 'flex', gap: 15, marginTop: 12 }}>
                <span style={{ fontSize: 11, color: theme.textFaint }}>✓ 10+ Staff Members</span>
                <span style={{ fontSize: 11, color: theme.textFaint }}>✓ AI Sales Prediction</span>
                <span style={{ fontSize: 11, color: theme.textFaint }}>✓ WhatsApp Invoices</span>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <button 
              onClick={() => {
                const newPlan = shop?.plan === 'PRO' ? 'STARTER' : 'PRO';
                if (confirm(`Simulate ${newPlan === 'PRO' ? 'Upgrade' : 'Downgrade'} to ${newPlan}?`)) {
                  api.post('/api/shop/upgrade', { plan: newPlan }).then(() => {
                    loadShop();
                  });
                }
              }}
              style={{
                background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', 
                color: 'white', border: 'none', padding: '10px 22px', 
                borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(124,58,237,0.3)'
              }}>
              {shop?.plan === 'PRO' ? 'Manage Billing' : 'Upgrade Now →'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 10px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: theme.textFaint }}>
          ShopOS Version 1.0.4 • Made with ❤️ in Pakistan
        </div>
      </div>
    </div>
  );
}
