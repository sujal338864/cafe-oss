const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist') walk(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      let text = fs.readFileSync(full, 'utf8');
      const orig = text;
      text = text.replace(/from '\.\.\/index';/g, "from '../common/prisma';");
      text = text.replace(/from '\.\.\/\.\.\/index';/g, "from '../../common/prisma';");
      if (text !== orig) {
        fs.writeFileSync(full, text, 'utf8');
        console.log('Fixed:', path.relative(process.cwd(), full));
      }
    }
  }
}

walk(path.join(__dirname, 'src'));
console.log('Done.');
