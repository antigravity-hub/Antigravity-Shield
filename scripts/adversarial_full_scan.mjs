import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC_DIR = 'src';

const INVARIANTS = new Set([
  'Antigravity', 'Antigravity Shield', 'Shield', 'PRO', 'ULTRA', 'FREE', 'Free',
  'JSON', 'URL', 'API', 'IP', 'ID', 'UUID', 'Claude', 'Gemini', 'OpenAI',
  'Anthropic', 'DeepSeek', 'SSE', 'HTTP', 'GET', 'POST', 'PUT', 'DELETE',
  'OAuth', 'SDK', 'CLI', 'MCP', 'SQLite', 'DOM', 'CSS', 'HTML', 'RTL', 'LTR',
  'GitHub', 'Vercel', 'Skills.sh', 'SKILL.md', 'px', 'ms', 's', 'm', 'h', 'd',
  'KB', 'MB', 'GB', 'TB', 'true', 'false', 'null', 'undefined', 'ok', 'OK',
  'v1', 'v2', 'v3', 'beta', 'alpha', 'en', 'fa', 'zh', 'ja', 'ru', 'es',
  'localhost', '127.0.0.1', '0.0.0.0', 'Claude 3.5 Sonnet', 'GPT-4o', 'GPT-4',
  'Gemini 1.5 Pro', 'Gemini 1.5 Flash', 'Gemini 2.0 Flash', 'Gemini 2.5 Pro',
  'Gemini 3.8 Flash', 'Axum', 'Tokio', 'Tauri', 'React', 'Vite', 'Tailwind',
  'npm', 'npx', 'yarn', 'pnpm', 'cargo', 'git', 'Rust', 'TypeScript', 'Node.js',
  'POSIX', 'UTF-8', 'Linux', 'Windows', 'macOS', 'Docker', 'IDE', 'VS Code',
  'Cursor', 'Windsurf', 'Zed', 'IntelliJ', 'PyCharm', 'WebStorm', 'Roo Code',
  'Kodu', 'Cline', 'Continue', 'Emacs', 'Neovim', 'Claude Code', 'Codex',
  'Copilot', 'English', 'Español', 'Français', 'Deutsch', 'Italiano', 'Português',
  'Русский', 'Türkçe', 'Tiếng Việt', 'العربية', 'فارسی', '日本語', '한국어',
  '简体中文', '繁體中文', 'Bahasa Melayu', 'Myanmar (မြန်မာ)'
]);

function isTechnicalOrInvariant(str) {
  if (!str) return true;
  const t = str.trim();
  if (!t) return true;
  if (INVARIANTS.has(t)) return true;
  // pure punctuation / numbers / math symbols
  if (/^[0-9\.,:;/\-_\|\(\)\{\}\[\]\+\*=<>\?&%#!@$^\'\"\s•·…—–⚡🛡️⚠️✓❌•]+$/.test(t)) return true;
  // versions
  if (/^v?\d+(\.\d+)*(-[a-zA-Z0-9]+)?$/.test(t)) return true;
  // numbers with units
  if (/^\d+([:\.]\d+)?\s*(ms|s|m|h|px|%|MB|GB|KB|tokens\/s|req\/s|k|M|B)$/i.test(t)) return true;
  // CSS variables or color codes
  if (t.startsWith('#') || t.startsWith('var(--') || t.startsWith('rgb') || t.startsWith('hsl')) return true;
  // Tailwind class lists
  const words = t.split(/\s+/);
  if (words.length > 1 && words.every(w => /^(bg|text|border|p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|flex|grid|items|justify|w|h|min-w|min-h|max-w|max-h|rounded|shadow|ring|gap|space|col|row|opacity|transition|duration|ease|hover|focus|dark|active|cursor|overflow|z|shrink|grow)-/.test(w) || w === 'flex' || w === 'grid' || w === 'hidden' || w === 'block' || w === 'inline-flex' || w === 'relative' || w === 'absolute' || w === 'fixed' || w === 'truncate')) return true;
  // Model IDs / endpoints
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t) && (t.includes('gemini') || t.includes('claude') || t.includes('gpt') || t.includes('deepseek') || t.includes('llama'))) return true;
  if (/^(\/v[1-9][a-z0-9_\-\/]*)$/.test(t)) return true;
  return false;
}

