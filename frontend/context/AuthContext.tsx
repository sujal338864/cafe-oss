'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

interface User { id: string; name: string; email: string; role: string; shopId?: string; }
interface Shop { id: string; name: string; plan: string; }
interface AuthContextType {
  user: User | null; shop: Shop | null; token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void; loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const t = localStorage.getItem('shop_os_token');
      const u = localStorage.getItem('shop_os_user');
      const s = localStorage.getItem('shop_os_shop');
      if (t && u && s) { setToken(t); setUser(JSON.parse(u)); setShop(JSON.parse(s)); }
    } catch {}
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await axios.post(`\C:\Users\Lenovo\Downloads\files\frontend\src\app\dashboard/api/auth/login`, { email, password });
    localStorage.setItem('shop_os_token', data.token);
    localStorage.setItem('shop_os_user', JSON.stringify(data.user));
    localStorage.setItem('shop_os_shop', JSON.stringify(data.shop));
    setToken(data.token); setUser(data.user); setShop(data.shop);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('shop_os_token');
    localStorage.removeItem('shop_os_user');
    localStorage.removeItem('shop_os_shop');
    setToken(null); setUser(null); setShop(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, shop, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
