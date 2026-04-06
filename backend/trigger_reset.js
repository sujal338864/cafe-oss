const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 4001,
  path: '/api/auth/reset-admin-emergency',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
