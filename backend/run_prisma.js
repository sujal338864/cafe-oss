const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Prisma sync...');
try {
  const prismaBin = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');
  
  console.log('Running DB Push...');
  const pushOut = execSync(`"${prismaBin}" db push --accept-data-loss`, { encoding: 'utf8', stdio: 'pipe' });
  console.log(pushOut);
  
  console.log('Running Generate...');
  const genOut = execSync(`"${prismaBin}" generate`, { encoding: 'utf8', stdio: 'pipe' });
  console.log(genOut);
  
  console.log('SUCCESS! Prisma Client generated.');
  fs.writeFileSync('prisma_success.txt', 'SUCCESS');
} catch (err) {
  console.error('ERROR OCCURRED:');
  console.error(err.stdout || err.message);
  fs.writeFileSync('prisma_error.txt', err.stdout || err.message);
}
