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
  login:   (token: string, user: User, shop: Shop) => void;
  logout:  () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user,    setUser]    = useState<User | null>(null);
  const [shop,    setShop]    = useState<Shop | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem('shop_os_token');
      const u = localStorage.getItem('shop_os_user');
      const s = localStorage.getItem('shop_os_shop');
      if (t && u && s) {
        setToken(t);
        setUser(JSON.parse(u));
        setShop(JSON.parse(s));
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const login = (token: string, user: User, shop: Shop) => {
    localStorage.setItem('shop_os_token', token);
    localStorage.setItem('shop_os_user', JSON.stringify(user));
    localStorage.setItem('shop_os_shop', JSON.stringify(shop));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setToken(token);
    setUser(user);
    setShop(shop);
  };

  const logout = () => {
    localStorage.removeItem('shop_os_token');
    localStorage.removeItem('shop_os_user');
    localStorage.removeItem('shop_os_shop');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setShop(null);
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