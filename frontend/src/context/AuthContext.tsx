'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface User { id: string; name: string; email: string; role: string; shopId?: string; }
interface Shop { id: string; name: string; plan: string; }

interface AuthContextType {
  user:    User | null;
  shop:    Shop | null;
  token:   string | null;
  loading: boolean;
  login:   (user: User, shop: Shop) => void;
  logout:  () => void;
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
        setUser(res.data.user);
        setShop(res.data.shop);
        localStorage.setItem('shop_os_user', JSON.stringify(res.data.user));
        localStorage.setItem('shop_os_shop', JSON.stringify(res.data.shop));
      })
      .catch((err) => {
        // If 401/404, cookie is missing or invalid -> clear local state
        setUser(null);
        setShop(null);
        localStorage.removeItem('shop_os_user');
        localStorage.removeItem('shop_os_shop');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (user: User, shop: Shop) => {
    localStorage.setItem('shop_os_user', JSON.stringify(user));
    localStorage.setItem('shop_os_shop', JSON.stringify(shop));
    setUser(user);
    setShop(shop);
  };

  const logout = async () => {
    localStorage.removeItem('shop_os_token'); // Cleanup old local tokens if they exist
    localStorage.removeItem('shop_os_user');
    localStorage.removeItem('shop_os_shop');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setShop(null);
    
    try {
      await api.post('/api/auth/logout'); // Tell server to clear HttpOnly cookie
    } catch { /* ignore */ }
    
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, shop, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}