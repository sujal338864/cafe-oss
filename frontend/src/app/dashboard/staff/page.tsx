'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const ROLES = [
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
];

export default function StaffPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.role === 'EMPLOYEE') {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => { 
    if (user && user.role !== 'EMPLOYEE') {
      loadUsers(); 
    }
  }, [user]);

  if (!user || user.role === 'EMPLOYEE') {
    return null; 
  }

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/api/users');
      setUsers(data);
    } catch (e) { console.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/api/users', { name, email, role, password });
      setShowAdd(false);
      resetForm();
      loadUsers();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.put(`/api/users/${editing.id}`, { name, role, password: password || undefined });
      setEditing(null);
      resetForm();
      loadUsers();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update user');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will permanently remove access for this staff member.')) return;
    try {
      await api.delete(`/api/users/${id}`);
      loadUsers();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete user');
    }
  };

  const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setRole('EMPLOYEE'); setError('');
  };

  const openEdit = (user: any) => {
    setEditing(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPassword('');
  };

  const inp: React.CSSProperties = {
    background: theme.input, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 10, padding: '10px 14px',
    fontSize: 14, width: '100%', outline: 'none', marginBottom: 14
  };

  const modalBg: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: theme.text, margin: 0 }}>Staff Management</h1>
          <p style={{ color: theme.textFaint, fontSize: 13, marginTop: 4 }}>Manage roles and passwords for your team.</p>
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true); }}
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Add New Staff
        </button>
      </div>

      {/* Staff List */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: theme.sidebar, color: theme.textFaint, textAlign: 'left' }}>
              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Email</th>
              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '14px 20px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>Loading staff members...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>No staff members found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ borderTop: `1px solid ${theme.border}`, color: theme.text }}>
                <td style={{ padding: '14px 20px', fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: '14px 20px' }}>{u.email}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ 
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                    background: u.role === 'ADMIN' ? 'rgba(124,58,237,0.15)' : u.role === 'MANAGER' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                    color: u.role === 'ADMIN' ? '#7c3aed' : u.role === 'MANAGER' ? '#3b82f6' : '#10b981'
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ color: u.isActive ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: 600 }}>
                    {u.isActive ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => openEdit(u)} style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.text, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                    {u.role !== 'ADMIN' && (
                      <button onClick={() => handleDelete(u.id)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAdd || editing) && (
        <div style={modalBg}>
          <form onSubmit={editing ? handleUpdate : handleAdd} style={{ background: theme.card, border: `1px solid ${theme.border}`, padding: 30, borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 6 }}>{editing ? 'Edit Staff member' : 'Add New Staff'}</h2>
            <p style={{ color: theme.textFaint, fontSize: 13, marginBottom: 20 }}>
              {editing ? `Updating profile for ${editing.email}` : 'Invite a new member to join your shop.'}
            </p>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <label style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, marginBottom: 6, display: 'block' }}>FULL NAME</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="John Doe" style={inp} />

            {!editing && (
              <>
                <label style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, marginBottom: 6, display: 'block' }}>EMAIL ADDRESS</label>
                <input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="john@example.com" style={inp} />
              </>
            )}

            <label style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, marginBottom: 6, display: 'block' }}>{editing ? 'RESET PASSWORD (Optional)' : 'PASSWORD'}</label>
            <input value={password} onChange={e => setPassword(e.target.value)} required={!editing} type="password" placeholder={editing ? 'Leave blank to keep current' : '••••••••'} style={inp} />

            <label style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, marginBottom: 6, display: 'block' }}>ROLE</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              {editing?.role === 'ADMIN' && <option value="ADMIN">Admin</option>}
            </select>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={() => { setShowAdd(false); setEditing(null); }}
                style={{ flex: 1, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted, padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: 'white', border: 'none', padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Update Staff' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
