'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

export default function ShopSettingsPage() {
  const { theme } = useTheme();
  const { user, activeShop } = useAuth() as any;

  // Shop Profile State
  const [shopForm, setShopForm] = useState({ name: '', phone: '', email: '', address: '', upiId: '', currency: 'Rs.' });
  const [shopSaving, setShopSaving] = useState(false);
  const [shopMsg, setShopMsg] = useState('');

  // Team Management State
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    loadShop();
    loadMembers();
  }, [activeShop?.id]);

  const loadShop = async () => {
    try {
      const { data } = await api.get('/api/shop/profile');
      setShopForm({
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        upiId: data.upiId || '',
        currency: data.currency || 'Rs.',
      });
    } catch (e) { console.error('[ShopSettings] loadShop failed:', e); }
  };

  const loadMembers = async () => {
    setMembersLoading(true);
    try {
      const { data } = await api.get('/api/shop/members');
      setMembers(data.members);
    } catch (e) {
      console.error('[ShopSettings] loadMembers failed:', e);
    } finally { setMembersLoading(false); }
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

  const updateMemberRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/api/shop/members/${userId}`, { role: newRole });
      loadMembers(); // Refresh list
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to update role');
    }
  };

  const removeMember = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/api/shop/members/${userId}`);
      loadMembers();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to remove member');
    }
  };

  // Styles
  const cardStyle: React.CSSProperties = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, marginBottom: 20, overflow: 'hidden' };
  const cardHeadStyle: React.CSSProperties = { padding: '16px 20px', borderBottom: `1px solid ${theme.border}` };
  const cardBodyStyle: React.CSSProperties = { padding: '20px' };
  const inputStyle: React.CSSProperties = { background: theme.inputBg, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, padding: '10px 13px', fontSize: 13, width: '100%', outline: 'none' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 };
  const btnStyle: React.CSSProperties = { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: theme.text }}>🏪 Shop Settings</h2>
        <p style={{ fontSize: 14, color: theme.textMuted, marginTop: 4 }}>Configure your branch details and manage your team/roles.</p>
      </div>

      {/* ── Shop Profile ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardHeadStyle}>
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>Profile Information</div>
        </div>
        <div style={cardBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Shop Name</label>
              <input value={shopForm.name} onChange={e => setShopForm(v => ({ ...v, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input value={shopForm.phone} onChange={e => setShopForm(v => ({ ...v, phone: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={shopForm.email} onChange={e => setShopForm(v => ({ ...v, email: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <input value={shopForm.currency} onChange={e => setShopForm(v => ({ ...v, currency: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Full Address</label>
              <input value={shopForm.address} onChange={e => setShopForm(v => ({ ...v, address: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          {shopMsg && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 9, background: shopMsg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: shopMsg.startsWith('✓') ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
              {shopMsg}
            </div>
          )}
          <button onClick={saveShop} disabled={shopSaving} style={btnStyle}>
            {shopSaving ? 'Saving...' : 'Update Profile'}
          </button>
        </div>
      </div>

      {/* ── Team Management (Role Assignment) ────────────────────────── */}
      <div style={cardStyle}>
        <div style={cardHeadStyle}>
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>👥 Team Management</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Assign roles and manage staff permissions.</div>
        </div>
        <div style={cardBodyStyle}>
          {membersLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading team members...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 11, color: theme.textFaint, textTransform: 'uppercase' }}>Member</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 11, color: theme.textFaint, textTransform: 'uppercase' }}>Role</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px', fontSize: 11, color: theme.textFaint, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: 11, color: theme.textFaint, textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.userId} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: theme.textFaint }}>{m.email}</div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <select 
                          value={m.role} 
                          onChange={(e) => updateMemberRole(m.userId, e.target.value)}
                          disabled={m.userId === user?.id} // Cannot change your own role
                          style={{ ...inputStyle, width: 'auto', padding: '4px 8px' }}>
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="EMPLOYEE">EMPLOYEE</option>
                        </select>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                          background: m.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: m.isActive ? '#10b981' : '#ef4444'
                        }}>
                          {m.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {m.userId !== user?.id && (
                          <button onClick={() => removeMember(m.userId)} 
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
