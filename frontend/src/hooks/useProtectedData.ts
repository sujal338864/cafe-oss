/**
 * FILE 7: hooks/useProtectedData.ts
 * Hook for data fetching that waits for authentication and handles "server wake" state.
 */
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export function useProtectedData<T>(url: string, options?: any) {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true); setWaking(false);
    try {
      const response = await api.get(url, { signal });
      setData(response.data);
    } catch (err: any) {
      if (err.message && err.message.includes('RETRYABLE')) setWaking(true);
      setError(err.message || 'Error fetching');
    } finally {
      setLoading(false);
    }
  }, [url, user]);

  useEffect(() => {
    const ab = new AbortController();
    if (user) fetchData(ab.signal);
    return () => ab.abort();
  }, [user, fetchData]);

  return { data, loading, waking, error, refetch: () => fetchData() };
}
