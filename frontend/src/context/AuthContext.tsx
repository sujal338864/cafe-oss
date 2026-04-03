'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface User { 
  id: string; 
  name: string; 
  email: string; 
  plan: string; 
  shopId: string; 
}

interface AuthContextType {
  user:         User | null;
  token:        string | null;
  loading:      boolean;
  login:        (token: string, user: User) => void;
  logout:       () => void;
  getActivePlan: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem('shop_os_token');
      const u = localStorage.getItem('shop_os_user');
      
      if (t && u) {
        setToken(t);
        const parsedUser = JSON.parse(u);
        setUser(parsedUser);
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
        // Still setting x-shop-id for backward compatibility with some frontend components
        api.defaults.headers.common['x-shop-id'] = parsedUser.shopId;
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const login = (token: string, user: User) => {
    localStorage.setItem('shop_os_token', token);
    localStorage.setItem('shop_os_user', JSON.stringify(user));
    localStorage.setItem('active_shop_id', user.shopId);

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['x-shop-id'] = user.shopId;
    
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('shop_os_token');
    localStorage.removeItem('shop_os_user');
    localStorage.removeItem('active_shop_id');
    
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['x-shop-id'];
    
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const getActivePlan = () => {
    return user?.plan || 'STARTER';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout,
      getActivePlan 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}