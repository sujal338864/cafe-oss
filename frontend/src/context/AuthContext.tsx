'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  // Franchise Mode fields
  organizations: Array<{
    orgId: string;
    orgName: string;
    orgRole: string;
  }>;
  isInFranchiseMode: boolean;
  onboardingCompleted: boolean;
  selectedMode: string;
}

interface Shop { id: string; name: string; plan: string; organizationId?: string; }

interface AuthContextType {
  user:    User | null;
  shop:    Shop | null;
  token:   string | null;
  loading: boolean;
  login:   (user: User, shop: Shop, token: string) => void;
  logout:  () => void;
  switchShop: (shopId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user,    setUser]    = useState<User | null>(null);
  const [shop,    setShop]    = useState<Shop | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Restore session on mount — optimistic load from localStorage, verified by HttpOnly cookie
  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/api/auth/me').then(r => r.data),
    staleTime: 5 * 60 * 1000,   // 5 minutes — no re-fetch within this window
    refetchOnWindowFocus: false,  // Don't re-validate on every tab switch (saves egress)
    refetchOnReconnect: false,    // Don't re-validate on every network reconnect
    retry: 1,
  });

  const refreshUser = async () => {
    try {
      const res = await api.get('/api/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
        setShop(res.data.shop);
        localStorage.setItem('shop_os_user', JSON.stringify(res.data.user));
        localStorage.setItem('shop_os_shop', JSON.stringify(res.data.shop));
        queryClient.setQueryData(['auth-me'], res.data);
      }
    } catch (err) {
      console.error('[Auth] Refresh failed:', err);
    }
  };

  useEffect(() => {
    if (session) {
      setUser(session.user);
      setShop(session.shop);
      if (session.token) setToken(session.token);
      localStorage.setItem('shop_os_user', JSON.stringify(session.user));
      localStorage.setItem('shop_os_shop', JSON.stringify(session.shop));
      setLoading(false);
    } else if (!loadingSession && !session) {
       // Only redirect to login if we ARE in a dashboard path and we KNOW there is no session
       if (window.location.pathname.startsWith('/dashboard')) {
          router.push('/login');
       }
       setLoading(false);
    }
  }, [session, loadingSession, router]);

  // Handle local state restore from session (Optimistic)
  useEffect(() => {
    if (loadingSession) {
      try {
        const u = localStorage.getItem('shop_os_user');
        const s = localStorage.getItem('shop_os_shop');
        if (u && s) {
          setUser(JSON.parse(u));
          setShop(JSON.parse(s));
        }
      } catch (err) {
        localStorage.removeItem('shop_os_user');
        localStorage.removeItem('shop_os_shop');
      }
    }
  }, [loadingSession]);

  const login = (user: User, shop: Shop, token: string) => {
    localStorage.setItem('shop_os_user', JSON.stringify(user));
    localStorage.setItem('shop_os_shop', JSON.stringify(shop));
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
        
        setUser(newUser);
        setShop(newShop);
        setToken(newToken);

        // Full refresh to clear all tenant-scoped state across all components
        window.location.href = '/dashboard'; 
      }
    } catch (err: any) {
      console.error('[Auth] Shop switch failed:', err);
      // If we get a 403, it means our frontend list was out of sync. FORCE REFRESH.
      if (err.response?.status === 403) {
        await refreshUser();
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
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
    <AuthContext.Provider value={{ user, shop, token, loading, login, logout, switchShop, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}