const USER_ATTRS = new Set([
  'placeholder', 'title', 'aria-label', 'alt', 'tooltip', 'label', 'ariaLabel'
]);

const findings = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const rel = full.replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file === '__tests__' || file === 'locales' || file === 'node_modules') continue;
      walk(full);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (file.endsWith('.d.ts')) continue;
      if (rel === 'src/config/skillsCatalog.ts') continue;
      scanFile(rel, full);
    }
  }
}

function scanFile(relPath, fullPath) {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const isTsx = relPath.endsWith('.tsx');
  const sf = ts.createSourceFile(
    fullPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function getLine(pos) {
    return sf.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function check(node, type, text, extra = '') {
    const clean = (text || '').trim();
    if (!clean) return;
    if (isTechnicalOrInvariant(clean)) return;
    // Check if it contains natural language characters (Latin letters or Persian/Arabic or CJK or Cyrillic)
    if (/[\p{L}]{2,}/u.test(clean)) {
      findings.push({
        file: relPath,
        line: getLine(node.getStart(sf)),
        type,
        text: clean,
        extra
      });
    }
  }

  function inspectNode(node) {
    // 1. JSX text: <div>Hello World</div>
    if (ts.isJsxText(node)) {
      check(node, 'jsx_text', node.text);
    }

    // 2. JSX attribute
    if (ts.isJsxAttribute(node)) {
      const name = node.name.text;
      if (USER_ATTRS.has(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          check(node.initializer, `attr:${name}`, node.initializer.text);
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          inspectExpression(node.initializer.expression, `attr_expr:${name}`);
        }
      }
    }

    // 3. JSX expression: <div>{ expr }</div>
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent) && node.expression) {
      inspectExpression(node.expression, 'jsx_expr');
    }

    ts.forEachChild(node, inspectNode);
  }

  function inspectExpression(expr, context) {
    // String literal
    if (ts.isStringLiteral(expr)) {
      check(expr, `${context}:literal`, expr.text);
      return;
    }
    // Template expression: `Hello ${name}` or `Static text`
    if (ts.isTemplateExpression(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      const text = expr.getText(sf);
      // If template literal contains letters, check it
      check(expr, `${context}:template`, text);
      return;
    }
    // Conditional (Ternary): cond ? A : B
    if (ts.isConditionalExpression(expr)) {
      inspectExpression(expr.whenTrue, `${context}:ternary_true`);
      inspectExpression(expr.whenFalse, `${context}:ternary_false`);
      return;
    }
    // Binary expression: a || b or a && b
    if (ts.isBinaryExpression(expr)) {
      if (expr.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        // e.g. title || 'Default Title'
        inspectExpression(expr.right, `${context}:fallback_or`);
      } else if (expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        // e.g. showText && 'Some Text'
        inspectExpression(expr.right, `${context}:logical_and`);
      }
      return;
    }
    // If it's a CallExpression, check if it's t(...) or formatTimeRemaining(...)
    if (ts.isCallExpression(expr)) {
      const fnName = expr.expression.getText(sf);
      if (fnName === 't' || fnName === 'i18n.t') {
        // localized!
        return;
      }
    }
  }

  inspectNode(sf);
}

walk(SRC_DIR);

console.log(`=== ADVERSARIAL SCAN RESULTS ===`);
console.log(`Total unlocalized instances: ${findings.length}`);

// Breakdown by category
const byType = {};
for (const f of findings) {
  const cat = f.type.split(':')[0];
  byType[cat] = (byType[cat] || 0) + 1;
}
console.log('Breakdown by type:', byType);

// Group by file
const byFile = {};
for (const f of findings) {
  if (!byFile[f.file]) byFile[f.file] = [];
  byFile[f.file].push(f);
}

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n[${file}] — ${items.length} unlocalized instances:`);
  for (const it of items) {
    console.log(`  Line ${it.line} (${it.type}): ${JSON.stringify(it.text.slice(0, 100))}`);
  }
}
