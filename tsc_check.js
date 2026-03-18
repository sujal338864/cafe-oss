const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Running tsc check on frontend...');
  const out = execSync('npx tsc --noEmit', {
    cwd: 'C:\\Users\\Lenovo\\Downloads\\files\\frontend',
    encoding: 'utf8'
  });
  console.log('Success!', out);
} catch (e) {
  console.log('Error output:');
  console.log(e.stdout || e.stderr || e.message);
}
