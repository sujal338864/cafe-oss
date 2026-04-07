/**
 * FILE 9: components/AIInsights.tsx
 * AI Insights display with shimmer and circuit-breaker countdown tracker.
 */
"use client";

import { useProtectedData } from '../hooks/useProtectedData';
import { useState, useEffect } from 'react';

export const AIInsights = () => {
  const { data, loading, waking, error, refetch } = useProtectedData<any>('/api/ai/insights');
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (data?.retryAfter) setCountdown(data.retryAfter);
  }, [data]);

  useEffect(() => {
    if (countdown && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (loading) return (
    <div style={{ background: '#1e1e1e', borderRadius: 12, padding: 24 }}>
      {[1, 2, 3].map(i => <div key={i} style={{ height: 16, background: '#333', marginBottom: 12, borderRadius: 4, animation: 'shimmer 1.5s infinite' }} />)}
      <style>{`@keyframes shimmer { 0% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
    </div>
  );

  if (waking) return (
    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: 12, padding: 24, textAlign: 'center' }}>
      <div style={{ display: 'inline-block', width: 20, height: 20, border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: '#f59e0b', marginTop: 12 }}>AI is warming up...</div>
    </div>
  );

  if (countdown && countdown! > 0) return (
    <div style={{ background: '#1e1e1e', borderRadius: 12, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>AI advisor available in {countdown}s</div>
      <button onClick={refetch} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8 }}>Manual Retry</button>
    </div>
  );

  return (
    <div style={{ background: '#1c1c1c', borderRadius: 14, padding: 28, border: '1px solid #2d2d2d' }}>
      <div style={{ color: '#e5e7eb', lineHeight: 1.6 }}>{data?.insight || 'No insights available.'}</div>
      <button onClick={refetch} style={{ marginTop: 12, color: '#a78bfa', background: 'transparent', border: 'none', cursor: 'pointer' }}>🔄 Refresh</button>
    </div>
  );
};
