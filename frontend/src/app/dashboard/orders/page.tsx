"use client";

import { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');
const STC: any = { PAID:{bg:'rgba(16,185,129,.14)',color:'#10b981'}, PARTIAL:{bg:'rgba(245,158,11,.14)',color:'#f59e0b'}, UNPAID:{bg:'rgba(239,68,68,.14)',color:'#ef4444'} };
const MTC: any = { CASH:'#10b981', UPI:'#3b82f6', CARD:'#a78bfa', BANK_TRANSFER:'#f59e0b', CREDIT:'#ef4444' };

function exportCSV(orders: any[]) {
  const rows = [['Invoice','Customer','Phone','Items','Total','Method','Status','Date'],
    ...orders.map(o => [o.invoiceNumber, o.customer?.name||o.customerName||'Walk-in', o.customer?.phone||'', o.items?.length??'', o.totalAmount, o.paymentMethod, o.paymentStatus, new Date(o.createdAt).toLocaleDateString('en-IN')])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

export default function OrdersPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(2000);
  const [sortDir, setSortDir] = useState('desc');
  const { data: orderData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['orders', limit, sortDir],
    queryFn: () => api.get(`/api/orders?limit=${limit}&sort=${sortDir}`).then(res => ({
      orders: res.data.orders || [],
      totalCount: res.data.totalCount || res.data.pagination?.total || 0
    })),
    staleTime: 5000, 
  });
  const orders = orderData?.orders || [];
  const totalCount = orderData?.totalCount || 0;
  const targetUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001') + '/api/orders';
  const error = queryError ? (queryError as any).message || 'Failed to load orders' : '';

  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('ALL');
  const [method,   setMethod]   = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [expanded, setExpanded] = useState<string|null>(null);

  const mutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/orders/${id}/payment`, { paymentStatus: 'PAID' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Auto-open invoice for printing
      const url = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001') + `/api/menu/order/${id}/invoice`;
      window.open(url, '_blank');
    }
  });

  const markPaid = (id: string) => mutation.mutate(id);
  const updating = mutation.isPending ? mutation.variables : null;

  const filtered = useMemo(() => orders.filter(o => {
    if (status !== 'ALL' && o.paymentStatus !== status) return false;
    if (method !== 'ALL' && o.paymentMethod !== method) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.invoiceNumber?.toLowerCase().includes(q) &&
          !o.customer?.name?.toLowerCase().includes(q) &&
          !o.customerName?.toLowerCase().includes(q) &&
          !o.customer?.phone?.includes(q)) return false;
    }
    if (dateFrom) { const f = new Date(dateFrom); f.setHours(0,0,0,0); if (new Date(o.createdAt) < f) return false; }
    if (dateTo)   { const t = new Date(dateTo);   t.setHours(23,59,59,999); if (new Date(o.createdAt) > t) return false; }
    return true;
  }), [orders,status,method,search,dateFrom,dateTo]);

  const totalRev     = filtered.reduce((s,o) => s + Number(o.totalAmount||0), 0);
  const totalPaid    = filtered.filter(o => o.paymentStatus==='PAID').reduce((s,o) => s + Number(o.totalAmount||0), 0);
  const totalPending = filtered.filter(o => o.paymentStatus!=='PAID').reduce((s,o) => s + Number(o.totalAmount||0), 0);

  const card: any = { background: theme.card, border: '1px solid '+theme.border, borderRadius: 14 };
  const inp:  any = { background: theme.input, border: '1px solid '+theme.border, color: theme.text, borderRadius: 9, padding: '8px 12px', fontSize: 12, outline: 'none' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, color:theme.text }}>Orders</h2>
          <p style={{ fontSize:13, color:theme.textFaint, marginTop:3 }}>
            Showing {filtered.length} of <b style={{color:'#7c3aed'}}>{totalCount} total records</b>
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { queryClient.invalidateQueries({ queryKey:['orders'] }); setLimit(5000); }} 
            style={{ background:'#7c3aed', color:'white', border:'none', padding:'9px 16px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer' }}>
            🔄 Sync All
          </button>
          <button onClick={() => exportCSV(filtered)} style={{ background:theme.hover, border:'1px solid '+theme.border, color:theme.textMuted, padding:'9px 16px', borderRadius:10, fontWeight:700, fontSize:12, cursor:'pointer' }}>Export CSV</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          {label:'Total Orders', val:filtered.length,   color:'#3b82f6'},
          {label:'Revenue',      val:fmt(totalRev),     color:'#10b981'},
          {label:'Collected',    val:fmt(totalPaid),    color:'#a78bfa'},
          {label:'Pending',      val:fmt(totalPending), color:'#f59e0b'},
        ].map(({label,val,color}) => (
          <div key={label} style={{...card, padding:'14px 18px'}}>
            <div style={{fontSize:11,color:theme.textFaint,fontWeight:700,textTransform:'uppercase',marginBottom:6}}>{label}</div>
            <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice, customer, phone..." style={{...inp,width:240}} />
        <select value={status} onChange={e=>setStatus(e.target.value)} style={inp}>
          <option value="ALL">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>
        <select value={method} onChange={e=>setMethod(e.target.value)} style={inp}>
          <option value="ALL">All Methods</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CREDIT">Credit</option>
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inp} />
        <span style={{color:theme.textFaint,fontSize:12}}>to</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inp} />
        
        <select value={sortDir} onChange={e=>setSortDir(e.target.value)} style={inp}>
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First (1 to 186...)</option>
        </select>

        {(search||status!=='ALL'||method!=='ALL'||dateFrom||dateTo||sortDir!=='desc') && (
          <button onClick={()=>{setSearch('');setStatus('ALL');setMethod('ALL');setDateFrom('');setDateTo('');setSortDir('desc');}}
            style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#ef4444',padding:'8px 14px',borderRadius:9,fontSize:12,cursor:'pointer',fontWeight:600}}>
            Clear
          </button>
        )}
      </div>

      <div style={{...card, overflow:'hidden'}}>
        {loading ? <div style={{padding:40,textAlign:'center',color:theme.textFaint}}><div>Loading orders...</div><div style={{fontSize:11,marginTop:8}}>If this takes long, the backend is warming up.</div></div>
        : error ? (
          <div style={{padding:40,textAlign:'center'}}>
            <div style={{fontSize:16,color:'#ef4444',fontWeight:700,marginBottom:8}}>Connection Error</div>
            <div style={{fontSize:13,color:theme.text,marginBottom:16}}>
              {error}<br/>
              <span style={{fontSize:11,color:theme.textFaint}}>URL: {targetUrl}</span>
            </div>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['orders'] })} style={{background:'#7c3aed',color:'white',border:'none',padding:'9px 24px',borderRadius:10,fontWeight:700,cursor:'pointer'}}>Retry Connection</button>
          </div>
        )
        : filtered.length===0 ? <div style={{padding:40,textAlign:'center',color:theme.textFaint}}>No orders match filters.</div>
        : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid '+theme.border}}>
                {['Invoice','Customer','Items','Amount','Method','Status','Date',''].map(h => (
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,color:theme.textFaint,fontWeight:700,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => {
                const sc = STC[o.paymentStatus] || STC.UNPAID;
                const mc = MTC[o.paymentMethod] || '#94a3b8';
                const isOpen = expanded === o.id;
                const isUnpaid = o.paymentStatus !== 'PAID';
                return (
                  <>
                    <tr key={o.id} style={{borderBottom:'1px solid '+theme.border, background:isOpen?theme.hover:'transparent', cursor:'pointer'}}
                      onClick={()=>setExpanded(isOpen?null:o.id)}>
                      <td style={{padding:'11px 14px',fontFamily:'monospace',fontSize:12,color:'#a78bfa',fontWeight:600}}>#{o.invoiceNumber}</td>
                      <td style={{padding:'11px 14px'}}>
                        <div style={{fontSize:13,fontWeight:600,color:theme.text}}>{o.customer?.name||o.customerName||'Walk-in'}</div>
                        {o.customer?.phone && <div style={{fontSize:11,color:theme.textFaint}}>{o.customer.phone}</div>}
                        {o.tableNumber && <div style={{fontSize:11,color:'#38bdf8'}}>Table {o.tableNumber}</div>}
                      </td>
                      <td style={{padding:'11px 14px',fontSize:13,color:theme.textMuted}}>{o.items?.length ?? '—'}</td>
                      <td style={{padding:'11px 14px',fontWeight:700,color:theme.text}}>{fmt(o.totalAmount)}</td>
                      <td style={{padding:'11px 14px'}}>
                        <span style={{fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,background:mc+'18',color:mc}}>{o.paymentMethod}</span>
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        <span style={{fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,...sc}}>{o.paymentStatus}</span>
                      </td>
                      <td style={{padding:'11px 14px',fontSize:12,color:theme.textFaint}}>
                        {new Date(o.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                        <div style={{fontSize:10}}>{new Date(o.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                      </td>
                      <td style={{padding:'11px 14px'}}>
                        {isUnpaid && (
                          <button onClick={e=>{e.stopPropagation();markPaid(o.id);}}
                            disabled={updating===o.id}
                            style={{background:'rgba(16,185,129,0.15)',border:'1px solid #10b981',color:'#10b981',padding:'5px 12px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',opacity:updating===o.id?0.6:1}}>
                            {updating===o.id ? '...' : 'Paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={o.id+'-exp'} style={{borderBottom:'1px solid '+theme.border}}>
                        <td colSpan={8} style={{padding:'0 14px 14px 40px'}}>
                          <div style={{background:theme.hover,borderRadius:10,padding:'12px 16px'}}>
                            <div style={{fontSize:11,color:theme.textFaint,fontWeight:700,textTransform:'uppercase',marginBottom:8}}>Items</div>
                            {o.items?.map((item: any,i: number) => (
                              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:i<o.items.length-1?'1px solid '+theme.border:'none'}}>
                                <span style={{fontSize:13,color:theme.text}}>{item.name}</span>
                                <span style={{fontSize:12,color:theme.textFaint}}>
                                  {item.quantity} x {fmt(item.unitPrice)} = <b style={{color:theme.text}}>{fmt(item.total||item.unitPrice*item.quantity)}</b>
                                  {item.taxRate>0 && <span style={{color:'#f59e0b',marginLeft:6}}>+{item.taxRate}% GST</span>}
                                </span>
                              </div>
                            ))}
                            <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid '+theme.border,display:'flex',gap:20,fontSize:12,color:theme.textFaint,flexWrap:'wrap',alignItems:'center'}}>
                              {o.subtotal!=null && <span>Subtotal: <b style={{color:theme.text}}>{fmt(o.subtotal)}</b></span>}
                              {o.taxAmount>0 && <span>Tax: <b style={{color:'#f59e0b'}}>{fmt(o.taxAmount)}</b></span>}
                              {o.discountAmount>0 && <span>Discount: <b style={{color:'#10b981'}}>-{fmt(o.discountAmount)}</b></span>}
                              {o.notes && <span>Note: <i style={{color:theme.text}}>{o.notes}</i></span>}
                              {isUnpaid && (
                                <button onClick={()=>markPaid(o.id)} disabled={updating===o.id}
                                  style={{background:'rgba(16,185,129,0.15)',border:'1px solid #10b981',color:'#10b981',padding:'6px 16px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',marginLeft:'auto',opacity:updating===o.id?0.6:1}}>
                                  {updating===o.id ? 'Updating...' : 'Mark as Paid'}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && orders.length >= limit && (
          <div style={{padding:'20px', display:'flex', justifyContent:'center', gap:12, borderTop:'1px solid '+theme.border}}>
            <button onClick={() => setLimit(l => l + 100)} 
              style={{background:theme.hover, border:'1px solid '+theme.border, color:theme.text, padding:'10px 24px', borderRadius:10, fontWeight:600, fontSize:13, cursor:'pointer'}}>
              Load More
            </button>
            <button onClick={() => setLimit(50000)} 
              style={{background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.3)', color:'#7c3aed', padding:'10px 24px', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer'}}>
              See All Orders
            </button>
          </div>
        )}
      </div>
    </div>
  );
}