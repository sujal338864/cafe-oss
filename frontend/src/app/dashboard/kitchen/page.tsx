'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';

type Order = {
  id: string; invoiceNumber: string; status: string; paymentStatus: string;
  paymentMethod: string; totalAmount: number; notes?: string; createdAt: string;
  customer?: { name: string; phone?: string }; customerName?: string;
  tableNumber?: string; items?: { name: string; quantity: number }[];
};

const STATUS_FLOW = ['PENDING', 'PREPARING', 'READY', 'COMPLETED'] as const;
const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  PENDING:   { label: 'New',       emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
  PREPARING: { label: 'Preparing', emoji: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  READY:     { label: 'Ready',     emoji: '🟢', color: '#10b981', bg: 'rgba(16,185,129,.12)' },
};

const fmt = (n: any) => '₹' + Number(n || 0).toLocaleString('en-IN');

function timeSince(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export default function KitchenPage() {
  const { theme } = useTheme();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/orders?limit=100');
      const all = data.orders || data.data || [];
      // Only show today's active kitchen orders
      const today = new Date().toDateString();
      const kitchen = all.filter((o: Order) =>
        ['PENDING', 'PREPARING', 'READY'].includes(o.status) &&
        new Date(o.createdAt).toDateString() === today
      );
      // Ping if new orders arrived
      if (kitchen.filter((o: Order) => o.status === 'PENDING').length > prevCountRef.current) {
        try { audioRef.current?.play(); } catch {}
      }
      prevCountRef.current = kitchen.filter((o: Order) => o.status === 'PENDING').length;
      setOrders(kitchen);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 2000); return () => clearInterval(i); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handle = () => load();
    socket.on('ORDER_CREATED', handle);
    socket.on('ORDER_UPDATED', handle);
    return () => { socket.off('ORDER_CREATED', handle); socket.off('ORDER_UPDATED', handle); };
  }, [socket, load]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await api.put(`/api/orders/${id}/status`, { status });
      setOrders(prev => status === 'COMPLETED'
        ? prev.filter(o => o.id !== id)
        : prev.map(o => o.id === id ? { ...o, status } : o)
      );
    } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
    finally { setUpdating(null); }
  };

  const nextStatus = (current: string) => {
    const idx = STATUS_FLOW.indexOf(current as any);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const card: any = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 };

  const columns = ['PENDING', 'PREPARING', 'READY'] as const;

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: theme.textFaint }}>Loading kitchen...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hidden audio for notification ping */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2AhYeJi4uKiIaDfnh0cW9vcXR4fICDhYeJioqJh4WCf3t4dXJwcHJ1eHyAg4aIioqKiYeFgn98eXZzcXBxdHh8gIOGiIqKioiHhYJ/fHl2c3FwcXR4fICDhoiKioqIh4WCf3x5dnNxcA==" preload="auto" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>🍳 Kitchen Display</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>
            {orders.length} active orders today
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '9px 16px', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {columns.map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = orders.filter(o => o.status === s).length;
          return (
            <div key={s} style={{ ...card, padding: '12px 18px', borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase' }}>{cfg.emoji} {cfg.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: cfg.color, marginTop: 4 }}>{count}</div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.text, marginBottom: 4 }}>All clear!</div>
          <div style={{ color: theme.textFaint, fontSize: 13 }}>No active orders right now. New orders will appear here automatically.</div>
        </div>
      ) : (
        /* 3-column Kanban */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'flex-start' }}>
          {columns.map(colStatus => {
            const cfg = STATUS_CONFIG[colStatus];
            const colOrders = orders.filter(o => o.status === colStatus).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            return (
              <div key={colStatus}>
                <div style={{ fontSize: 13, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cfg.emoji} {cfg.label} <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 900 }}>{colOrders.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colOrders.map(order => {
                    const next = nextStatus(order.status);
                    const nextCfg = next ? STATUS_CONFIG[next] || { label: 'Done', color: '#10b981' } : null;
                    const isUpdating = updating === order.id;
                    const customer = order.customer?.name || order.customerName || 'Walk-in';
                    const table = order.notes?.match(/Table:\s*(\S+)/)?.[1] || order.tableNumber;
                    return (
                      <div key={order.id} style={{
                        ...card, padding: 14, borderLeft: `4px solid ${cfg.color}`,
                        opacity: isUpdating ? 0.6 : 1, transition: 'all 0.2s',
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>#{order.invoiceNumber?.replace(/^(INV-|ONL-)0*/,'')}</span>
                          <span style={{ fontSize: 11, color: theme.textFaint }}>{timeSince(order.createdAt)}</span>
                        </div>

                        {/* Customer + Table */}
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 2 }}>{customer}</div>
                        {table && <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600, marginBottom: 6 }}>🪑 Table {table}</div>}

                        {/* Items */}
                        <div style={{ background: theme.hover, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                          {order.items?.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13, color: theme.text }}>
                              <span style={{ fontWeight: 600 }}>{item.name}</span>
                              <span style={{ color: cfg.color, fontWeight: 800, fontSize: 14, minWidth: 24, textAlign: 'right' }}>×{item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total + Payment */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{fmt(order.totalAmount)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: order.paymentStatus === 'PAID' ? 'rgba(16,185,129,.14)' : 'rgba(245,158,11,.14)', color: order.paymentStatus === 'PAID' ? '#10b981' : '#f59e0b' }}>
                            {order.paymentMethod} · {order.paymentStatus}
                          </span>
                        </div>

                        {/* Action Button */}
                        {next && (
                          <button
                            onClick={() => updateStatus(order.id, next)}
                            disabled={isUpdating}
                            style={{
                              width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer',
                              fontWeight: 800, fontSize: 13,
                              background: next === 'COMPLETED' ? '#10b981' : next === 'READY' ? '#f59e0b' : '#3b82f6',
                              color: '#fff', transition: 'all 0.15s', opacity: isUpdating ? 0.6 : 1,
                            }}>
                            {isUpdating ? '...' :
                              next === 'PREPARING' ? '🔥 Start Preparing' :
                              next === 'READY' ? '✅ Mark Ready' :
                              '🎉 Complete'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {colOrders.length === 0 && (
                    <div style={{ ...card, padding: '28px 14px', textAlign: 'center', color: theme.textFaint, fontSize: 12 }}>
                      No {cfg.label.toLowerCase()} orders
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
