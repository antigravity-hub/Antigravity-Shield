const fs = require('fs');
const path = require('path');

function flattenKeys(obj, prefix = '') {
  let keys = {};
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(keys, flattenKeys(v, full));
    } else {
      keys[full] = String(v);
    }
  }
  return keys;
}

const localesDir = path.resolve('src/locales');
const en = flattenKeys(JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')));
const enKeys = Object.keys(en);
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');

const report = {};

for (const file of files) {
  const loc = flattenKeys(JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8')));
  const missing = [];
  const untranslated = [];
  
  for (const k of enKeys) {
    if (!(k in loc)) {
      missing.push(k);
    } else if (loc[k] === en[k]) {
      // check if en[k] is a sentence or multi-word phrase that should be translated
      // Ignore single words or brand invariants like "Antigravity Shield", "PRO", "API Key", "OK", "JSON", "URL", "100%", etc.
      const val = en[k].trim();
      const isInvariant = /^(Antigravity Shield|PRO|API Key|JSON|URL|OK|Claude|Gemini|GPT-4|Haiku|Opus|Sonnet|DeepSeek|Qwen|Ollama|Linux|macOS|Windows|iOS|Android|Docker|GitHub|cURL|Python|Node\.js|VS Code|Cursor|Windsurf|Cline|Roo Code|OpenCode|Postman|v1\/chat\/completions|v1\/messages)$/i.test(val);
      if (!isInvariant && (val.includes(' ') || val.length > 10)) {
        untranslated.push(k);
      }
    }
  }
  
  report[file] = {
    missingCount: missing.length,
    untranslatedCount: untranslated.length,
    totalNeedingAttention: missing.length + untranslated.length
  };
}

console.table(report);
