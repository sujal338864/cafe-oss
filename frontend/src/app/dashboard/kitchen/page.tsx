'use client';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

type Order = {
  id: string; invoiceNumber: string; status: string; paymentStatus: string;
  paymentMethod: string; totalAmount: number; notes?: string; createdAt: string;
  customer?: { name: string; phone?: string }; customerName?: string;
  tableNumber?: string; items?: { name: string; quantity: number }[];
};

const STATUS_FLOW = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'] as const;
const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string; next: string }> = {
  PENDING:   { label: 'New Orders', emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,.08)',   next: '🔥 Start Preparing' },
  PREPARING: { label: 'Preparing',  emoji: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,.08)', next: '✅ Mark Ready' },
  READY:     { label: 'Ready',      emoji: '🟢', color: '#10b981', bg: 'rgba(16,185,129,.08)', next: '🎉 Completed' },
};

// Elapsed time display — turns red after 10 minutes
function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('');
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    const tick = () => {
      const ms = Date.now() - new Date(createdAt).getTime();
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      setIsLate(m >= 10);
      if (h > 0) setElapsed(`${h}h ${m % 60}m`);
      else if (m > 0) setElapsed(`${m}m ${s % 60}s`);
      else setElapsed(`${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  return (
    <span style={{
      fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
      color: isLate ? '#ef4444' : '#94a3b8',
      background: isLate ? 'rgba(239,68,68,0.12)' : 'transparent',
      padding: isLate ? '2px 6px' : '0',
      borderRadius: 4,
      animation: isLate ? 'pulse 1.5s infinite' : 'none',
    }}>
      ⏱ {elapsed}
    </span>
  );
}

export default function KitchenPage() {
  const { theme } = useTheme();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['kitchen_orders'],
    queryFn: () => api.get('/api/orders/kitchen').then(r => r.data),
    refetchInterval: 30000, // 30s fallback (was 60s)
    refetchOnWindowFocus: false,
  });

  const orders: Order[] = useMemo(() => ordersData?.orders || [], [ordersData]);

  // Alert sound on new PENDING orders
  useEffect(() => {
    const pendingCount = orders.filter(o => o.status === 'PENDING').length;
    if (pendingCount > prevCountRef.current) {
      try { audioRef.current?.play(); } catch {}
    }
    prevCountRef.current = pendingCount;
  }, [orders]);

  // WebSocket live updates
  useEffect(() => {
    if (!socket) return;
    const handle = () => queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] });
    socket.on('ORDER_CREATED', handle);
    socket.on('ORDER_UPDATED', handle);
    return () => { socket.off('ORDER_CREATED', handle); socket.off('ORDER_UPDATED', handle); };
  }, [socket, queryClient]);

  const updateStatus = useCallback(async (id: string, currentStatus: string) => {
    const idx = STATUS_FLOW.indexOf(currentStatus as any);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    setUpdating(id);
    try {
      await api.put(`/api/orders/${id}/status`, { status: next });
      queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] });
      if (next === 'READY') toast.success('Order marked ready! 🛎️');
      if (next === 'COMPLETED') toast.success('Order completed! ✅');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdating(null);
    }
  }, [queryClient]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const columns = ['PENDING', 'PREPARING', 'READY'] as const;
  const totalActive = orders.length;
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  if (isLoading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: theme.textFaint }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🍳</div>
        <div>Loading kitchen orders…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 'calc(100vh - 120px)' }}>
      {/* Beep audio — tiny base64 beep */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2AhYeJi4uKiIaDfnh0cW9vcXR4fICDhYeJioqJh4WCf3t4dXJwcHJ1eHyAg4aIioqKiYeFgn98eXZzcXBxdHh8gIOGiIqKioiHhYJ/fHl2c3FwcXR4fICDhoiKioqIh4WCf3x5dnNxcA==" preload="auto" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: theme.text, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            🍳 Kitchen Display
            {pendingCount > 0 && (
              <span style={{
                background: '#ef4444', color: 'white', borderRadius: 20,
                padding: '2px 10px', fontSize: 13, fontWeight: 800,
                animation: 'pulse 1.5s infinite'
              }}>
                {pendingCount} new!
              </span>
            )}
          </h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 4 }}>
            {totalActive === 0 ? 'All clear — kitchen is empty 🎉' : `${totalActive} active order${totalActive !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen (ideal for kitchen monitor)'}
            style={{
              background: fullscreen ? '#7c3aed' : theme.hover,
              border: `1px solid ${fullscreen ? '#7c3aed' : theme.border}`,
              color: fullscreen ? 'white' : theme.textMuted,
              padding: '8px 16px', borderRadius: 9, cursor: 'pointer',
              fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            {fullscreen ? '⬛ Exit Fullscreen' : '⛶ Fullscreen Mode'}
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] })}
            style={{
              background: theme.hover, border: `1px solid ${theme.border}`,
              color: theme.textMuted, padding: '8px 14px', borderRadius: 9,
              cursor: 'pointer', fontSize: 13, fontWeight: 600
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {columns.map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = orders.filter(o => o.status === s).length;
          return (
            <div key={s} style={{
              background: theme.card, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: '14px 18px',
              borderLeft: `4px solid ${cfg.color}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {cfg.emoji} {cfg.label}
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: cfg.color, lineHeight: 1.2, marginTop: 4 }}>{count}</div>
              </div>
              {count > 0 && s === 'PENDING' && (
                <div style={{ fontSize: 28, animation: 'pulse 1s infinite' }}>🔔</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {orders.length === 0 ? (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`,
          borderRadius: 16, padding: '60px 40px', textAlign: 'center', flex: 1
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✨</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: theme.text, marginBottom: 6 }}>Kitchen is all clear!</div>
          <div style={{ fontSize: 14, color: theme.textFaint }}>No active orders. New orders will appear here instantly.</div>
        </div>
      ) : (
        /* Kanban columns */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, flex: 1, alignItems: 'start' }}>
          {columns.map(colStatus => {
            const cfg = STATUS_CONFIG[colStatus];
            const colOrders = orders
              .filter(o => o.status === colStatus)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            return (
              <div key={colStatus} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Column header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: cfg.bg, borderRadius: 10,
                  border: `1px solid ${cfg.color}22`
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <span style={{
                    background: cfg.color, color: 'white',
                    borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 900
                  }}>
                    {colOrders.length}
                  </span>
                </div>

                {colOrders.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: theme.textFaint, fontSize: 13 }}>
                    — empty —
                  </div>
                )}

                {colOrders.map(order => {
                  const customer = order.customer?.name || order.customerName || 'Walk-in';
                  const tableNote = order.notes?.match(/Table:\s*(\S+)/)?.[1];
                  const isUpdating = updating === order.id;

                  return (
                    <div
                      key={order.id}
                      style={{
                        background: theme.card,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 14,
                        borderLeft: `4px solid ${cfg.color}`,
                        padding: '14px 16px',
                        transition: 'box-shadow .2s',
                        opacity: isUpdating ? 0.7 : 1,
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: '#a78bfa', fontWeight: 900, fontSize: 13, fontFamily: 'monospace' }}>
                          #{order.invoiceNumber}
                        </span>
                        <ElapsedTimer createdAt={order.createdAt} />
                      </div>

                      {/* Customer + Table */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{customer}</div>
                        {tableNote && (
                          <span style={{
                            background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800
                          }}>
                            🪑 Table {tableNote}
                          </span>
                        )}
                      </div>

                      {/* Items */}
                      <div style={{
                        background: theme.hover, borderRadius: 8,
                        padding: '8px 10px', marginBottom: 12,
                        display: 'flex', flexDirection: 'column', gap: 4
                      }}>
                        {order.items?.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: theme.text, fontWeight: 600 }}>{item.name}</span>
                            <span style={{ fontWeight: 900, color: '#a78bfa' }}>×{item.quantity}</span>
                          </div>
                        ))}
                        {!order.items?.length && (
                          <div style={{ color: theme.textFaint, fontSize: 12 }}>No items</div>
                        )}
                      </div>

                      {/* Notes */}
                      {order.notes && !order.notes.startsWith('Table:') && (
                        <div style={{
                          fontSize: 11, color: '#f59e0b', fontStyle: 'italic',
                          marginBottom: 10, background: 'rgba(245,158,11,0.08)',
                          padding: '4px 8px', borderRadius: 6
                        }}>
                          📝 {order.notes}
                        </div>
                      )}

                      {/* Action button */}
                      {colStatus !== 'READY' || true ? (
                        <button
                          onClick={() => updateStatus(order.id, order.status)}
                          disabled={isUpdating}
                          style={{
                            width: '100%', padding: '11px', borderRadius: 10,
                            background: colStatus === 'PENDING'
                              ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                              : colStatus === 'PREPARING'
                              ? 'linear-gradient(135deg,#10b981,#059669)'
                              : 'linear-gradient(135deg,#6366f1,#7c3aed)',
                            color: 'white', border: 'none',
                            fontWeight: 800, fontSize: 14, cursor: isUpdating ? 'not-allowed' : 'pointer',
                            opacity: isUpdating ? 0.6 : 1,
                            transition: 'transform .15s, opacity .15s',
                          }}
                          onMouseEnter={e => { if (!isUpdating) (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        >
                          {isUpdating ? '⏳ Updating…' : cfg.next}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  );
}
