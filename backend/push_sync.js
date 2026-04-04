const { execSync } = require('child_process');

console.log('--- STARTING DB PUSH ---');
try {
    const output = execSync('npx prisma db push --accept-data-loss', { encoding: 'utf-8', stdio: 'pipe' });
    console.log('OUTPUT:', output);
} catch (error) {
    console.error('ERROR:', error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout);
    if (error.stderr) console.error('STDERR:', error.stderr);
}
console.log('--- DONE ---');
