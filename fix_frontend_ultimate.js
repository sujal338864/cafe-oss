const fs = require('fs');

const file = 'c:/Users/Lenovo/Downloads/files/frontend/src/app/dashboard/page.tsx';
const logFile = 'c:/Users/Lenovo/Downloads/files/fix_frontend_ultimate.log';

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

fs.writeFileSync(logFile, 'Log Level: Ultimate\n');

try {
  const data = fs.readFileSync(file, 'utf8');
  const lines = data.split('\n');

  let foundCount = 0;
  let removeIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    // Match flexible spacing
    if (/const\s+load\s*=\s*async/.test(lines[i])) {
      foundCount++;
      log(`Found instance ${foundCount} at line ${i+1}: ${lines[i].trim()}`);
      if (foundCount === 2) {
        removeIndex = i;
      }
    }
  }

  if (removeIndex !== -1) {
    log(`Removing second load starting at line ${removeIndex+1}`);
    
    let braceCount = 0;
    let endIndex = removeIndex;
    
    for (let j = removeIndex; j < lines.length; j++) {
      const line = lines[j];
      const openCount  = (line.match(/{/g) || []).length;
      const closeCount = (line.match(/}/g) || []).length;
      braceCount += openCount - closeCount;
      
      if (braceCount === 0 && j > removeIndex) {
        endIndex = j;
        break;
      }
    }
    
    log(`Function end is line ${endIndex+1}`);
    const linesToRemove = endIndex - removeIndex + 1;
    log(`Removing ${linesToRemove} lines`);
    
    lines.splice(removeIndex, linesToRemove);
    fs.writeFileSync(file, lines.join('\n'));
    log('Fixed successfully with Ultimate Script!');
  } else {
    log('Second instance of load function not found');
  }
} catch (e) {
  log(`CRASHED: ${e.message}`);
}
