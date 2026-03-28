const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = fs.readdirSync(root);

const tags = ['test_', 'db_', 'prisma_', 'check_', 'create_', 'reset_', 'run_', 'upgrade_', 'get_', 'clear_', 'dump_', 'kill_', 'alter_'];
const exts = ['.log', '.txt'];
const specific = ['install_adapter.bat', 'push.bat', 'prisma.$disconnect())', 'shop-os-backend@1.0.0', 'nodemon', 'npm'];

files.forEach(f => {
  if (
    tags.some(t => f.startsWith(t)) || 
    exts.some(e => f.endsWith(e)) || 
    specific.includes(f)
  ) {
    // PROTECT IMPORTANT FILES
    if (['innovation_roadmap.md', 'package.json', 'tsconfig.json', '.env', '.gitignore', 'Dockerfile'].includes(f)) return;
    
    try {
      const p = path.join(root, f);
      if (fs.statSync(p).isFile()) {
        fs.unlinkSync(p);
        console.log('Deleted:', f);
      }
    } catch(e) {}
  }
});
console.log('Cleanup complete.');
