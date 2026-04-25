'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { 
  Plus, Edit2, Trash2, Package, Check, X, 
  Search, Info, Image as ImageIcon, Clock, 
  ChevronRight, Save, LayoutGrid
} from 'lucide-react';

export default function CombosPage() {
  const [combos, setCombos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<any>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    fixedPrice: '',
    items: [] as any[],
    showInScanner: true,
    showInPOS: true,
    startTime: '',
    endTime: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get('/api/combos'),
        api.get('/api/products?limit=500')
      ]);
      setCombos(cRes.data.combos || []);
      setProducts(pRes.data.products || []);
    } catch (e) {
      toast.error('Failed to load combos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (combo: any = null) => {
    if (combo) {
      setEditingCombo(combo);
      setFormData({
        name: combo.name,
        description: combo.description || '',
        imageUrl: combo.imageUrl || '',
        fixedPrice: combo.fixedPrice.toString(),
        items: combo.items.map((i: any) => ({
          productId: i.productId,
          quantity: i.quantity,
          name: i.product.name
        })),
        showInScanner: combo.showInScanner,
        showInPOS: combo.showInPOS,
        startTime: combo.startTime || '',
        endTime: combo.endTime || ''
      });
      setImagePreview(combo.imageUrl || '');
      setImageFile(null);
    } else {
      setEditingCombo(null);
      setFormData({
        name: '',
        description: '',
        imageUrl: '',
        fixedPrice: '',
        items: [],
        showInScanner: true,
        showInPOS: true,
        startTime: '',
        endTime: ''
      });
      setImagePreview('');
      setImageFile(null);
    }
    setIsModalOpen(true);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      return toast.error('Add at least one product to the combo');
    }

    setSaving(true);
    try {
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        try {
          const cloudName = 'dwabtf4de';
          const preset = 'cafe_os_uploads';
          const fd = new FormData();
          fd.append('file', imageFile);
          fd.append('upload_preset', preset);
          fd.append('folder', 'shop-os/combos');
          const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
          const up = await res.json();
          if (up.secure_url) imageUrl = up.secure_url;
        } catch (err) {
          console.error('Image upload failed', err);
        }
      }

      const payload = { ...formData, imageUrl };
      if (editingCombo) {
        await api.put(`/api/combos/${editingCombo.id}`, payload);
        toast.success('Combo updated');
      } else {
        await api.post('/api/combos', payload);
        toast.success('Combo created');
      }
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save combo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will permanently delete the combo.')) return;
    try {
      await api.delete(`/api/combos/${id}`);
      toast.success('Combo deleted');
      loadData();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const addProductToCombo = (product: any) => {
    const existing = formData.items.find(i => i.productId === product.id);
    if (existing) {
      setFormData({
        ...formData,
        items: formData.items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, { productId: product.id, quantity: 1, name: product.name }]
      });
    }
  };

  const removeProductFromCombo = (productId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter(i => i.productId !== productId)
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500">
            Combo Builder
          </h1>
          <p className="text-gray-400 mt-1">Create and manage high-value product bundles.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>New Combo</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : combos.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-6">
            <Package size={40} className="text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Combos Yet</h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Bundling popular items together at a special price is a great way to increase your average order value.
          </p>
          <button 
            onClick={() => handleOpenModal()}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10"
          >
            Create Your First Combo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {combos.map(combo => (
            <div 
              key={combo.id}
              className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-purple-500/50 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
            >
              <div className="aspect-video bg-gray-900 relative">
                {combo.imageUrl ? (
                  <img src={combo.imageUrl} alt={combo.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    <ImageIcon size={48} />
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-sm font-bold text-purple-300">
                  ₹{combo.fixedPrice}
                </div>
                {!combo.isAvailable && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
                    <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl border border-red-500/30 flex items-center gap-2">
                      <Info size={16} />
                      <span className="font-semibold text-sm">Unavailable (Low Stock)</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2 flex items-center justify-between">
                  {combo.name}
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenModal(combo)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(combo.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </h3>
                <p className="text-gray-400 text-sm line-clamp-2 mb-4 h-10">{combo.description || 'No description'}</p>
                
                <div className="space-y-2 mb-6">
                  {combo.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
                      <span className="text-gray-300">{item.product.name}</span>
                      <span className="text-white/40 font-mono">x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <LayoutGrid size={12} />
                    <span>POS: {combo.showInPOS ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{combo.startTime ? `${combo.startTime}-${combo.endTime}` : 'All day'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Builder */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#111] border border-white/10 rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <h2 className="text-2xl font-bold">{editingCombo ? 'Edit Combo' : 'Create New Combo'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 h-full">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Combo Name</label>
                      <input 
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-all"
                        placeholder="e.g. Breakfast Bonanza"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                      <textarea 
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-all h-24"
                        placeholder="Describe what's in the box..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Combo Price (₹)</label>
                        <input 
                          required
                          type="number"
                          value={formData.fixedPrice}
                          onChange={e => setFormData({ ...formData, fixedPrice: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Combo Image</label>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {imagePreview ? (
                              <img src={imagePreview} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={20} className="text-gray-600" />
                            )}
                          </div>
                          <label className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-400 cursor-pointer hover:bg-white/10 transition-all text-center">
                            {imageFile ? imageFile.name : 'Choose Image'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={formData.showInPOS}
                          onChange={e => setFormData({ ...formData, showInPOS: e.target.checked })}
                          className="w-5 h-5 accent-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white">Show in POS</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={formData.showInScanner}
                          onChange={e => setFormData({ ...formData, showInScanner: e.target.checked })}
                          className="w-5 h-5 accent-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white">Show in Menu</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col bg-white/5 rounded-3xl border border-white/10 overflow-hidden shadow-inner min-h-[600px]">
                    {/* Top half: Product Selection */}
                    <div className="flex-1 flex flex-col min-h-0 border-b border-white/10">
                      <div className="p-4 bg-white/5">
                        <h3 className="font-bold mb-3 text-sm flex items-center gap-2">
                          <Package size={16} className="text-purple-400" />
                          Add Products
                        </h3>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                          <input 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search products..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-purple-500/50 focus:outline-none transition-all"
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {filteredProducts.map(p => {
                          const isSelected = formData.items.some(i => i.productId === p.id);
                          return (
                            <div 
                              key={p.id}
                              onClick={() => addProductToCombo(p)}
                              className={`flex items-center justify-between p-3 rounded-xl transition-all border group cursor-pointer ${
                                isSelected 
                                ? 'bg-purple-500/10 border-purple-500/30' 
                                : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{p.name}</span>
                                <span className="text-[10px] text-gray-500">₹{p.sellingPrice}</span>
                              </div>
                              {isSelected ? (
                                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                                  <Check size={14} className="text-white" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                  <Plus size={14} className="text-purple-400" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom half: Combo Contents */}
                    <div className="flex-1 flex flex-col min-h-0 bg-purple-500/5">
                      <div className="p-4 border-b border-white/5">
                        <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider px-2">Combo Contents</h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                        {formData.items.length === 0 ? (
                          <div className="text-center py-12 text-gray-500 text-sm border-2 border-dashed border-white/5 rounded-2xl mx-2">
                            No products added yet.
                          </div>
                        ) : (
                          formData.items.map(item => (
                            <div key={item.productId} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 hover:border-purple-500/30 transition-all group animate-in slide-in-from-right-4 duration-300">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">{item.name}</span>
                                <div className="flex items-center gap-3 mt-2">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newItems = formData.items.map(i => 
                                        i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i
                                      );
                                      setFormData({ ...formData, items: newItems });
                                    }}
                                    className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs hover:bg-white/10 border border-white/10 active:scale-90 transition-all"
                                  >-</button>
                                  <span className="text-xs font-mono font-bold bg-white/5 px-2 py-1 rounded text-purple-300">{item.quantity}</span>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newItems = formData.items.map(i => 
                                        i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
                                      );
                                      setFormData({ ...formData, items: newItems });
                                    }}
                                    className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs hover:bg-white/10 border border-white/10 active:scale-90 transition-all"
                                  >+</button>
                                </div>
                              </div>
                              <button 
                                type="button"
                                onClick={() => removeProductFromCombo(item.productId)}
                                className="text-red-400/40 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-lg transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {formData.items.length > 0 && (
                        <div className="mt-auto p-4 border-t border-white/10 bg-black/20 flex justify-between items-center">
                          <span className="text-xs text-gray-400 font-medium">Items: {formData.items.length}</span>
                          <span className="text-sm font-black text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full">
                            Total Qty: {formData.items.reduce((s, i) => s + i.quantity, 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-white/10 flex justify-end gap-4 bg-white/5 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className={`px-10 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold flex items-center gap-2 transition-all ${saving ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg active:scale-95'}`}
                >
                  <Save size={20} className={saving ? 'animate-spin' : ''} />
                  <span>{saving ? 'Uploading...' : editingCombo ? 'Update Combo' : 'Launch Combo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
