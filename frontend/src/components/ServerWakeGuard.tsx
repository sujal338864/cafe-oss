/**
 * FILE 8: components/ServerWakeGuard.tsx
 * Safety component that handles full-screen verification states and server waking banners.
 */
"use client";

import { useAuth } from '../context/auth.context';

export const ServerWakeGuard = ({ children, waking }: { children: any, waking?: boolean }) => {
  const auth = useAuth();
  if (!auth || auth.isVerifying) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#09090b', color: '#fff', zIndex: 9999 }}>
        <div style={{ width: 40, height: 40, border: '4px solid #333', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
        <div style={{ fontWeight: 600 }}>Verifying session...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  return (
    <>
      {waking && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#f59e0b', color: '#000', padding: '12px 20px', textAlign: 'center', fontWeight: 700, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 16, height: 16, border: '3px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          ☕ Server is waking up — your data will load shortly
        </div>
      )}
      {children}
    </>
  );
};
