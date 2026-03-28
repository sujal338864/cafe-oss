'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',  icon: '▦' },
  { href: '/dashboard/pos',        label: 'New Sale',   icon: '⊕' },
  { href: '/dashboard/kitchen',    label: 'Kitchen',    icon: '🍳' },
  { href: '/dashboard/products',   label: 'Products',   icon: '📦' },
  { href: '/dashboard/categories', label: 'Categories', icon: '🏷️' },
  { href: '/dashboard/orders',     label: 'Orders',     icon: '🧾' },
  { href: '/dashboard/customers',  label: 'Customers',  icon: '👤' },
  { href: '/dashboard/suppliers',  label: 'Suppliers',  icon: '🚚' },
  { href: '/dashboard/purchases',  label: 'Purchases',  icon: '🛒' },
  { href: '/dashboard/expenses',   label: 'Expenses',   icon: '💸' },
  { href: '/dashboard/analytics',  label: 'Analytics',  icon: '📊' },
  { href: '/dashboard/qr',         label: 'QR Codes',   icon: '📱' },
  { href: '/dashboard/settings',   label: 'Settings',   icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { socket } = useSocket();

  // Low-stock badge
  const [lowStock,      setLowStock]      = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [shopName,      setShopName]      = useState('My Shop');

  const fetchLowStock = useCallback(async () => {
    try {
      const { data } = await api.get('/api/analytics/dashboard');
      setLowStock(Number(data.lowStockItems || 0));
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/api/notifications?limit=20');
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n: any) => !n.isRead).length);
    } catch {}
  }, []);

  // Fetch ONCE on mount — then rely on WebSocket for instant updates (saves ~2GB/month)
  useEffect(() => {
    fetchLowStock();
    fetchNotifications();
  }, [fetchLowStock, fetchNotifications]);

  // WebSocket: instant push updates instead of polling (FASTER + zero egress)
  useEffect(() => {
    if (!socket) return;
    const refresh = () => { fetchLowStock(); fetchNotifications(); };
    socket.on('ORDER_CREATED', refresh);
    socket.on('ORDER_UPDATED', refresh);
    socket.on('NOTIFICATION', fetchNotifications);
    return () => {
      socket.off('ORDER_CREATED', refresh);
      socket.off('ORDER_UPDATED', refresh);
      socket.off('NOTIFICATION', fetchNotifications);
    };
  }, [socket, fetchLowStock, fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const totalBadge = unreadCount + (lowStock > 0 ? 1 : 0);

  const s = {
    sidebar: {
      width: 210, flexShrink: 0, background: theme.sidebar,
      borderRight: `1px solid ${theme.border}`,
      display: 'flex', flexDirection: 'column' as const,
      height: '100vh', position: 'sticky' as const, top: 0,
    },
    main: {
      flex: 1, background: theme.bg, minHeight: '100vh',
      display: 'flex', flexDirection: 'column' as const,
    },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg }}>

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside style={s.sidebar}>
        {/* Shop name */}
        <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: 14, flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Shop OS</div>
              <div style={{ fontSize: 11, color: theme.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Admin'}</div>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            const isProducts = href === '/dashboard/products';
            return (
              <a key={href} href={href}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, marginBottom: 2, textDecoration: 'none', background: active ? 'linear-gradient(135deg,rgba(124,58,237,.25),rgba(59,130,246,.15))' : 'transparent', color: active ? '#a78bfa' : theme.textMuted, fontWeight: active ? 700 : 500, fontSize: 13, transition: 'all .15s', position: 'relative' }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = theme.hover; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {/* Low stock badge on Products */}
                {isProducts && lowStock > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 10, fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{lowStock}</span>
                )}
                {active && <span style={{ width: 3, height: 20, borderRadius: 99, background: '#7c3aed', position: 'absolute', right: 0 }} />}
              </a>
            );
          })}
        </nav>

        {/* Bottom — theme toggle + sign out */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'none', border: `1px solid ${theme.border}`, color: theme.textMuted, cursor: 'pointer', fontSize: 12, fontWeight: 600, width: '100%' }}>
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: theme.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
            </div>
          </div>
          <button onClick={logout}
            style={{ width: '100%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', padding: '8px 0', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main style={s.main}>
        {/* Top bar */}
        <div style={{ background: theme.sidebar, borderBottom: `1px solid ${theme.border}`, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ fontSize: 13, color: theme.textFaint }}>
            {NAV.find(n => n.href === pathname || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label || 'Dashboard'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Notification bell */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotifs(v => !v); if (!showNotifs) markAllRead(); }}
                style={{ background: theme.hover, border: `1px solid ${theme.border}`, borderRadius: 9, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
                🔔
                {totalBadge > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 9, fontWeight: 900, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>
                    {totalBadge > 9 ? '9+' : totalBadge}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {showNotifs && (
                <div style={{ position: 'absolute', top: 44, right: 0, width: 320, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', zIndex: 500, overflow: 'hidden' }}
                  onMouseLeave={() => setShowNotifs(false)}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Mark all read</button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {/* Low stock warning */}
                    {lowStock > 0 && (
                      <a href="/dashboard/products" style={{ display: 'block', padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, textDecoration: 'none', background: 'rgba(239,68,68,0.05)' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Low Stock Alert</div>
                            <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 2 }}>{lowStock} product{lowStock > 1 ? 's are' : ' is'} running low on stock</div>
                          </div>
                        </div>
                      </a>
                    )}
                    {notifications.length === 0 && lowStock === 0 && (
                      <div style={{ padding: 28, textAlign: 'center', color: theme.textFaint, fontSize: 13 }}>All clear! No notifications.</div>
                    )}
                    {notifications.slice(0, 8).map((n: any) => (
                      <div key={n.id} style={{ padding: '11px 16px', borderBottom: `1px solid ${theme.border}`, background: n.isRead ? 'transparent' : 'rgba(124,58,237,0.05)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          {!n.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', flexShrink: 0, marginTop: 4 }} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: n.isRead ? 400 : 600, color: theme.text }}>{n.title || n.message || 'Notification'}</div>
                            <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 2 }}>{new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Starter badge */}
            <div style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 800, color: 'white' }}>STARTER</div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
