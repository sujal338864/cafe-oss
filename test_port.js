const http = require('http');
const server = http.createServer();
server.listen(4000, () => {
    console.log('Successfully bound to port 4000');
    server.close();
}).on('error', (err) => {
    console.error('Error binding to port 4000:', err.code);
    process.exit(1);
});
