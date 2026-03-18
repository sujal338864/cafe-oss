const fs = require('fs');

const url = 'https://cafeoss.netlify.app/menu';
const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`;

const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Scanner Menu QR Code - Cafe OS</title>
    <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #080c08; color: #f0fdf4; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { background: #0f1a0f; border: 1px solid #1a2e1a; padding: 40px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); display: inline-block; max-width: 400px; }
        .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 20px; }
        h1 { font-size: 28px; color: #f0fdf4; margin: 0 0 10px; font-weight: 800; }
        p { font-size: 15px; color: #86efac; margin: 0 0 30px; line-height: 1.5; }
        .qr-container { background: white; padding: 20px; border-radius: 16px; display: inline-block; margin-bottom: 24px; border: 4px solid #22c55e; }
        img { display: block; }
        .url { font-family: monospace; background: #1a2e1a; padding: 12px 16px; border-radius: 12px; font-size: 14px; color: #f0fdf4; font-weight: bold; letter-spacing: 0.5px; border: 1px solid #22c55e; }
        .print-btn { background: #22c55e; border: none; color: white; padding: 14px 24px; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 24px; display: inline-flex; align-items: center; gap: 8px; font-family: inherit; }
        .print-btn:hover { background: #16a34a; }
        
        @media print {
            body { background: white; color: black; display: block; padding: 0; }
            .card { border: none; box-shadow: none; background: transparent; margin: 0 auto; padding-top: 50px; }
            h1 { color: black; }
            p { color: #333; }
            .url { background: #f0f0f0; color: black; border: 1px solid #ccc; }
            .print-btn { display: none; }
            .qr-container { border-color: black; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">☕</div>
        <h1>Scan to Order</h1>
        <p>Skip the line! Scan this code with your phone camera to view our menu and place your order.</p>
        
        <div class="qr-container">
            <img src="${qrApiUrl}" alt="QR Code" width="300" height="300" />
        </div>
        
        <div class="url">${url.replace('https://', '')}</div>
        
        <button class="print-btn" onclick="window.print()">🖨️ Print this code</button>
    </div>
</body>
</html>
`;

const dest = 'C:\\Users\\Lenovo\\Downloads\\files\\public_menu_qr.html';
fs.writeFileSync(dest, html);
console.log('✅ Generated public QR code template at:', dest);
console.log('🔗 URL:', url);
