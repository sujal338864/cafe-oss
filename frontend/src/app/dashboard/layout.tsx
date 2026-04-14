'use client';
import { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/lib/api';

const ALL_NAV = [
  { href: '/dashboard',            label: 'Dashboard',  icon: '▦',   roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/pos',        label: 'New Sale',   icon: '⊕',   roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SUPER_ADMIN'] },
  { href: '/dashboard/kitchen',    label: 'Kitchen',    icon: '🍳',  roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SUPER_ADMIN'] },
  { href: '/dashboard/products',   label: 'Products',   icon: '📦',  roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SUPER_ADMIN'] },
  { href: '/dashboard/categories', label: 'Categories', icon: '🏷️',  roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SUPER_ADMIN'] },
  { href: '/dashboard/orders',     label: 'Orders',     icon: '🧾',  roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SUPER_ADMIN'] },
  { href: '/dashboard/customers',  label: 'Customers',  icon: '👤',  roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'SUPER_ADMIN'] },
  { href: '/dashboard/suppliers',  label: 'Suppliers',  icon: '🚚',  roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/purchases',  label: 'Purchases',  icon: '🛒',  roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/expenses',   label: 'Expenses',   icon: '💸',  roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/analytics',  label: 'Analytics',  icon: '📊',  roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/reports',    label: 'Reports',    icon: '📈',  roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/qr',         label: 'QR Codes',   icon: '📱',  roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/staff',      label: 'Staff Management', icon: '👥', roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/dashboard/settings',   label: 'Settings',   icon: '⚙️',  roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/super-admin',          label: 'Admin Portal', icon: '👑', roles: ['SUPER_ADMIN'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, shop, logout, switchShop, loading: authLoading } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Filter nav based on role
  const userRole = user?.role || 'EMPLOYEE';
  const NAV = ALL_NAV.filter(item => item.roles.includes(userRole));

  const [mounted, setMounted] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showShopPicker, setShowShopPicker] = useState(false);


  // Queries
  const { data: megaData } = useQuery({ 
    queryKey: ['mega_dashboard'], 
    queryFn: () => api.get('/api/analytics/dashboard-mega').then(r => r.data),
    staleTime: 5000 // 5s stale time for layout
  });
  const { data: notifData } = useQuery({ 
    queryKey: ['notifications'], 
    queryFn: () => api.get('/api/notifications?limit=20').then(r => r.data) 
  });

  const lowStock = Number(megaData?.stats?.lowStockItems || 0);
  const notifications = notifData?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  useEffect(() => { setMounted(true); }, []);

  // WebSocket: Invalidate queries instead of manual fetch
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['mega_dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    socket.on('ORDER_CREATED', refresh);
    socket.on('ORDER_UPDATED', refresh);
    socket.on('NOTIFICATION', () => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
    return () => {
      socket.off('ORDER_CREATED', refresh);
      socket.off('ORDER_UPDATED', refresh);
      socket.off('NOTIFICATION', refresh);
    };
  }, [socket, queryClient]);

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) {
      console.error('[Layout] markAllRead failed:', e);
    }
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

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.text }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${theme.border}`, borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>Checking session...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!user) return null; // Component will redirect in useEffect

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
            <div style={{ minWidth: 0, flex: 1 }}>
              <button 
                onClick={() => setShowShopPicker(!showShopPicker)}
                style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shop?.name || 'Shop OS'}
                  </div>
                  <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
                    Switch Shop
                  </div>
                </div>
                <div style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontSize: 10, fontWeight: 700 }}>
                  {showShopPicker ? '▲' : '▼'}
                </div>
              </button>

              {/* Shop Switcher Dropdown */}
              {showShopPicker && user?.memberships && user.memberships.length > 0 && (
                <div 
                  style={{ position: 'absolute', top: 58, left: 10, width: 230, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 600, padding: 6 }}
                  onMouseLeave={() => setShowShopPicker(false)}
                >
                  <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Shops</div>
                  {user.memberships.map((m: any) => {
                    const isActive = m.shopId === shop?.id;
                    return (
                      <div 
                        key={m.shopId}
                        onClick={() => { if (!isActive) switchShop(m.shopId); }}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: isActive ? 'default' : 'pointer',
                          background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = theme.hover; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: isActive ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : theme.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: 'white' }}>
                          {m.shopName[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.shopName}</div>
                          <div style={{ fontSize: 10, color: theme.textFaint }}>{m.role}</div>
                        </div>
                        {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed' }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expansion Prompt */}
        {user?.role === 'ADMIN' && (
          <div style={{ padding: '0 10px 10px' }}>
            <button 
              onClick={() => router.push('/dashboard/create-shop')}
              style={{ 
                width: '100%', 
                background: 'rgba(124,58,237,0.1)', 
                border: '1px solid rgba(124,58,237,0.2)', 
                padding: '10px 12px', 
                borderRadius: 10, 
                textAlign: 'left', 
                color: '#a78bfa', 
                fontSize: 12, 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                fontWeight: 700,
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.1)'}
            >
              <div style={{ width: 22, height: 22, borderRadius: 6, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <span style={{ fontSize: 16 }}>+</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, fontWeight: 800 }}>Create New Shop</span>
                <span style={{ fontSize: 9, opacity: 0.7 }}>Expand your empire</span>
              </div>
            </button>
          </div>
        )}


        {/* Nav links */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            const isProducts = href === '/dashboard/products';
            return (
              <Link key={href} href={href}
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
              </Link>
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
                      <Link href="/dashboard/products" style={{ display: 'block', padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, textDecoration: 'none', background: 'rgba(239,68,68,0.05)' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Low Stock Alert</div>
                            <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 2 }}>{lowStock} product{lowStock > 1 ? 's are' : ' is'} running low on stock</div>
                          </div>
                        </div>
                      </Link>
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

            {/* Shop plan badge */}
            <div style={{ 
              background: shop?.plan === 'PRO' 
                ? 'linear-gradient(135deg,#f59e0b,#ef4444)' 
                : 'linear-gradient(135deg,#7c3aed,#3b82f6)', 
              borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 800, color: 'white' 
            }}>
              {shop?.plan || 'STARTER'}
            </div>
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
