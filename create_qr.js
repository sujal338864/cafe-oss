const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const isV4 = iface.family === 'IPv4' || iface.family === 4;
      if (isV4 && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLocalIp();
const url = `http://${ip}:3000/menu`;
const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Scanner Menu QR Code</title>
    <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #080c08; color: #f0fdf4; }
        .card { background: #0f1a0f; border: 1px solid #1a2e1a; padding: 30px; border-radius: 20px; display: inline-block; max-width: 360px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        h1 { font-size: 22px; color: #22c55e; }
        p { font-size: 14px; color: #86efac; margin-bottom: 20px; }
        img { border-radius: 12px; background: white; padding: 10px; margin-bottom: 20px; }
        .url { font-family: monospace; background: #1a2e1a; padding: 8px 12px; border-radius: 8px; font-size: 12px; color: #f0fdf4; word-break: break-all; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Scan to Open Menu</h1>
        <p>Connect your phone to the <b>same Wi-Fi</b> network and scan this code:</p>
        <img src="${qrApiUrl}" alt="QR Code" width="300" height="300" />
        <div class="url">${url}</div>
    </div>
</body>
</html>
`;

const dest = 'C:\\Users\\Lenovo\\Downloads\\files\\menu_qr.html';
fs.writeFileSync(dest, html);
console.log('Generated successfully at:', dest);
