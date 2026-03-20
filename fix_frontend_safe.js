const fs = require('fs');

const file = 'c:/Users/Lenovo/Downloads/files/frontend/src/app/dashboard/page.tsx';
const data = fs.readFileSync(file, 'utf8');
const lines = data.split('\n');

let foundCount = 0;
let removeIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const load = async ()')) {
    foundCount++;
    console.log(`Found instance ${foundCount} at line ${i+1}`);
    if (foundCount === 2) {
      removeIndex = i;
    }
  }
}

if (removeIndex !== -1) {
  console.log(`Removing second load starting at line ${removeIndex+1}`);
  
  // Find closing brace of the function
  let braceCount = 0;
  let endIndex = removeIndex;
  for (let j = removeIndex; j < lines.length; j++) {
    const line = lines[j];
    if (line.includes('{')) braceCount++;
    if (line.includes('}')) braceCount--;
    if (braceCount === 0 && j > removeIndex) {
      endIndex = j;
      break;
    }
  }
  
  console.log(`Function end is line ${endIndex+1}`);
  const linesToRemove = endIndex - removeIndex + 1;
  console.log(`Removing ${linesToRemove} lines`);
  
  lines.splice(removeIndex, linesToRemove);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Fixed successfully with Safe Script!');
} else {
  console.log('Second instance of load function not found');
}
