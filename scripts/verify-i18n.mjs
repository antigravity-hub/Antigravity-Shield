#!/usr/bin/env node
/**
 * Antigravity Shield — Automated i18n Verification Suite & Build Gate
 * 
 * Enforces 5 Production Quality Gates:
 * - Gate 1: 100% Key Parity across all 13 locale JSON files (0 missing, 0 extra).
 * - Gate 2: 100% Interpolation Variable Integrity ({{...}} exact matching).
 * - Gate 3: Zero Untranslated Raw English Placeholder Sentences in non-English locales.
 * - Gate 4: Zero Un-localized User-Facing Strings across src/ .tsx files (TypeScript AST API).
 * - Gate 5: TypeScript Compilation Gate (tsc --noEmit).
 * 
 * Exits with code 0 on complete pass, code 1 on failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT_DIR, 'src', 'locales');
const SRC_DIR = path.join(ROOT_DIR, 'src');

const ALL_LOCALES = [
  'en', 'ar', 'es', 'fa', 'ja', 'ko', 'my', 'pt', 'ru', 'tr', 'vi', 'zh-TW', 'zh'
];

const NON_EN_LOCALES = ALL_LOCALES.filter(l => l !== 'en');

// Allowlisted brand invariants, protocols, model names, and language endonyms
const BRAND_INVARIANTS = new Set([
  'Antigravity Shield', 'Antigravity Platform', 'Antigravity IDE', 'Antigravity CLI',
  'Antigravity Shield Gateway', 'Antigravity Logo', 'Antigravity', 'Shield',
  'PRO', 'ULTRA', 'FREE', 'Free', 'PRO PAID', 'PRO_LOW', 'PRO_HIGH',
  'Gemini', 'Claude', 'Claude Code', 'Cursor', 'Windsurf', 'VS Code', 'GitHub',
  'Google Cloud', 'Google Cloud Console', 'Google Antigravity', 'Google AI Pro',
  'Google AI Ultra', 'Google', 'OAuth', 'Tauri', 'Rust', 'Vite', 'React', 'Axum', 'Tokio',
  'Tailwind', 'Docker', 'SQLite', 'Node.js', 'TypeScript', 'JSON', 'URL', 'API',
  'API Key', 'SSE', 'HTTP', 'GET', 'POST', 'PUT', 'DELETE', 'IP', 'ID', 'UUID',
  'OpenAI', 'Anthropic', 'DeepSeek', 'Cline', 'Roo Code', 'OpenCode', 'Zed',
  'IntelliJ', 'PyCharm', 'WebStorm', 'Kodu', 'Continue', 'Emacs', 'Neovim',
  'Claude 3.5 Sonnet', 'GPT-4o', 'GPT-4', 'Gemini 1.5 Pro', 'Gemini 1.5 Flash',
  'Gemini 2.0 Flash', 'Gemini 2.5 Pro', 'Gemini 3.8 Flash', 'Gemini 4 Argon',
  'Claude Sonnet 4.6', 'Claude Opus 4.6', 'Claude 3.5 Haiku', 'gemini-3.8-flash',
  'gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-4-argon',
  'claude-sonnet-4-6', 'claude-opus-4-6', 'Gemini Pro', 'Gemini Flash', 'Gemini 3',
  'Gemini (Image)', 'Claude (Opus)', 'Sonnet 3.5, Haiku 3.5', 'GPT-4, Turbo, o1-preview',
  'GPT-4o, Mini, 3.5 Turbo', 'GPT-5.1, GPT-5.2 xhigh', 'English', 'Español', 'Français',
  'Deutsch', 'Italiano', 'Português', 'Русский', 'Türkçe', 'Tiếng Việt',
  'العربية', 'فارسی', '日本語', '한국어', '简体中文', '繁體中文', 'Bahasa Melayu',
  'Myanmar (မြန်မာ)', 'GRAM (TON)', 'Tron (TRX / USDT)', 'Tauri v2', 'React 19',
  'v6.1 Native', 'OpenAI / Claude', 'Auth: Bearer Token', 'SSE Real-Time Stream',
  'OpenAI Protocol', 'Claude Protocol', 'GEMINI.md', 'AGENTS.md', 'SKILL.md',
  'Skills.sh', 'N/A (Free)', 'v1', 'v2', 'v3', 'localhost', '127.0.0.1', '0.0.0.0',
  '/v1/chat/completions', '/v1/messages', '/v1/models', 'WARP', 'Cloudflare WARP', 'POOL',
  'ATTENTION', 'HEALTHY', 'OK', 'ok', 'EN', 'ZH', 'FA', 'AR', 'JA', 'KO', 'RU',
  'TR', 'VI', 'ES', 'PT', 'MY', '@DrGuidance', 'machineId:', 'sqmId:',
  'devDeviceId:', 'macMachineId:', 'Claude 0%'
]);

function isBrandOrTechnicalInvariant(str) {
  if (!str) return true;
  const t = str.trim();
  if (!t) return true;
  if (BRAND_INVARIANTS.has(t)) return true;
  // URL or API path
  if (/^(http|https):\/\//i.test(t)) return true;
  if (/^(\/v[0-9]|~\/)/.test(t)) return true;
  // Shell command / CLI invocation
  if (/^(export|brew|sudo|gcloud|git|npm|npx|curl)\s/i.test(t)) return true;
  // File path or argument flag
  if (/^(--[a-z0-9_\-=\/]+|[a-zA-Z]:[\\\/]|\/)/.test(t)) return true;
  // Technical placeholder examples (IPs, CIDRs, socket/URL protocols)
  if (/^e\.g\.\s*(socks5|http|https|[0-9]{1,3}\.[0-9]{1,3})/i.test(t)) return true;
  // Pure punctuation, numbers, math, and unicode symbols
  if (/^[0-9\.,:;/\-_\|\(\)\{\}\[\]\+\*=<>\?&%#!@$^\'\"\s•·…—–⚡🛡️⚠️✓❌]+$/.test(t)) return true;
  // Technical identifiers (alphanumeric with underscores, hyphens, colons)
  if (/^[a-zA-Z0-9_\-\.\:\@/]+$/.test(t) && !/\s/.test(t)) return true;
  return false;
}

function flattenKeys(obj, prefix = '') {
  const res = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(res, flattenKeys(v, fullKey));
    } else {
      res[fullKey] = String(v ?? '');
    }
  }
  return res;
}

function extractVariables(text) {
  const matches = String(text).match(/\{\{([^}]+)\}\}/g) || [];
  return Array.from(new Set(matches.map(m => m.slice(2, -2).trim()))).sort();
}

console.log('='.repeat(80));
console.log('🛡️  ANTIGRAVITY SHIELD — AUTOMATED i18n VERIFICATION & BUILD GATE');
console.log('='.repeat(80));

let globalPass = true;

// -----------------------------------------------------------------------------
// GATE 1: 100% Key Parity Across All 13 Locales
// -----------------------------------------------------------------------------
console.log('\n[GATE 1] 100% Key Parity Across All 13 Locales');
console.log('-'.repeat(80));

const enPath = path.join(LOCALES_DIR, 'en.json');
if (!fs.existsSync(enPath)) {
  console.error('❌ FATAL: Canonical src/locales/en.json not found!');
  process.exit(1);
}

const enRaw = fs.readFileSync(enPath, 'utf8');
const enHasBom = enRaw.charCodeAt(0) === 0xFEFF;
const enData = JSON.parse(enRaw);
const enFlat = flattenKeys(enData);
const expectedKeyCount = Object.keys(enFlat).length;

const gate1Results = [];
let gate1Pass = true;

for (const loc of ALL_LOCALES) {
  const locPath = path.join(LOCALES_DIR, `${loc}.json`);
  if (!fs.existsSync(locPath)) {
    gate1Results.push({ locale: `${loc}.json`, leafCount: 0, missing: expectedKeyCount, extra: 0, noBom: false, crlf: false, pass: false });
    gate1Pass = false;
    continue;
  }

  const rawBytes = fs.readFileSync(locPath);
  const rawStr = rawBytes.toString('utf8');
  const hasBom = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
  const hasCrlf = rawBytes.includes(Buffer.from('\r\n'));
  
  let locData;
  try {
    locData = JSON.parse(rawStr);
  } catch (err) {
    gate1Results.push({ locale: `${loc}.json`, leafCount: 0, missing: expectedKeyCount, extra: 0, noBom: !hasBom, crlf: hasCrlf, pass: false, error: err.message });
    gate1Pass = false;
    continue;
  }

  const locFlat = flattenKeys(locData);
  const leafCount = Object.keys(locFlat).length;
  const missing = Object.keys(enFlat).filter(k => !(k in locFlat));
  const extra = Object.keys(locFlat).filter(k => !(k in enFlat));

  const pass = !hasBom && hasCrlf && leafCount === expectedKeyCount && missing.length === 0 && extra.length === 0;
  if (!pass) gate1Pass = false;

  gate1Results.push({
    locale: `${loc}.json`,
    leafCount,
    missing: missing.length,
    extra: extra.length,
    noBom: !hasBom,
    crlf: hasCrlf,
    pass
  });
}

console.log(
  'Locale'.padEnd(14) + ' | ' +
  'Leaf Keys'.padEnd(11) + ' | ' +
  'Missing'.padEnd(8) + ' | ' +
  'Extra'.padEnd(6) + ' | ' +
  'No BOM'.padEnd(7) + ' | ' +
  'CRLF'.padEnd(5) + ' | ' +
  'Status'
);
console.log('-'.repeat(80));
for (const r of gate1Results) {
  console.log(
    r.locale.padEnd(14) + ' | ' +
    `${r.leafCount}/${expectedKeyCount}`.padEnd(11) + ' | ' +
    String(r.missing).padEnd(8) + ' | ' +
    String(r.extra).padEnd(6) + ' | ' +
    (r.noBom ? 'YES' : 'NO').padEnd(7) + ' | ' +
    (r.crlf ? 'YES' : 'NO').padEnd(5) + ' | ' +
    (r.pass ? '✅ PASS' : '❌ FAIL')
  );
}

if (!gate1Pass) {
  console.error('❌ GATE 1 FAILED: Discrepancy in locale key parity.');
  globalPass = false;
} else {
  console.log('✨ GATE 1 PASSED: 100% key parity & formatting verified across all 13 locales.');
}

// -----------------------------------------------------------------------------
// GATE 2: 100% Interpolation Variable Integrity
// -----------------------------------------------------------------------------
console.log('\n[GATE 2] 100% Interpolation Variable Integrity');
console.log('-'.repeat(80));

const gate2Results = [];
let gate2Pass = true;

for (const loc of ALL_LOCALES) {
  const locPath = path.join(LOCALES_DIR, `${loc}.json`);
  const locData = flattenKeys(JSON.parse(fs.readFileSync(locPath, 'utf8')));
  
  let checkedWithVars = 0;
  const mismatches = [];

  for (const [k, enVal] of Object.entries(enFlat)) {
    const enVars = extractVariables(enVal);
    if (enVars.length > 0) {
      checkedWithVars++;
      const locVal = locData[k] || '';
      const locVars = extractVariables(locVal);
      if (JSON.stringify(enVars) !== JSON.stringify(locVars)) {
        mismatches.push({ key: k, expected: enVars, found: locVars });
      }
    }
  }

  const pass = mismatches.length === 0;
  if (!pass) gate2Pass = false;

  gate2Results.push({
    locale: `${loc}.json`,
    checkedWithVars,
    mismatches: mismatches.length,
    pass
  });
}

console.log(
  'Locale'.padEnd(14) + ' | ' +
  'Keys With Vars'.padEnd(16) + ' | ' +
  'Mismatches'.padEnd(12) + ' | ' +
  'Status'
);
console.log('-'.repeat(80));
for (const r of gate2Results) {
  console.log(
    r.locale.padEnd(14) + ' | ' +
    String(r.checkedWithVars).padEnd(16) + ' | ' +
    String(r.mismatches).padEnd(12) + ' | ' +
    (r.pass ? '✅ PASS' : '❌ FAIL')
  );
}

if (!gate2Pass) {
  console.error('❌ GATE 2 FAILED: Variable mismatch detected in translations.');
  globalPass = false;
} else {
  console.log('✨ GATE 2 PASSED: 100% variable consistency across all translations.');
}

// -----------------------------------------------------------------------------
// GATE 3: Zero Untranslated Raw English Placeholder Sentences in Non-English Locales
// -----------------------------------------------------------------------------
console.log('\n[GATE 3] Zero Untranslated Raw English Placeholder Sentences in Non-English Locales');
console.log('-'.repeat(80));

const DUMMY_MARKERS_REGEX = /\b(TODO|TBD|FIXME|LOREM IPSUM|PLACEHOLDER_TEXT)\b/;

const gate3Results = [];
let gate3Pass = true;

for (const loc of NON_EN_LOCALES) {
  const locPath = path.join(LOCALES_DIR, `${loc}.json`);
  const locData = flattenKeys(JSON.parse(fs.readFileSync(locPath, 'utf8')));

  let placeholderCount = 0;
  const untranslatedPlaceholders = [];
  const dummyMarkers = [];

  for (const [k, enVal] of Object.entries(enFlat)) {
    const locVal = locData[k] || '';

    // Check for dummy markers (e.g. uppercase TODO, TBD, FIXME)
    if (DUMMY_MARKERS_REGEX.test(locVal)) {
      dummyMarkers.push({ key: k, value: locVal });
    }

    // Check placeholder keys and prompt sentences
    const isPlaceholderKey = k.toLowerCase().includes('placeholder') || k.toLowerCase().includes('prompt');
    const isPlaceholderAction = /^(enter|paste|search|type|select|choose|add|leave empty)\s/i.test(enVal.trim());

    if (isPlaceholderKey || isPlaceholderAction) {
      // Exclude technical paths, flags, numbers, or brand invariants
      if (!isBrandOrTechnicalInvariant(enVal)) {
        placeholderCount++;
        // If identical to English and not an invariant, it is an untranslated English placeholder sentence
        if (locVal.trim() === enVal.trim()) {
          untranslatedPlaceholders.push({ key: k, value: locVal });
        }
      }
    }
  }

  const pass = untranslatedPlaceholders.length === 0 && dummyMarkers.length === 0;
  if (!pass) gate3Pass = false;

  gate3Results.push({
    locale: `${loc}.json`,
    placeholderCount,
    untranslated: untranslatedPlaceholders.length,
    dummy: dummyMarkers.length,
    pass
  });
}

console.log(
  'Locale'.padEnd(14) + ' | ' +
  'Placeholders Checked'.padEnd(22) + ' | ' +
  'Untranslated Placeholders'.padEnd(26) + ' | ' +
  'Dummy Markers'.padEnd(14) + ' | ' +
  'Status'
);
console.log('-'.repeat(80));
for (const r of gate3Results) {
  console.log(
    r.locale.padEnd(14) + ' | ' +
    String(r.placeholderCount).padEnd(22) + ' | ' +
    String(r.untranslated).padEnd(26) + ' | ' +
    String(r.dummy).padEnd(14) + ' | ' +
    (r.pass ? '✅ PASS' : '❌ FAIL')
  );
}

if (!gate3Pass) {
  console.error('❌ GATE 3 FAILED: Found untranslated raw English placeholder sentences in non-English locales.');
  globalPass = false;
} else {
  console.log('✨ GATE 3 PASSED: 0 untranslated English placeholder sentences across all non-English locales.');
}

// -----------------------------------------------------------------------------
// GATE 4: Zero Un-localized User-Facing Strings Across src/ .tsx Files (AST API)
// -----------------------------------------------------------------------------
console.log('\n[GATE 4] Zero Un-localized User-Facing Strings Across src/ .tsx Files (TypeScript AST API)');
console.log('-'.repeat(80));

const USER_FACING_ATTRS = new Set([
  'placeholder', 'title', 'aria-label', 'alt', 'tooltip', 'label', 'ariaLabel', 'description', 'header'
]);

const AST_INVARIANTS = new Set([
  ...BRAND_INVARIANTS,
  'ms', 's', 'h', '/h', 'px', '%', 'W:', 'R:', 'I:', 'O:', '10s', '15s', '60s', '30s', '120s',
  'IDE', 'CLI', 'Platform', '5H', 'N/A', 'URL', 'TypeScript', 'Tailwind', 'Vite', 'React',
  'Codex', 'Gemini', 'Claude', 'Antigravity', 'Shield', 'PRO', 'ULTRA', 'FREE', 'OpenAI',
  '# Rule Details...'
]);

function isAstIgnoredText(text) {
  if (!text) return true;
  const t = text.trim();
  if (t.length < 2) return true;
  if (AST_INVARIANTS.has(t)) return true;
  if (isBrandOrTechnicalInvariant(t)) return true;
  // Code comments or overrides
  if (t.startsWith('#') || t.startsWith('//') || t.startsWith('/*')) return true;
  // Tailwind class lists or CSS variables
  if (t.startsWith('var(--') || t.startsWith('#') || t.startsWith('rgb')) return true;
  // Pure symbols, emojis, or punctuation without letters
  if (!/[a-zA-Z\u0600-\u06FF\u4E00-\u9FFF]/.test(t)) return true;
  // Dynamic template literals, ratio suffixes, time/percentage formats, or unit fragments like "x •", "h)", "ms)", "s)", "%)"
  if (/^[\(\[]?(\d+([:\.]\d+)?\s*)?(ms|s|m|h|px|%|MB|GB|KB|tokens\/s|req\/s|k|M|B|x|•)(\s*•)?[\)\]]?$/i.test(t)) return true;
  return false;
}

const astFindings = {
  jsxText: [],
  attrs: [],
  calls: []
};

let scannedTsxCount = 0;

function walkTsxFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'locales' && entry.name !== 'node_modules') {
        walkTsxFiles(full);
      }
    } else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.d.ts')) {
      scannedTsxCount++;
      scanTsxFile(full);
    }
  }
}

function scanTsxFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(
    filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
  );

  function walk(node) {
    // 1. JSX text
    if (ts.isJsxText(node)) {
      const text = node.getText(sf).trim();
      if (text && !isAstIgnoredText(text)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        astFindings.jsxText.push({
          file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
          line: line + 1,
          text
        });
      }
    }

    // 2. JSX attributes (placeholder, title, aria-label, etc.)
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sf);
      if (USER_FACING_ATTRS.has(attrName.toLowerCase()) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          const text = node.initializer.text.trim();
          if (text && !isAstIgnoredText(text)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            astFindings.attrs.push({
              file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
              line: line + 1,
              attr: attrName,
              text
            });
          }
        }
      }
    }

    // 3. User alerts/toasts
    if (ts.isCallExpression(node)) {
      const expr = node.expression.getText(sf);
      if (/^(toast|message)\.(error|success|info|warning)$/.test(expr)) {
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
          const text = node.arguments[0].text.trim();
          if (text && !isAstIgnoredText(text)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            astFindings.calls.push({
              file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
              line: line + 1,
              call: expr,
              text
            });
          }
        }
      }
    }

    ts.forEachChild(node, walk);
  }

  walk(sf);
}

walkTsxFiles(SRC_DIR);

const totalAstViolations = astFindings.jsxText.length + astFindings.attrs.length + astFindings.calls.length;
const gate4Pass = totalAstViolations === 0;

console.log(
  'Scope'.padEnd(16) + ' | ' +
  'Scanned Files'.padEnd(15) + ' | ' +
  'JSX Text'.padEnd(10) + ' | ' +
  'Attributes'.padEnd(12) + ' | ' +
  'Toasts'.padEnd(8) + ' | ' +
  'Violations'.padEnd(12) + ' | ' +
  'Status'
);
console.log('-'.repeat(80));
console.log(
  'src/**/*.tsx'.padEnd(16) + ' | ' +
  `${scannedTsxCount} files`.padEnd(15) + ' | ' +
  String(astFindings.jsxText.length).padEnd(10) + ' | ' +
  String(astFindings.attrs.length).padEnd(12) + ' | ' +
  String(astFindings.calls.length).padEnd(8) + ' | ' +
  String(totalAstViolations).padEnd(12) + ' | ' +
  (gate4Pass ? '✅ PASS' : '❌ FAIL')
);

