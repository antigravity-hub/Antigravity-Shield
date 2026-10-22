import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC_DIR = 'src';

// Invariants to ignore (technical terms, brand names, numbers, CSS classes, etc.)
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
  '简体中文', '繁體中文', 'Bahasa Melayu', 'Myanmar (မြန်مار)'
]);

function isInvariant(raw) {
  if (!raw) return true;
  const t = raw.trim();
  if (!t) return true;
  if (INVARIANTS.has(t)) return true;
  if (/^[0-9\.,:;/\-_\|\(\)\{\}\[\]\+\*=<>\?&%#!@$^\'\"\s•·…—–]+$/.test(t)) return true;
  if (/^v?\d+(\.\d+)*(-[a-zA-Z0-9]+)?$/.test(t)) return true;
  if (/^\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}$/.test(t)) return true;
  if (/^\d+([:\.]\d+)?\s*(ms|s|m|h|px|%|MB|GB|KB|tokens\/s|req\/s|k|M|B)$/i.test(t)) return true;
  if (t.startsWith('#') || t.startsWith('var(--') || t.startsWith('bg-') || t.startsWith('text-') || t.startsWith('border-') || t.startsWith('flex') || t.startsWith('grid')) return true;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t) && (t.includes('gemini') || t.includes('claude') || t.includes('gpt') || t.includes('deepseek'))) return true;
  // CSS class combinations or svg paths
  if (t.includes(' ') && t.split(' ').every(w => w.startsWith('bg-') || w.startsWith('text-') || w.startsWith('p-') || w.startsWith('m-') || w.startsWith('border-') || w.startsWith('rounded') || w.startsWith('flex') || w.startsWith('items-') || w.startsWith('justify-') || w.startsWith('w-') || w.startsWith('h-') || w.startsWith('transition') || w.startsWith('duration') || w.startsWith('hover:'))) return true;
  return false;
}

const suspectedIssues = [];

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
      auditFile(rel, full);
    }
  }
}

function auditFile(relPath, fullPath) {
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

  function report(node, type, text, detail = '') {
    const clean = (text || '').trim();
    if (clean.length > 1 && /[a-zA-Z]{2,}/.test(clean) && !isInvariant(clean)) {
      suspectedIssues.push({
        file: relPath,
        line: getLine(node.getStart(sf)),
        type,
        text: clean,
        detail
      });
    }
  }

  function visitor(node) {
    // 1. JSX Text
    if (ts.isJsxText(node)) {
      report(node, 'jsx_text', node.text);
    }

    // 2. JSX Attributes
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.text;
      // Attributes that often hold user-facing text
      const isKnownUserAttr = /^(placeholder|title|aria-label|alt|tooltip|label|header|description|helperText|errorMessage|confirmText|cancelText|badge|caption)$/i.test(attrName);
      if (node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          if (isKnownUserAttr) {
            report(node.initializer, `attr:${attrName}`, node.initializer.text);
          }
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expr = node.initializer.expression;
          if (ts.isStringLiteral(expr) && isKnownUserAttr) {
            report(expr, `attr_expr:${attrName}`, expr.text);
          } else if (ts.isConditionalExpression(expr) && isKnownUserAttr) {
            if (ts.isStringLiteral(expr.whenTrue)) report(expr.whenTrue, `attr_ternary:${attrName}`, expr.whenTrue.text);
            if (ts.isStringLiteral(expr.whenFalse)) report(expr.whenFalse, `attr_ternary:${attrName}`, expr.whenFalse.text);
          } else if (ts.isTemplateExpression(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
            const raw = expr.getText(sf);
            if (isKnownUserAttr) {
              report(expr, `attr_template:${attrName}`, raw);
            }
          }
        }
      }
    }

    // 3. JSX Expression (inside JSX elements)
    if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      if (node.expression) {
        const expr = node.expression;
        // String literal directly: <span>{'Hardcoded'}</span>
        if (ts.isStringLiteral(expr)) {
          report(expr, 'jsx_expr_string', expr.text);
        }
        // Template literal: <span>{`Items: ${count}`}</span>
        if (ts.isTemplateExpression(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
          report(expr, 'jsx_template_literal', expr.getText(sf));
        }
        // Ternary: { cond ? 'A' : 'B' }
        if (ts.isConditionalExpression(expr)) {
          checkTernaryBranch(expr.whenTrue, 'jsx_ternary');
          checkTernaryBranch(expr.whenFalse, 'jsx_ternary');
        }
        // Binary: { cond && 'Text' }
        if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
          if (ts.isStringLiteral(expr.right)) {
            report(expr.right, 'jsx_logical_and', expr.right.text);
          }
        }
      }
    }

    // 4. Calls to toast, notifications, alerts
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sf);
      if (callText.includes('toast') || callText.includes('notification') || callText === 'alert') {
        for (const arg of node.arguments) {
          if (ts.isStringLiteral(arg)) {
            report(arg, 'toast_arg_literal', arg.text, callText);
          } else if (ts.isTemplateExpression(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            report(arg, 'toast_arg_template', arg.getText(sf), callText);
          } else if (ts.isObjectLiteralExpression(arg)) {
            for (const prop of arg.properties) {
              if (ts.isPropertyAssignment(prop)) {
                const propName = prop.name.getText(sf);
                if (/^(description|title|message)$/i.test(propName)) {
                  if (ts.isStringLiteral(prop.initializer)) {
                    report(prop.initializer, `toast_prop:${propName}`, prop.initializer.text, callText);
                  } else if (ts.isTemplateExpression(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
                    report(prop.initializer, `toast_prop_template:${propName}`, prop.initializer.getText(sf), callText);
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visitor);
  }

  function checkTernaryBranch(branch, type) {
    if (ts.isStringLiteral(branch)) {
      report(branch, type, branch.text);
    } else if (ts.isTemplateExpression(branch) || ts.isNoSubstitutionTemplateLiteral(branch)) {
      report(branch, `${type}_template`, branch.getText(sf));
    } else if (ts.isConditionalExpression(branch)) {
      checkTernaryBranch(branch.whenTrue, type);
      checkTernaryBranch(branch.whenFalse, type);
    }
  }

  visitor(sf);
}

walk(SRC_DIR);

console.log(`\n=== ADVERSARIAL AUDIT RESULTS ===`);
console.log(`Total suspected unlocalized strings found: ${suspectedIssues.length}`);

// Group by file
const byFile = {};
for (const issue of suspectedIssues) {
  if (!byFile[issue.file]) byFile[issue.file] = [];
  byFile[issue.file].push(issue);
}

for (const [file, list] of Object.entries(byFile)) {
  console.log(`\n[${file}] — ${list.length} issues:`);
  for (const item of list) {
    console.log(`  Line ${item.line} (${item.type}): "${item.text.slice(0, 80)}" ${item.detail ? `[${item.detail}]` : ''}`);
  }
}
