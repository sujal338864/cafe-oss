import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PRESET_COLORS = [
  '#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
];

export default function CategoriesPage() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { data: catData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then(res => res.data.categories || []),
    staleTime: 300000, // 5 min
  });
  const categories = catData || [];

  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState<any>(null);
  const [form,       setForm]       = useState({ name: '', color: '#7c3aed' });
  const [localError, setLocalError] = useState('');

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editing ? api.put(`/api/categories/${editing.id}`, payload) : api.post('/api/categories', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowModal(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] })
  });

  const saving = saveMutation.isPending;
  const displayError = (queryError ? 'Failed to load' : '') || (saveMutation.error as any)?.response?.data?.error || localError;

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', color: '#7c3aed' });
    setLocalError('');
    setShowModal(true);
  };

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({ name: cat.name, color: cat.color || '#7c3aed' });
    setLocalError('');
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setLocalError('Category name is required'); return; }
    saveMutation.mutate(form);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this category? Products in this category will become uncategorised.')) return;
    deleteMutation.mutate(id);
  };

  const inp: React.CSSProperties = {
    background: theme.input, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 9, padding: '10px 13px',
    fontSize: 13, width: '100%', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, color: theme.textFaint,
    fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 5,
  };

  const totalProducts = categories.reduce((s, c) => s + (c._count?.products || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>Categories</h2>
          <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>
            {categories.length} categories · {totalProducts} total products
          </p>
        </div>
        <button onClick={openAdd}
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Category
        </button>
      </div>

      {/* Category Cards Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>
          <div>Loading categories...</div>
          <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 8 }}>If this takes long, the backend is warming up.</div>
        </div>
      ) : displayError && categories.length === 0 ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 12 }}>{displayError}</div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['categories'] })} style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
        </div>
      ) : categories.length === 0 ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
          <div style={{ color: theme.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No categories yet</div>
          <div style={{ color: theme.textFaint, fontSize: 13, marginBottom: 20 }}>Create categories to organise your products</div>
          <button onClick={openAdd}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '10px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
            + Add First Category
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {categories.map((cat: any) => {
            const color = cat.color || '#7c3aed';
            const count = cat._count?.products || 0;
            return (
              <div key={cat.id}
                style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden' }}>
                {/* Color accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  {/* Color dot / icon */}
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: color + '22', border: `2px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color }}>{cat.name[0].toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                    <div style={{ fontSize: 12, color: theme.textFaint, marginTop: 2 }}>
                      {count} product{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Product count bar */}
                <div style={{ marginTop: 14, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: theme.textFaint, marginBottom: 5 }}>
                    <span>Products</span>
                    <span style={{ color, fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ height: 4, background: theme.hover, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, totalProducts > 0 ? (count / totalProducts) * 100 : 0)}%`, background: color, borderRadius: 99, transition: 'width .4s ease' }} />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => openEdit(cat)}
                    style={{ flex: 1, background: color + '15', border: `1px solid ${color}33`, color, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => del(cat.id)}
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view for categories with many products */}
      {categories.length > 0 && (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${theme.border}`, fontSize: 13, fontWeight: 700, color: theme.text }}>
            All Categories
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Category', 'Color', 'Products', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, color: theme.textFaint, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat: any) => {
                const color = cat.color || '#7c3aed';
                const count = cat._count?.products || 0;
                return (
                  <tr key={cat.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: theme.textFaint }}>{color}</span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ background: color + '18', color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{count}</span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => openEdit(cat)}
                          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#a78bfa', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => del(cat.id)}
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28, width: '90%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.text }}>{editing ? 'Edit Category' : 'Add Category'}</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {displayError && <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{displayError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Category Name *</label>
                <input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                  placeholder="e.g. Beverages, Dairy, Snacks..." style={inp}
                  onKeyDown={e => e.key === 'Enter' && save()} />
              </div>

              <div>
                <label style={lbl}>Color</label>
                {/* Preset swatches */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(v => ({ ...v, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: 7, background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all .15s' }} />
                  ))}
                </div>
                {/* Custom hex input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: form.color, border: `1px solid ${theme.border}`, flexShrink: 0 }} />
                  <input value={form.color} onChange={e => setForm(v => ({ ...v, color: e.target.value }))}
                    placeholder="#7c3aed" style={{ ...inp }} />
                </div>
              </div>

              {/* Preview */}
              <div style={{ background: theme.hover, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: form.color + '25', border: `2px solid ${form.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: form.color }}>{(form.name || 'A')[0].toUpperCase()}</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{form.name || 'Preview'}</div>
                  <div style={{ fontSize: 11, color: theme.textFaint }}>Category</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: 12, borderRadius: 10, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Category'}
              </button>
              <button onClick={() => setShowModal(false)}
                style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '12px 20px', borderRadius: 10, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
