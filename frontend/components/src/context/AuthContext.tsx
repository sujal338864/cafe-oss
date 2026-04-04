'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

type User = { id: string; name: string; email: string; role: string };
type Shop = { id: string; name: string; plan: string };

type AuthCtx = {
  token: string | null;
  user: User | null;
  shop: Shop | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({
  token: null, user: null, shop: null, loading: true,
  login: async () => {}, logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,   setToken]   = useState<string | null>(null);
  const [user,    setUser]    = useState<User | null>(null);
  const [shop,    setShop]    = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('shop_os_token');
    if (saved) {
      setToken(saved);
      fetchMe(saved);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchMe = async (t: string) => {
    try {
      const { data } = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${t}` },
      });
      setUser(data.user);
      setShop(data.shop);
    } catch {
      localStorage.removeItem('shop_os_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    const { token: t, user: u, shop: s } = data;
    localStorage.setItem('shop_os_token', t);
    setToken(t);
    setUser(u);
    setShop(s);
  };

  const logout = () => {
    localStorage.removeItem('shop_os_token');
    setToken(null);
    setUser(null);
    setShop(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ token, user, shop, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
