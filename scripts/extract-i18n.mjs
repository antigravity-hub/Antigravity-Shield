/**
 * Antigravity Shield — Automated AST i18n Extraction & Consolidation Engine
 * Uses TypeScript 5.8.3 Compiler API for syntax-safe AST transformations.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const EN_JSON_PATH = 'src/locales/en.json';
const PHANTOM_GHOST_PATH = '.agents/teamwork/teamwork_preview_worker_m1/phantom_and_ghost_en.json';

// 1. Load canonical dictionary
const enJson = JSON.parse(fs.readFileSync(EN_JSON_PATH, 'utf-8'));
const phantomGhost = JSON.parse(fs.readFileSync(PHANTOM_GHOST_PATH, 'utf-8'));

// Helper: set deep value in object
function setDeep(obj, pathParts, value) {
  let cur = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!(part in cur) || typeof cur[part] !== 'object' || cur[part] === null) {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[pathParts[pathParts.length - 1]] = value;
}

// Consolidate 133 phantom and ghost keys
for (const [k, v] of Object.entries(phantomGhost)) {
  setDeep(enJson, k.split('.'), v);
}
console.log(`[Consolidation] Consolidated ${Object.keys(phantomGhost).length} phantom & ghost keys into en.json.`);

// Invariant filter matching survey
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

function isInvariant(raw) {
  const t = raw.trim();
  if (!t) return true;
  if (INVARIANTS.has(t)) return true;
  if (/^[0-9\.,:;/\-_\|\(\)\{\}\[\]\+\*=<>\?&%#!@$^\'\"\s•·…—–]+$/.test(t)) return true;
  if (/^v?\d+(\.\d+)*(-[a-zA-Z0-9]+)?$/.test(t)) return true;
  if (/^\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}$/.test(t)) return true;
  if (/^\d+([:\.]\d+)?\s*(ms|s|m|h|px|%|MB|GB|KB|tokens\/s|req\/s|k|M|B)$/i.test(t)) return true;
  if (t.startsWith('#') || t.startsWith('var(--') || t.startsWith('bg-') || t.startsWith('text-') || t.startsWith('border-')) return true;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t) && (t.includes('gemini') || t.includes('claude') || t.includes('gpt') || t.includes('deepseek'))) return true;
  return false;
}

const TARGET_ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'tooltip']);

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

function getNamespaceForFile(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.startsWith('src/components/proxy/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'ProxyDiagnosticsHUD') return 'proxy.diagnostics';
    if (base === 'ProxySettingsTab') return 'proxy.settings';
    if (base === 'ProxyAccountsTab') return 'proxy.accounts';
    if (base === 'ProxyRoutingTab') return 'proxy.routing';
    if (base === 'ProxyOverviewTab') return 'proxy.overview';
    if (base === 'ProxyMonitor') return 'proxy.monitor';
    if (base === 'SortableModelItem') return 'proxy.model_item';
    if (base === 'DroidSyncModal') return 'proxy.droid_sync';
    if (base === 'OpenCodeSyncModal') return 'proxy.opencode_sync';
    return 'proxy';
  }
  if (norm.startsWith('src/components/ecosystem/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'SkillsTab') return 'ecosystem.skills';
    if (base === 'RulesTab') return 'ecosystem.rules';
    if (base === 'McpTab') return 'ecosystem.mcp';
    if (base === 'RichSkillDocViewer') return 'ecosystem.doc_viewer';
    if (base === 'AgentPlatformDropdown') return 'ecosystem.agent_dropdown';
    if (base === 'SecurityAuditDropdown') return 'ecosystem.security_dropdown';
    if (base === 'AgentLogos') return 'ecosystem.agent_logos';
    return 'ecosystem';
  }
  if (norm.startsWith('src/components/accounts/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'AccountErrorDialog') return 'accounts.error_dialog';
    if (base === 'DeviceFingerprintDialog') return 'accounts.fingerprint';
    if (base === 'AccountCard') return 'accounts.card';
    if (base === 'AccountTable') return 'accounts.table';
    if (base === 'AccountRow') return 'accounts.row';
    if (base === 'AccountDetailsDialog') return 'accounts.details';
    if (base === 'WeeklyCountdown') return 'accounts.countdown';
    return 'accounts';
  }
  if (norm.startsWith('src/pages/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'ApiKeyFun') return 'apiKeyFun';
    if (base === 'ApiProxy') return 'proxy.page';
    if (base === 'Settings') return 'settings';
    if (base === 'UserToken') return 'user_token';
    if (base === 'Accounts') return 'accounts.page';
    if (base === 'Dashboard') return 'dashboard';
    return 'pages';
  }
  if (norm.startsWith('src/components/common/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'FlagIcon') return 'common.flags';
    if (base === 'SupportModal') return 'common.support';
    if (base === 'TargetAppIcons') return 'common.target_apps';
    if (base === 'ErrorBoundary') return 'common.error_boundary';
    if (base === 'AccentColorPicker') return 'common.accent';
    if (base === 'NetworkMonitor') return 'common.network';
    if (base === 'Pagination') return 'common.pagination';
    if (base === 'VerificationGuideModal') return 'common.verification';
    return 'common';
  }
  if (norm.startsWith('src/components/layout/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'MiniView') return 'layout.mini_view';
    if (base === 'Sidebar') return 'sidebar';
    return 'layout';
  }
  if (norm.startsWith('src/components/stats/')) {
    return 'token_stats.heatmap';
  }
  if (norm.startsWith('src/components/dashboard/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'CurrentAccount') return 'dashboard.widget_current';
    if (base === 'BestAccounts') return 'dashboard.widget_best';
    if (base === 'NetworkHealthPulse') return 'dashboard.health_pulse';
    return 'dashboard';
  }
  if (norm.startsWith('src/components/settings/proxy/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'BatchImportModal') return 'settings.batch_import';
    if (base === 'ProxyEditModal') return 'settings.proxy_edit';
    return 'settings.proxy';
  }
  if (norm.startsWith('src/components/settings/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'AntigravityRtlCard') return 'rtl_card';
    if (base === 'PinnedQuotaModels') return 'settings.pinned_models';
    if (base === 'ThinkingBudget') return 'settings.thinking_budget';
    return 'settings';
  }
  if (norm.startsWith('src/components/debug/')) {
    return 'debug_console';
  }
  if (norm.startsWith('src/components/navbar/')) {
    const base = path.basename(norm, '.tsx');
    if (base === 'NavLogo') return 'nav.logo';
    if (base === 'ToolkitIntegrationModal') return 'nav.toolkit_modal';
    return 'nav';
  }
  if (norm.startsWith('src/components/overlay/')) {
    return 'notifications.overlay';
  }
  if (norm.startsWith('src/components/security/')) {
    return 'security.ip_stats';
  }
  if (norm === 'src/components/UpdateNotification.tsx') {
    return 'update_notification';
  }
  if (norm === 'src/App.tsx') {
    return 'common.app';
  }
  return 'common';
}

const keyMap = new Map();
const seenKeys = new Set();

function allocateKey(filePath, text) {
  const ns = getNamespaceForFile(filePath);
  let baseSuffix = slugify(text) || 'text';
  let fullKey = `${ns}.${baseSuffix}`;
  let count = 1;
  while (seenKeys.has(fullKey)) {
    count++;
    fullKey = `${ns}.${baseSuffix}_${count}`;
  }
  seenKeys.add(fullKey);
  return fullKey;
}

// Track stats
let totalTransformedFiles = 0;
let totalReplacedStrings = 0;

// Read survey_ast.json to know the exact files to process
const surveyAst = JSON.parse(fs.readFileSync('.agents/teamwork/teamwork_preview_explorer_survey_1/survey_ast.json', 'utf-8'));
const filesToProcess = Object.keys(surveyAst);

for (const relPath of filesToProcess) {
  if (relPath === 'src/components/common/ErrorBoundary.tsx' || relPath === 'src/App.tsx' || relPath === 'src/components/common/FlagIcon.tsx' || relPath === 'src/components/common/TargetAppIcons.tsx' || relPath === 'src/components/ecosystem/AgentLogos.tsx' || relPath === 'src/components/navbar/NavLogo.tsx') {
    // Already manually processed and verified
    continue;
  }

  const fullPath = path.resolve(relPath);
  let content = fs.readFileSync(fullPath, 'utf-8');
  let sf = ts.createSourceFile(fullPath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const replacements = [];

  function isCandidate(text) {
    const clean = text.trim();
    if (clean.length > 1 && /[a-zA-Z]{2,}/.test(clean)) {
      return !isInvariant(clean);
    }
    return false;
  }

  function visitor(node) {
    // 1. JsxText
    if (ts.isJsxText(node)) {
      const raw = content.slice(node.pos, node.end);
      const match = raw.match(/^(\s*)(.*?)(\s*)$/s);
      if (match) {
        const leading = match[1];
        const body = match[2];
        const trailing = match[3];
        if (isCandidate(body)) {
          const key = allocateKey(relPath, body);
          setDeep(enJson, key.split('.'), body);
          replacements.push({
            start: node.pos,
            end: node.end,
            replacement: `${leading}{t('${key}', ${JSON.stringify(body)})}${trailing}`
          });
        }
      }
    }

    // 2. JsxAttribute
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.text;
      if (TARGET_ATTRS.has(attrName) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          const text = node.initializer.text.trim();
          if (isCandidate(text)) {
            const key = allocateKey(relPath, text);
            setDeep(enJson, key.split('.'), text);
            replacements.push({
              start: node.initializer.getStart(sf),
              end: node.initializer.getEnd(),
              replacement: `{t('${key}', ${JSON.stringify(text)})}`
            });
          }
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expr = node.initializer.expression;
          if (ts.isStringLiteral(expr)) {
            const text = expr.text.trim();
            if (isCandidate(text)) {
              const key = allocateKey(relPath, text);
              setDeep(enJson, key.split('.'), text);
              replacements.push({
                start: expr.getStart(sf),
                end: expr.getEnd(),
                replacement: `t('${key}', ${JSON.stringify(text)})`
              });
            }
          } else if (ts.isConditionalExpression(expr)) {
            if (ts.isStringLiteral(expr.whenTrue) && isCandidate(expr.whenTrue.text)) {
              const text = expr.whenTrue.text.trim();
              const key = allocateKey(relPath, text);
              setDeep(enJson, key.split('.'), text);
              replacements.push({
                start: expr.whenTrue.getStart(sf),
                end: expr.whenTrue.getEnd(),
                replacement: `t('${key}', ${JSON.stringify(text)})`
              });
            }
            if (ts.isStringLiteral(expr.whenFalse) && isCandidate(expr.whenFalse.text)) {
              const text = expr.whenFalse.text.trim();
              const key = allocateKey(relPath, text);
              setDeep(enJson, key.split('.'), text);
              replacements.push({
                start: expr.whenFalse.getStart(sf),
                end: expr.whenFalse.getEnd(),
                replacement: `t('${key}', ${JSON.stringify(text)})`
              });
            }
          }
        }
      }
    }

    // 3. String literal inside JSX Expression
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const expr = node.expression;
      if (ts.isStringLiteral(expr)) {
        const text = expr.text.trim();
        if (isCandidate(text)) {
          const key = allocateKey(relPath, text);
          setDeep(enJson, key.split('.'), text);
          replacements.push({
            start: expr.getStart(sf),
            end: expr.getEnd(),
            replacement: `t('${key}', ${JSON.stringify(text)})`
          });
        }
      } else if (ts.isConditionalExpression(expr)) {
        if (ts.isStringLiteral(expr.whenTrue) && isCandidate(expr.whenTrue.text)) {
          const text = expr.whenTrue.text.trim();
          const key = allocateKey(relPath, text);
          setDeep(enJson, key.split('.'), text);
          replacements.push({
            start: expr.whenTrue.getStart(sf),
            end: expr.whenTrue.getEnd(),
            replacement: `t('${key}', ${JSON.stringify(text)})`
          });
        }
        if (ts.isStringLiteral(expr.whenFalse) && isCandidate(expr.whenFalse.text)) {
          const text = expr.whenFalse.text.trim();
          const key = allocateKey(relPath, text);
          setDeep(enJson, key.split('.'), text);
          replacements.push({
            start: expr.whenFalse.getStart(sf),
            end: expr.whenFalse.getEnd(),
            replacement: `t('${key}', ${JSON.stringify(text)})`
          });
        }
      }
    }

    ts.forEachChild(node, visitor);
  }

  visitor(sf);

  if (replacements.length > 0) {
    replacements.sort((a, b) => b.start - a.start);
    for (const r of replacements) {
      content = content.slice(0, r.start) + r.replacement + content.slice(r.end);
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    totalTransformedFiles++;
    totalReplacedStrings += replacements.length;
    console.log(`[Extracted] ${relPath}: ${replacements.length} strings wrapped.`);
  }
}

// Save canonical en.json with CRLF and 2 spaces
const formattedEn = JSON.stringify(enJson, null, 2).replace(/\n/g, '\r\n') + '\r\n';
fs.writeFileSync(EN_JSON_PATH, formattedEn, 'utf-8');

console.log(`\n=== EXTRACTION COMPLETE ===`);
console.log(`Transformed files: ${totalTransformedFiles}`);
console.log(`Wrapped strings: ${totalReplacedStrings}`);
console.log(`Updated canonical dictionary: ${EN_JSON_PATH}`);
