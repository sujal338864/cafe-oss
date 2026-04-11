'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface User { 
  id: string; 
  name: string; 
  email: string; 
  role: string; 
  shopId?: string; 
  memberships: Array<{
    shopId: string;
    shopName: string;
    role: string;
  }>;
}

interface Shop { id: string; name: string; plan: string; }

interface AuthContextType {
  user:    User | null;
  shop:    Shop | null;
  token:   string | null;
  loading: boolean;
  login:   (user: User, shop: Shop, token: string) => void;
  logout:  () => void;
  switchShop: (shopId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user,    setUser]    = useState<User | null>(null);
  const [shop,    setShop]    = useState<Shop | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount — optimistic load from localStorage, verified by HttpOnly cookie
  useEffect(() => {
    try {
      const u = localStorage.getItem('shop_os_user');
      const s = localStorage.getItem('shop_os_shop');
      if (u && s) {
        setUser(JSON.parse(u));
        setShop(JSON.parse(s));
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn('[Auth] Cleared corrupt localStorage:', err);
      localStorage.removeItem('shop_os_user');
      localStorage.removeItem('shop_os_shop');
      setUser(null);
      setShop(null);
    }

    // Ping backend to verify HttpOnly cookie is valid
    api.get('/api/auth/me')
      .then(res => {
        const { user: newUser, shop: newShop, token: newToken } = res.data;
        setUser(newUser);
        setShop(newShop);
        if (newToken) {
          setToken(newToken);
          localStorage.setItem('shop_os_token', newToken);
        }
        localStorage.setItem('shop_os_user', JSON.stringify(newUser));
        localStorage.setItem('shop_os_shop', JSON.stringify(newShop));
      })
      .catch((err) => {
        // If 401/404, cookie is missing or invalid -> clear local state
        setUser(null);
        setShop(null);
        localStorage.removeItem('shop_os_user');
        localStorage.removeItem('shop_os_shop');
        if (window.location.pathname.startsWith('/dashboard')) router.push('/login');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (user: User, shop: Shop, token: string) => {
    localStorage.setItem('shop_os_user', JSON.stringify(user));
    localStorage.setItem('shop_os_shop', JSON.stringify(shop));
    localStorage.setItem('shop_os_token', token);
    setUser(user);
    setShop(shop);
    setToken(token);
  };

  const switchShop = async (shopId: string) => {
    try {
      setLoading(true);
      const res = await api.post('/api/auth/switch', { shopId });
      if (res.data.success) {
        const { user: newUser, shop: newShop, token: newToken } = res.data;
        // Update local state with new shop info AND new token
        localStorage.setItem('shop_os_user', JSON.stringify(newUser));
        localStorage.setItem('shop_os_shop', JSON.stringify(newShop));
        localStorage.setItem('shop_os_token', newToken);
        
        setUser(newUser);
        setShop(newShop);
        setToken(newToken);

        // Full refresh to clear all tenant-scoped state across all components
        window.location.href = '/dashboard'; 
      }
    } catch (err) {
      console.error('[Auth] Shop switch failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('shop_os_token'); 
    localStorage.removeItem('shop_os_user');
    localStorage.removeItem('shop_os_shop');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setShop(null);
    
    try {
      await api.post('/api/auth/logout');
    } catch { /* ignore */ }
    
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, shop, token, loading, login, logout, switchShop }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}