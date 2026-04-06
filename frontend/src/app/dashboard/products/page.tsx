"use client";

import { useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getOptimizedImage } from '@/lib/cloudinary';

const fmt = (n: any) => 'Rs.' + Number(n || 0).toLocaleString('en-IN');
const COLORS = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#0891b2','#7c3aed','#db2777'];

function exportCSV(products: any[]) {
  const rows = [
    ['Name','SKU','Barcode','Category','Cost Price','Selling Price','Tax Rate','Stock','Low Stock Alert','Status'],
    ...products.map(p => {
      const status = p.stock === 0 ? 'Out of Stock' : p.stock <= p.lowStockAlert ? 'Low Stock' : 'OK';
      return [p.name, p.sku||'', p.barcode||'', p.category?.name||'', p.costPrice, p.sellingPrice, p.taxRate||0, p.stock, p.lowStockAlert, status];
    })
  ];
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `products-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function ProductsPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  
  // Queries
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products?limit=1000').then(r => r.data)
  });
  const { data: catsData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then(r => r.data)
  });

  const products = productsData?.products || [];
  const categories = catsData?.categories || catsData || [];

  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [stockFilter,  setStockFilter]  = useState('ALL');
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState<any>(null);
  const [form,         setForm]         = useState({
    name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '',
    stock: '', lowStockAlert: '10', taxRate: '0', categoryId: '', imageUrl: '', unit: 'pcs'
  });
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', stock: '', lowStockAlert: '10', taxRate: '0', categoryId: '', imageUrl: '', unit: 'pcs' });
    setImageFile(null); setImagePreview(''); setError(''); setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || '', barcode: p.barcode || '',
      costPrice: p.costPrice, sellingPrice: p.sellingPrice,
      stock: p.stock, lowStockAlert: p.lowStockAlert,
      taxRate: p.taxRate || 0, categoryId: p.categoryId || '',
      imageUrl: p.imageUrl || '', unit: p.unit || 'pcs'
    });
    setImageFile(null); setImagePreview(p.imageUrl || ''); setError(''); setShowModal(true);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name.trim())   { setError('Product name is required'); return; }
    if (!form.sellingPrice)  { setError('Selling price is required'); return; }
    setSaving(true); setError('');
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        try {
          const cloudName = 'dwabtf4de';
          const preset = 'cafe_os_uploads';
          const fd = new FormData();
          fd.append('file', imageFile);
          fd.append('upload_preset', preset);
          fd.append('folder', 'shop-os/products');
          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
          const up = await res.json();
          if (up.secure_url) imageUrl = up.secure_url;
          else imageUrl = imagePreview;
        } catch { imageUrl = imagePreview; }
      }
      const body: any = {
        name:          form.name.trim(),
        sku:           form.sku || undefined,
        barcode:       form.barcode || undefined,
        costPrice:     Number(form.costPrice) || 0,
        sellingPrice:  Number(form.sellingPrice),
        stock:         Number(form.stock) || 0,
        lowStockAlert: Number(form.lowStockAlert) || 10,
        taxRate:       Number(form.taxRate) || 0,
        categoryId:    form.categoryId || undefined,
        imageUrl:      imageUrl || undefined,
        unit:          form.unit || 'pcs',
      };
      if (editing) await api.put(`/api/products/${editing.id}`, body);
      else         await api.post('/api/products', body);
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.data?.details?.[0]?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try { 
      await api.delete(`/api/products/${id}`); 
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) { alert(e.response?.data?.error || 'Cannot delete'); }
  };

  // Filters
  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    if (q && !p.name?.toLowerCase().includes(q) && !(p.sku||'').toLowerCase().includes(q) && !(p.barcode||'').includes(q)) return false;
    if (catFilter && p.categoryId !== catFilter) return false;
    if (stockFilter === 'LOW'  && !(p.stock > 0 && p.stock <= p.lowStockAlert)) return false;
    if (stockFilter === 'OUT'  && p.stock !== 0) return false;
    if (stockFilter === 'OK'   && p.stock <= p.lowStockAlert) return false;
    return true;
  });

  const totalValue = products.reduce((s, p) => s + Number(p.costPrice) * p.stock, 0);
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.lowStockAlert).length;
  const outCount      = products.filter(p => p.stock === 0).length;

  const inp: React.CSSProperties = { background: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, padding: '10px 13px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 5 };
  const card: React.CSSProperties = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Products</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>{products.length} products</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => exportCSV(filtered)}
            style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            ⬇ Export CSV
          </button>
          <button onClick={openAdd}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Add Product
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total Products',  val: products.length,   color: '#3b82f6' },
          { label: 'Low Stock',       val: lowStockCount,     color: '#f59e0b' },
          { label: 'Out of Stock',    val: outCount,          color: '#ef4444' },
          { label: 'Inventory Value', val: fmt(totalValue),   color: '#10b981' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...card, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, barcode..."
          style={{ ...inp, width: 220, padding: '8px 12px', fontSize: 12 }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ ...inp, width: 160, padding: '8px 12px', fontSize: 12 }}>
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
          style={{ ...inp, width: 140, padding: '8px 12px', fontSize: 12 }}>
          <option value="ALL">All Stock</option>
          <option value="OK">In Stock</option>
          <option value="LOW">Low Stock</option>
          <option value="OUT">Out of Stock</option>
        </select>
        {(search || catFilter || stockFilter !== 'ALL') && (
          <button onClick={() => { setSearch(''); setCatFilter(''); setStockFilter('ALL'); }}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '8px 14px', borderRadius: 9, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
             Clear
          </button>
        )}
      </div>

      {/* Products table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {productsLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>
              <div>Loading products...</div>
              <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 8 }}>If this takes long, the backend is warming up (Render free tier).</div>
            </div>
          ) : error && products.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 12 }}>{error}</div>
              <button onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: theme.textFaint }}>
              {products.length === 0 ? 'No products yet. Add your first product!' : 'No products match your filters.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {['', 'Product', 'SKU / Barcode', 'Category', 'Cost', 'Price', 'Tax', 'Margin', 'Stock', 'Status', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any, idx: number) => {
                  const sp = Number(p.sellingPrice);
                  const cp = Number(p.costPrice);
                  const margin = sp > 0 ? (((sp - cp) / sp) * 100).toFixed(0) : '0';
                  const isOut  = p.stock === 0;
                  const isLow  = !isOut && p.stock <= p.lowStockAlert;
                  const [sl, sc, sbg] = isOut
                    ? ['Out', '#ef4444', 'rgba(239,68,68,.14)']
                    : isLow
                    ? ['Low', '#f59e0b', 'rgba(245,158,11,.14)']
                    : ['OK',  '#10b981', 'rgba(16,185,129,.14)'];

                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${theme.border}` }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = theme.hover}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td style={{ padding: '10px 12px' }}>
                        {p.imageUrl
                          ? <img src={getOptimizedImage(p.imageUrl, 80) || ''} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover' }} />
                          : <div style={{ width: 38, height: 38, borderRadius: 8, background: COLORS[idx % COLORS.length] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: COLORS[idx % COLORS.length] }}>
                              {p.name[0].toUpperCase()}
                            </div>
                        }
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13, color: theme.text }}>{p.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.sku && <div style={{ fontFamily: 'monospace', fontSize: 11, color: theme.textFaint }}>{p.sku}</div>}
                        {p.barcode && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8' }}> {p.barcode}</div>}
                        {!p.sku && !p.barcode && <span style={{ color: theme.textFaint, fontSize: 12 }}></span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.category?.name
                          ? <span style={{ background: theme.accentBg, color: theme.accent, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{p.category.name}</span>
                          : <span style={{ color: theme.textFaint, fontSize: 12 }}></span>}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{fmt(p.costPrice)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, color: theme.text }}>{fmt(p.sellingPrice)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: Number(p.taxRate) > 0 ? '#f59e0b' : theme.textFaint }}>
                        {Number(p.taxRate) > 0 ? `${p.taxRate}%` : '0%'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>{margin}%</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: isOut ? '#ef4444' : isLow ? '#f59e0b' : theme.text }}>
                        {p.stock} <span style={{ fontSize: 10, color: theme.textFaint, fontWeight: 400 }}>{p.unit || 'pcs'}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: sbg, color: sc, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{sl}</span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(p)}
                          style={{ background: theme.accentBg, border: 'none', color: theme.accent, padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginRight: 6 }}>Edit</button>
                        <button onClick={() => remove(p.id)}
                          style={{ background: 'rgba(239,68,68,.1)', border: 'none', color: '#ef4444', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Del</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 540, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>{editing ? 'Edit' : 'Add'} Product</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}></button>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{error}</div>}

            {/* Image upload */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Product Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 76, height: 76, borderRadius: 12, background: theme.input, border: `2px dashed ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {imagePreview
                    ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 12, color: theme.textFaint }}>No img</span>}
                </div>
                <div>
                  <label style={{ background: theme.accentBg, border: `1px solid ${theme.accent}44`, color: theme.accent, padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-block' }}>
                    Choose Image
                    <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                  </label>
                  <p style={{ fontSize: 11, color: theme.textFaint, marginTop: 5 }}>JPG, PNG, WEBP  or paste URL below</p>
                  {imageFile && <p style={{ fontSize: 11, color: '#10b981', marginTop: 3 }}> {imageFile.name}</p>}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Name */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Product Name *</label>
                <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="e.g. Basmati Rice 5kg" style={inp} />
              </div>

              {/* Category */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Category</label>
                <select value={form.categoryId} onChange={e => setForm(v => ({ ...v, categoryId: e.target.value }))} style={inp}>
                  <option value=""> No category </option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* SKU + Barcode */}
              <div>
                <label style={lbl}>SKU</label>
                <input value={form.sku} onChange={e => setForm(v => ({ ...v, sku: e.target.value }))} placeholder="PRD-001" style={inp} />
              </div>
              <div>
                <label style={lbl}>Barcode / EAN</label>
                <input value={form.barcode} onChange={e => setForm(v => ({ ...v, barcode: e.target.value }))} placeholder="8901234567890" style={inp} />
              </div>

              {/* Prices */}
              <div>
                <label style={lbl}>Cost Price (Rs.)</label>
                <input type="number" min="0" step="0.01" value={form.costPrice} onChange={e => setForm(v => ({ ...v, costPrice: e.target.value }))} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={lbl}>Selling Price (Rs.) *</label>
                <input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={e => setForm(v => ({ ...v, sellingPrice: e.target.value }))} placeholder="0" style={inp} />
              </div>

              {/* Tax + Unit */}
              <div>
                <label style={lbl}>Tax Rate (%)</label>
                <select value={form.taxRate} onChange={e => setForm(v => ({ ...v, taxRate: e.target.value }))} style={inp}>
                  {['0','5','8','10','12','15','18','20','25','28'].map(r => (
                    <option key={r} value={r}>{r}%{r==='0'?' (no tax)':r==='5'?' (GST 5%)':r==='12'?' (GST 12%)':r==='18'?' (GST 18%)':''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Unit</label>
                <select value={form.unit} onChange={e => setForm(v => ({ ...v, unit: e.target.value }))} style={inp}>
                  {['pcs','kg','g','litre','ml','box','pack','dozen','metre','feet'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Stock */}
              <div>
                <label style={lbl}>Stock Quantity</label>
                <input type="number" min="0" value={form.stock} onChange={e => setForm(v => ({ ...v, stock: e.target.value }))} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={lbl}>Low Stock Alert At</label>
                <input type="number" min="0" value={form.lowStockAlert} onChange={e => setForm(v => ({ ...v, lowStockAlert: e.target.value }))} placeholder="10" style={inp} />
              </div>

              {/* Image URL fallback */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lbl}>Image URL (optional)</label>
                <input value={form.imageUrl} onChange={e => { setForm(v => ({ ...v, imageUrl: e.target.value })); setImagePreview(e.target.value); }} placeholder="https://..." style={inp} />
              </div>
            </div>

            {/* Margin preview */}
            {form.costPrice && form.sellingPrice && (
              <div style={{ marginTop: 12, background: theme.hover, borderRadius: 9, padding: '10px 14px', display: 'flex', gap: 20, fontSize: 12 }}>
                <span style={{ color: theme.textFaint }}>Margin: <b style={{ color: '#10b981' }}>
                  {(((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.sellingPrice)) * 100).toFixed(1)}%
                </b></span>
                <span style={{ color: theme.textFaint }}>Profit per unit: <b style={{ color: '#a78bfa' }}>
                  {fmt(Number(form.sellingPrice) - Number(form.costPrice))}
                </b></span>
                {Number(form.taxRate) > 0 && (
                  <span style={{ color: theme.textFaint }}>Price with tax: <b style={{ color: '#f59e0b' }}>
                    {fmt(Number(form.sellingPrice) * (1 + Number(form.taxRate) / 100))}
                  </b></span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
              </button>
              <button onClick={() => setShowModal(false)}
                style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '13px 20px', borderRadius: 10, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
