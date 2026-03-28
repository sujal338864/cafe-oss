const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('Running taskkill...');
  try {
    execSync('taskkill /f /im node.exe', { stdio: 'ignore' });
  } catch (e) {}

  console.log('Running prisma db push...');
  const out1 = execSync('npx -y prisma db push --accept-data-loss', { encoding: 'utf8' });
  fs.writeFileSync('db_push.txt', out1);

  console.log('Running prisma generate...');
  const out2 = execSync('npx -y prisma generate', { encoding: 'utf8' });
  fs.writeFileSync('generate.txt', out2);
  
  console.log('SUCCESS');
} catch (e) {
  fs.writeFileSync('prisma_error.txt', (e.stdout || '') + '\\n\\n' + (e.stderr || '') + '\\n\\n' + e.message);
  console.log('FAILED');
}
