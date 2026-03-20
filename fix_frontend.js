const fs = require('fs');

const file = 'c:/Users/Lenovo/Downloads/files/frontend/src/app/dashboard/page.tsx';
const data = fs.readFileSync(file, 'utf8');
const lines = data.split('\r\n'); // Windows

console.log('Line 56 (0-indexed 55):', lines[55]);

if (lines[55].includes('const load')) {
  console.log('Found duplicate load. Removing 15 lines...');
  lines.splice(55, 15); // Remove lines 56-70 inclusive
  fs.writeFileSync(file, lines.join('\r\n'));
  console.log('Fixed file.');
} else {
  console.log('Trying with \\n split...');
  const linesN = data.split('\n');
  if (linesN[55].includes('const load')) {
     linesN.splice(55, 15);
     fs.writeFileSync(file, linesN.join('\n'));
     console.log('Fixed file with \\n!');
  } else {
     console.log('Could not find load at index 55');
  }
}
