const os = require('os');
const interfaces = os.networkInterfaces();
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      console.log(iface.address);
      process.exit(0);
    }
  }
}
console.log('127.0.0.1');
