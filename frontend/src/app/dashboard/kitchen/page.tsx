'use client';
import { useEffect, useRef } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useSocket } from '@/context/SocketContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['kitchen_orders'],
    queryFn: () => api.get('/api/orders/kitchen').then(r => r.data),
    refetchInterval: 60000, // 1 min fallback polling
  });

  const orders: Order[] = ordersData?.orders || [];

  useEffect(() => {
    const pendingCount = orders.filter(o => o.status === 'PENDING').length;
    if (pendingCount > prevCountRef.current) {
      try { audioRef.current?.play(); } catch {}
    }
    prevCountRef.current = pendingCount;
  }, [orders]);

  useEffect(() => {
    if (!socket) return;
    const handle = () => queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] });
    socket.on('ORDER_CREATED', handle);
    socket.on('ORDER_UPDATED', handle);
    return () => { socket.off('ORDER_CREATED', handle); socket.off('ORDER_UPDATED', handle); };
  }, [socket, queryClient]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/api/orders/${id}/status`, { status });
      queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] });
    } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
  };

  const nextStatus = (current: string) => {
    const idx = STATUS_FLOW.indexOf(current as any);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  if (isLoading) return <div style={{ padding: 60, textAlign: 'center', color: theme.textFaint }}>Loading kitchen...</div>;

  const columns = ['PENDING', 'PREPARING', 'READY'] as const;
  const card: any = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2AhYeJi4uKiIaDfnh0cW9vcXR4fICDhYeJioqJh4WCf3t4dXJwcHJ1eHyAg4aIioqKiYeFgn98eXZzcXBxdHh8gIOGiIqKioiHhYJ/fHl2c3FwcXR4fICDhoiKioqIh4WCf3x5dnNxcA==" preload="auto" />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>🍳 Kitchen Display</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>{orders.length} active orders</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {columns.map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = orders.filter(o => o.status === s).length;
          return (
            <div key={s} style={{ ...card, padding: '12px 18px', borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint }}>{cfg.emoji} {cfg.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: cfg.color, marginTop: 4 }}>{count}</div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>All clear!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {columns.map(colStatus => {
            const cfg = STATUS_CONFIG[colStatus];
            const colOrders = orders.filter(o => o.status === colStatus).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            return (
              <div key={colStatus}>
                <div style={{ fontSize: 13, fontWeight: 800, color: cfg.color, marginBottom: 10 }}>{cfg.emoji} {colStatus}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colOrders.map(order => {
                    const next = nextStatus(order.status);
                    const customer = order.customer?.name || order.customerName || 'Walk-in';
                    return (
                      <div key={order.id} style={{ ...card, padding: 14, borderLeft: `4px solid ${cfg.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span style={{ color: '#a78bfa', fontWeight: 800 }}>#{order.invoiceNumber}</span>
                          <span style={{ color: theme.textFaint }}>{timeSince(order.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{customer}</div>
                        <div style={{ background: theme.hover, borderRadius: 8, padding: 8, margin: '8px 0' }}>
                          {order.items?.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.text }}>
                              <span>{item.name}</span>
                              <span style={{ fontWeight: 800 }}>×{item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        {next && (
                          <button onClick={() => updateStatus(order.id, next)} style={{ width: '100%', padding: 10, borderRadius: 10, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                            {next === 'PREPARING' ? '🔥 Start' : next === 'READY' ? '✅ Ready' : '🎉 Done'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
