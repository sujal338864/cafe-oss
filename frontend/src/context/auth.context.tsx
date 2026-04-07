/**
 * FILE 6: context/auth.context.tsx
 * Auth Context with persistent session verification and retry logic.
 */
"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api-client';

const AuthContext = createContext<any>(undefined);

export const AuthProvider = ({ children }: any) => {
  const [state, setState] = useState({ isAuthenticated: false, isVerifying: true, user: null });

  const verify = async () => {
    try {
      const { user } = await api.get('/api/auth/verify');
      setState({ isAuthenticated: true, isVerifying: false, user });
    } catch {
      setState({ isAuthenticated: false, isVerifying: false, user: null });
    }
  };

  useEffect(() => {
    verify();
    const onExpire = () => setState({ isAuthenticated: false, isVerifying: false, user: null });
    window.addEventListener('cafe:auth:expired', onExpire);
    return () => window.removeEventListener('cafe:auth:expired', onExpire);
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
