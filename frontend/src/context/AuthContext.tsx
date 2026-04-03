'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface User { 
  id: string; 
  name: string; 
  email: string; 
  plan: string; 
  shopLimit: number; 
}

interface ShopMembership { 
  id: string; 
  name: string; 
  plan: string; 
  role: string; 
  isActive?: boolean;
}

interface AuthContextType {
  user:         User | null;
  shops:        ShopMembership[];
  activeShop:   ShopMembership | null;
  token:        string | null;
  loading:      boolean;
  login:        (token: string, user: User, shops: ShopMembership[]) => void;
  logout:       () => void;
  switchShop:   (shopId: string) => void;
  getActivePlan: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<ShopMembership[]>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem('shop_os_token');
      const u = localStorage.getItem('shop_os_user');
      const s = localStorage.getItem('shop_os_shops');
      const activeId = localStorage.getItem('active_shop_id');
      
      if (t && u && s) {
        setToken(t);
        setUser(JSON.parse(u));
        const parsedShops = JSON.parse(s);
        setShops(parsedShops);
        setActiveShopId(activeId || (parsedShops.length > 0 ? parsedShops[0].id : null));
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const login = (token: string, user: User, shops: ShopMembership[]) => {
    const defaultShopId = shops.length > 0 ? shops[0].id : null;
    
    localStorage.setItem('shop_os_token', token);
    localStorage.setItem('shop_os_user', JSON.stringify(user));
    localStorage.setItem('shop_os_shops', JSON.stringify(shops));
    if (defaultShopId) localStorage.setItem('active_shop_id', defaultShopId);

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    setToken(token);
    setUser(user);
    setShops(shops);
    setActiveShopId(defaultShopId);
  };

  const logout = () => {
    localStorage.removeItem('shop_os_token');
    localStorage.removeItem('shop_os_user');
    localStorage.removeItem('shop_os_shops');
    localStorage.removeItem('active_shop_id');
    
    delete api.defaults.headers.common['Authorization'];
    
    setToken(null);
    setUser(null);
    setShops([]);
    setActiveShopId(null);
    router.push('/login');
  };

  const switchShop = (shopId: string) => {
    localStorage.setItem('active_shop_id', shopId);
    setActiveShopId(shopId);
    // Reload to re-fetch all data with new X-Shop-Id context
    window.location.reload();
  };

  const activeShop = shops.find(s => s.id === activeShopId) || (shops.length > 0 ? shops[0] : null);

  const getActivePlan = () => {
    if (!activeShop) return 'STARTER';
    return activeShop.plan;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      shops, 
      activeShop, 
      token, 
      loading, 
      login, 
      logout, 
      switchShop, 
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