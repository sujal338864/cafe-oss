console.log('--- NODE RUNTIME TEST ---');
console.log('PID:', process.pid);
console.log('CWD:', process.cwd());
console.log('ENV:', process.env.NODE_ENV || 'development');
setTimeout(() => {
    console.log('✅ Node.js is running successfully.');
    process.exit(0);
}, 1000);