if (!gate4Pass) {
  console.error('❌ GATE 4 FAILED: Hardcoded un-localized user-facing strings found in .tsx files:');
  for (const f of [...astFindings.jsxText, ...astFindings.attrs, ...astFindings.calls].slice(0, 10)) {
    console.error(`   ${f.file}:${f.line} -> "${f.text}"`);
  }
  globalPass = false;
} else {
  console.log(`✨ GATE 4 PASSED: 0 un-localized strings detected across all ${scannedTsxCount} .tsx source files.`);
}

// -----------------------------------------------------------------------------
// GATE 5: TypeScript Compilation Build Gate (tsc --noEmit)
// -----------------------------------------------------------------------------
console.log('\n[GATE 5] TypeScript Compilation Gate (tsc --noEmit)');
console.log('-'.repeat(80));

let gate5Pass = true;
let tscErrorOutput = '';

try {
  console.log('Running `tsc --noEmit`...');
  execSync('npx tsc --noEmit', { cwd: ROOT_DIR, stdio: 'pipe', encoding: 'utf8' });
  console.log('✅ tsc --noEmit completed with 0 errors.');
} catch (err) {
  gate5Pass = false;
  tscErrorOutput = err.stdout || err.stderr || err.message;
  console.error('❌ tsc --noEmit failed with errors:');
  console.error(tscErrorOutput.slice(0, 1000));
}

if (!gate5Pass) {
  globalPass = false;
} else {
  console.log('✨ GATE 5 PASSED: Full TypeScript compilation passed cleanly with 0 type errors.');
}

// -----------------------------------------------------------------------------
// FINAL SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n' + '='.repeat(80));
console.log('📊 i18n VERIFICATION SUMMARY & AUDIT GATE RESULTS');
console.log('='.repeat(80));
console.log(`[Gate 1] 100% 13-Locale Key Parity & Formatting : ${gate1Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`[Gate 2] 100% Variable {{...}} Integrity         : ${gate2Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`[Gate 3] Zero Untranslated Placeholder Sentences : ${gate3Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`[Gate 4] Zero Un-localized Strings in .tsx Files : ${gate4Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`[Gate 5] TypeScript Type Safety (tsc --noEmit)   : ${gate5Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('='.repeat(80));

if (globalPass) {
  console.log('🏆 VERDICT: ALL 5 QUALITY GATES PASSED! READY FOR BUILD & AUDIT ATTESTATION.\n');
  process.exit(0);
} else {
  console.error('💥 VERDICT: VERIFICATION FAILED. Review errors above and resolve before re-running.\n');
  process.exit(1);
}
