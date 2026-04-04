'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function QRPage() {
  const { shop } = useAuth();
  const { theme } = useTheme();
  const [tables, setTables] = useState(10);
  const [qrCodes, setQrCodes] = useState<{ table: number; url: string; dataUrl: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    // Auto-detect the menu base URL
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const generateQRCodes = async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      // Dynamically import QR code library
      const QRCode = (await import('qrcode')).default;
      const codes = [];
      for (let t = 1; t <= tables; t++) {
        const url = `${baseUrl}/menu?shopId=${shop.id}&table=${t}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 300, margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M'
        });
        codes.push({ table: t, url, dataUrl });
      }
      setQrCodes(codes);
    } catch (e) {
      alert('Failed to generate QR codes. Make sure qrcode package is installed.');
      console.error(e);
    }
    finally { setLoading(false); }
  };

  // Generate a single "no table" QR for general menu
  const generateMenuQR = async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      const QRCode = (await import('qrcode')).default;
      const url = `${baseUrl}/menu?shopId=${shop.id}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2, errorCorrectionLevel: 'M' });
      setQrCodes([{ table: 0, url, dataUrl }]);
    } catch (e) { alert('Failed'); }
    finally { setLoading(false); }
  };

  const downloadQR = (dataUrl: string, label: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${label}.png`;
    a.click();
  };

  const printAll = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>QR Codes - ${shop?.name || 'Shop'}</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .card { border: 2px solid #e5e5e5; border-radius: 16px; padding: 20px; text-align: center; page-break-inside: avoid; }
        .card img { width: 180px; height: 180px; }
        .shop { font-size: 14px; font-weight: 800; margin-bottom: 4px; }
        .table { font-size: 24px; font-weight: 900; margin: 8px 0; }
        .scan { font-size: 11px; color: #888; margin-top: 4px; }
        @media print { .grid { gap: 10px; } .card { border: 1px solid #ddd; padding: 14px; } .card img { width: 140px; height: 140px; } }
      </style></head><body>
      <div class="grid">
        ${qrCodes.map(q => `
          <div class="card">
            <div class="shop">${shop?.name || 'Our Café'}</div>
            <img src="${q.dataUrl}" />
            <div class="table">${q.table > 0 ? `Table ${q.table}` : 'Menu'}</div>
            <div class="scan">Scan to order • Powered by CafeOS</div>
          </div>
        `).join('')}
      </div>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>
    `);
    w.document.close();
  };

  const card: any = { background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 };
  const inp: any = { background: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, padding: '10px 13px', fontSize: 13, outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>📱 QR Code Generator</h2>
        <p style={{ fontSize: 13, color: theme.textFaint, marginTop: 3 }}>Generate & print QR codes for your tables. Customers scan to order instantly.</p>
      </div>

      {/* Config */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Generate QR Codes</div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: theme.textFaint, marginBottom: 4 }}>Number of Tables</label>
            <input type="number" min="1" max="50" value={tables} onChange={e => setTables(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))} style={{ ...inp, width: 100 }} />
          </div>
          <button onClick={generateQRCodes} disabled={loading}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: 'white', padding: '11px 24px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Generating...' : `Generate ${tables} Table QRs`}
          </button>
          <button onClick={generateMenuQR} disabled={loading}
            style={{ background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '11px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            General Menu QR
          </button>
        </div>

        {shop?.id && (
          <div style={{ marginTop: 12, fontSize: 12, color: theme.textFaint }}>
            Menu link: <code style={{ color: '#a78bfa', background: theme.hover, padding: '2px 8px', borderRadius: 4 }}>{baseUrl}/menu?shopId={shop.id}</code>
          </div>
        )}
      </div>

      {/* QR Grid */}
      {qrCodes.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{qrCodes.length} QR Code{qrCodes.length > 1 ? 's' : ''} Generated</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={printAll}
                style={{ background: '#10b981', border: 'none', color: 'white', padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                🖨️ Print All
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {qrCodes.map(q => (
              <div key={q.table} style={{ ...card, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase', marginBottom: 8 }}>
                  {shop?.name || 'Our Café'}
                </div>
                <img src={q.dataUrl} alt={`Table ${q.table} QR`} style={{ width: '100%', maxWidth: 160, borderRadius: 8 }} />
                <div style={{ fontSize: 20, fontWeight: 900, color: theme.text, marginTop: 8 }}>
                  {q.table > 0 ? `Table ${q.table}` : '📋 Menu'}
                </div>
                <div style={{ fontSize: 11, color: theme.textFaint, marginTop: 4 }}>Scan to order</div>
                <button onClick={() => downloadQR(q.dataUrl, q.table > 0 ? `table-${q.table}` : 'menu')}
                  style={{ marginTop: 10, background: theme.hover, border: `1px solid ${theme.border}`, color: theme.textMuted, padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                  ⬇ Download
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Help */}
      {qrCodes.length === 0 && (
        <div style={{ ...card, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.text, marginBottom: 8 }}>How it works</div>
          <div style={{ color: theme.textFaint, fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.8 }}>
            1. Set number of tables → Generate QR codes<br />
            2. Print and stick on each table<br />
            3. Customers scan → order from their phone<br />
            4. Orders appear in Kitchen Display automatically 🍳
          </div>
        </div>
      )}
    </div>
  );
}
