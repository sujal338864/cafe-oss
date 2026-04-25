'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import api from '@/lib/api';

export default function MenuSync() {
  const { theme } = useTheme();
  const params = useSearchParams();
  const orgId = params.get('orgId');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const { data: templatesData, isLoading, refetch } = useQuery({
    queryKey: ['menu-templates', orgId],
    queryFn: () => api.get(`/api/org/${orgId}/menu-templates`).then(r => r.data),
    enabled: !!orgId,
  });

  const { data: branchesData } = useQuery({
    queryKey: ['branches-list', orgId],
    queryFn: () => api.get(`/api/org/${orgId}/branches`).then(r => r.data),
    enabled: !!orgId,
  });

  const templates: any[] = templatesData?.templates || [];
  const branches: any[] = branchesData?.branches || [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newItems, setNewItems] = useState([
    { name: 'Cheese Pasta', sku: 'PRD-001', barcode: '', costPrice: 0, sellingPrice: 120, taxRate: 0, unit: 'pcs', description: '', imageUrl: '', isAvailable: true }
  ]);

  const handleAddItem = () => {
    setNewItems([...newItems, { name: '', sku: '', barcode: '', costPrice: 0, sellingPrice: 0, taxRate: 0, unit: 'pcs', description: '', imageUrl: '', isAvailable: true }]);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...newItems];
    (updated[index] as any)[field] = value;
    setNewItems(updated);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName) return alert('Template name is required');
    try {
      await api.post(`/api/org/${orgId}/menu-templates`, {
        name: newTemplateName,
        items: newItems.map(item => ({
          ...item,
          isActive: true // Force active for templates
        })),
        syncMode: 'ADDITIVE'
      });
      setShowCreateModal(false);
      setNewTemplateName('');
      setNewItems([{ name: 'Cheese Pasta', sku: 'PRD-001', barcode: '', costPrice: 0, sellingPrice: 120, taxRate: 0, unit: 'pcs', description: '', imageUrl: '', isAvailable: true }]);
      refetch();
    } catch (e: any) {
      alert('Failed to create template: ' + (e.response?.data?.error || e.message));
    }
  };


  const card = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24 };

  const handleSync = async (templateId: string) => {
    setSyncing(templateId);
    setSyncResult(null);
    try {
      const res = await api.post(`/api/org/${orgId}/menu-templates/${templateId}/sync`, {});
      setSyncResult(res.data);
    } catch (e: any) {
      setSyncResult({ error: e.response?.data?.error || 'Sync failed' });
    } finally {
      setSyncing(null);
      refetch();
    }
  };

  if (!orgId) return (
    <div style={{ padding: 40, textAlign: 'center', color: theme.textFaint }}>
      Go back to <a href="/dashboard/hq" style={{ color: '#7c3aed' }}>HQ Dashboard</a> first.
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: theme.text, margin: 0 }}>🔄 Central Menu Sync</h1>
          <p style={{ color: theme.textFaint, marginTop: 4 }}>Push a master product catalog to all franchise branches simultaneously</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
        >
          ✨ Create New Template
        </button>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div style={{ padding: '16px 20px', borderRadius: 10, marginBottom: 20,
          background: syncResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${syncResult.error ? '#ef4444' : '#10b981'}`,
          color: syncResult.error ? '#ef4444' : '#10b981', fontWeight: 700 }}>
          {syncResult.error ? `❌ ${syncResult.error}` : `✅ Synced ${syncResult.synced} products across ${syncResult.branches} branches!`}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ ...card, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: theme.text, marginBottom: 20 }}>New Menu Template</h2>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: theme.textFaint, display: 'block', marginBottom: 8, fontSize: 13 }}>Template Name</label>
              <input 
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="e.g. Summer 2024 Collection"
                style={{ width: '100%', background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, padding: '12px 14px', borderRadius: 10 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, color: theme.text }}>Products in Template</span>
                <button onClick={handleAddItem} style={{ color: '#7c3aed', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>+ Add Row</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {newItems.map((item, i) => (
                  <div key={i} style={{ padding: 16, background: theme.bg, borderRadius: 12, border: `1px solid ${theme.border}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <input value={item.name} onChange={e => handleUpdateItem(i, 'name', e.target.value)} placeholder="Product Name *" style={{ background: theme.card, color: theme.text, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                      <input value={item.sku} onChange={e => handleUpdateItem(i, 'sku', e.target.value)} placeholder="SKU" style={{ background: theme.card, color: theme.text, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                      <input type="number" value={item.sellingPrice} onChange={e => handleUpdateItem(i, 'sellingPrice', Number(e.target.value))} placeholder="Price *" style={{ background: theme.card, color: theme.text, padding: 10, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                      <input type="number" value={item.costPrice} onChange={e => handleUpdateItem(i, 'costPrice', Number(e.target.value))} placeholder="Cost" style={{ fontSize: 12, background: theme.card, color: theme.text, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                      <input type="number" value={item.taxRate} onChange={e => handleUpdateItem(i, 'taxRate', Number(e.target.value))} placeholder="Tax %" style={{ fontSize: 12, background: theme.card, color: theme.text, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                      <input value={item.unit} onChange={e => handleUpdateItem(i, 'unit', e.target.value)} placeholder="Unit" style={{ fontSize: 12, background: theme.card, color: theme.text, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                      <input value={item.barcode} onChange={e => handleUpdateItem(i, 'barcode', e.target.value)} placeholder="Barcode" style={{ fontSize: 12, background: theme.card, color: theme.text, padding: 8, borderRadius: 8, border: `1px solid ${theme.border}` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ flex: 1, padding: 14, borderRadius: 10, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTemplate}
                style={{ flex: 1, padding: 14, borderRadius: 10, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Templates List */}
        <div style={card}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 16 }}>📋 Menu Templates ({templates.length})</h3>
          {isLoading ? (
            <div style={{ color: theme.textFaint }}>Loading templates...</div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: theme.textFaint }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              No templates yet. Create one to enable centralized menu management.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {templates.map((t) => (
                <div key={t.id} style={{ padding: 16, background: theme.bg, borderRadius: 10, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: theme.text, marginBottom: 4 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: theme.textFaint }}>
                        {Array.isArray(t.items) ? t.items.length : 0} items • {t.syncMode}
                        {t.lastSyncedAt && <span> • Last synced: {new Date(t.lastSyncedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSync(t.id)}
                      disabled={syncing === t.id}
                      style={{ padding: '8px 16px', background: '#7c3aed', color: 'white', border: 'none',
                        borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
                        opacity: syncing === t.id ? 0.6 : 1 }}>
                      {syncing === t.id ? 'Syncing...' : '🚀 Push to All'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branches Info */}
        <div style={card}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 16 }}>🏪 Target Branches ({branches.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {branches.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: theme.bg, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                <div>
                  <div style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: theme.textFaint }}>{b.city || 'Location not set'}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: 20 }}>Active</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
