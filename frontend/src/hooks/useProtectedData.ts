/**
 * FILE 7: hooks/useProtectedData.ts
 * Hook for data fetching that waits for authentication and handles "server wake" state.
 */
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../context/auth.context';
import { api } from '../lib/api-client';

export function useProtectedData<T>(url: string, options?: any) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = async (signal?: AbortSignal) => {
    if (!isAuthenticated) return;
    setLoading(true); setWaking(false);
    try {
      const response = await api.get(url, { signal });
      setData(response);
    } catch (err: any) {
      if (err.message.includes('RETRYABLE')) setWaking(true);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ab = new AbortController();
    if (isAuthenticated) fetch(ab.signal);
    return () => ab.abort();
  }, [url, isAuthenticated]);

  return { data, loading, waking, error, refetch: () => fetch() };
}
