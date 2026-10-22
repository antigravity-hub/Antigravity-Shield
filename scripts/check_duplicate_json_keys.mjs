import fs from 'fs';
import path from 'path';

function findDuplicateKeysInJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const duplicates = [];
  const stack = [new Set()];

  let inString = false;
  let escape = false;
  let currentStr = '';

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (escape) {
      escape = false;
      currentStr += c;
      continue;
    }
    if (c === '\\') {
      escape = true;
      currentStr += c;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      if (!inString) {
        // String ended. Check if next non-whitespace is ':'
        let j = i + 1;
        while (j < content.length && (content[j] === ' ' || content[j] === '\t' || content[j] === '\r' || content[j] === '\n')) {
          j++;
        }
        if (content[j] === ':') {
          // This is an object key!
          const currentScope = stack[stack.length - 1];
          if (currentScope.has(currentStr)) {
            duplicates.push({ key: currentStr, index: i });
          } else {
            currentScope.add(currentStr);
          }
        }
        currentStr = '';
      }
      continue;
    }
    if (inString) {
      currentStr += c;
      continue;
    }

    if (c === '{') {
      stack.push(new Set());
    } else if (c === '}') {
      if (stack.length > 1) {
        stack.pop();
      }
    }
  }

  return duplicates;
}

const localesDir = path.resolve('src/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

console.log('=== CHECKING FOR DUPLICATE JSON KEYS ACROSS ALL LOCALES ===');
for (const file of files) {
  const fullPath = path.join(localesDir, file);
  const dups = findDuplicateKeysInJson(fullPath);
  if (dups.length > 0) {
    console.log(`[DUPLICATE DETECTED] in ${file}:`);
    dups.forEach(d => console.log(`  - Key: "${d.key}"`));
  } else {
    console.log(`[CLEAN] ${file}: 0 duplicate keys`);
  }
}
