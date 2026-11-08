import os, re, sys, hashlib, json, shutil, base64

sys.stdout.reconfigure(encoding='utf-8')

APP_DIR = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
OUT_DIR = os.path.join(APP_DIR, "out")
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATCH_RS = os.path.join(REPO_ROOT, "src-tauri", "src", "commands", "patch.rs")

def compute_checksum(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    return hashlib.sha256(data).digest()

def compute_b64_hash(filepath):
    raw = compute_checksum(filepath)
    return base64.b64encode(raw).decode('utf-8').rstrip('=')

# 1. Read patch.rs CSS
with open(PATCH_RS, 'r', encoding='utf-8') as f:
    patch_rs = f.read()
m = re.search(r'pub const VAZIRMATN_RTL_CSS: &str = r#"(.*?)"#;', patch_rs, re.DOTALL)
if not m:
    print("Cannot find VAZIRMATN_RTL_CSS in patch.rs")
    sys.exit(1)
VAZIRMATN_RTL_CSS = m.group(1).strip()
print(f"Extracted VAZIRMATN_RTL_CSS: {len(VAZIRMATN_RTL_CSS):,} bytes")

# 2. Ultra Sentinel
SENTINEL_CODE = """
// [Antigravity-Shield-IDE-BiDi-Sentinel]
(()=>{
  const isPersian = (s) => /[\u0600-\u06FF]/.test(s);

  function applyBiDiToElement(el) {
    if (!el || el.nodeType !== 1) return;

    // 1. Guard against global document and shell nodes
    if (el === document.body || el === document.documentElement || el.tagName === 'BODY' || el.tagName === 'HTML') return;
    if (el.classList.contains('monaco-workbench')) return;

    // 2. Guard against sidebar, editor, and terminal panels
    if (el.closest('.part.sidebar') || el.closest('.sidebar')) return;
    if (el.closest('.part.editor') || el.closest('.editor') || el.closest('.monaco-editor')) return;

    // 3. Guard against chat container / viewport / layout wrappers (Container Scope Inversion Guard)
    if (
      el.classList.contains('auxiliarybar') ||
      el.getAttribute('data-testid') === 'conversation-view' ||
      el.getAttribute('data-testid') === 'autoscroll-viewport' ||
      el.getAttribute('data-testid') === 'chat-message' ||
      el.getAttribute('role') === 'article' ||
      el.hasAttribute('data-aux-pane-open') ||
      el.hasAttribute('data-aux-pane-focus-scope') ||
      el.classList.contains('rendered-markdown') ||
      el.classList.contains('prose') ||
      el.classList.contains('markdown-body')
    ) {
      return;
    }

    // 4. Guard against code blocks, preformatted text, thinking traces, and icon fonts
    if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.closest('pre') || el.closest('code')) return;
    if (el.classList.contains('cursor-edit') || el.closest('.cursor-edit')) return;
    if (
      el.classList.contains('codicon') ||
      el.classList.contains('google-symbols') ||
      (typeof el.className === 'string' && el.className.includes('codicon-'))
    ) {
      return;
    }

    const txt = el.textContent || '';
    if (isPersian(txt)) {
      if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
      if (el.style.direction !== 'rtl') el.style.setProperty('direction', 'rtl', 'important');
      if (el.style.fontFamily !== "'Vazirmatn'") el.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif", 'important');
      if (el.style.textAlign !== 'right') el.style.setProperty('text-align', 'right', 'important');

      if (el.tagName === 'LI') {
        el.style.setProperty('padding-left', '0', 'important');
        el.style.setProperty('margin-left', '0', 'important');
        const parentList = el.closest('ul, ol');
        if (parentList) {
          if (parentList.getAttribute('dir') !== 'rtl') parentList.setAttribute('dir', 'rtl');
          parentList.style.setProperty('direction', 'rtl', 'important');
          parentList.style.setProperty('text-align', 'right', 'important');
          parentList.style.setProperty('padding-left', '0', 'important');
          parentList.style.setProperty('margin-left', '0', 'important');
          if (parentList.tagName === 'UL') {
            parentList.style.setProperty('padding-right', '28px', 'important');
          } else if (parentList.tagName === 'OL') {
            parentList.style.setProperty('padding-right', '32px', 'important');
          }
        }
      } else if (/^H[1-6]$/.test(el.tagName)) {
        el.style.setProperty('padding-left', '0', 'important');
        el.style.setProperty('padding-right', '0', 'important');
        el.style.setProperty('margin-left', '0', 'important');
      } else if (el.tagName === 'BLOCKQUOTE') {
        el.style.setProperty('border-left', 'none', 'important');
        el.style.setProperty('border-right', '4px solid var(--border, #93e9be)', 'important');
      }
    }
  }

  function patchBiDi(root = document) {
    if (!root) return;
    // CRITICAL: NEVER call applyBiDiToElement(root) directly to prevent container scope inversion
    if (!root.querySelectorAll) return;

    const targets = root.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, [data-testid="user-message-bubble"], [data-testid="user-input-step"], [role="article"] > p, [role="article"] > li');
    for (let i = 0; i < targets.length; i++) {
      applyBiDiToElement(targets[i]);
    }

    const iframes = root.querySelectorAll('iframe, webview');
    for (let i = 0; i < iframes.length; i++) {
      try {
        const doc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
        if (doc) patchBiDi(doc);
      } catch(e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => patchBiDi());
  } else {
    patchBiDi();
  }

  const obs = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.type === 'childList') {
        for (let j = 0; j < m.addedNodes.length; j++) {
          const n = m.addedNodes[j];
          if (n.nodeType === 1) {
            if (n.matches && n.matches('p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, [data-testid="user-message-bubble"], [data-testid="user-input-step"]')) {
              applyBiDiToElement(n);
            }
            patchBiDi(n);
          }
        }
      } else if (m.type === 'characterData') {
        const p = m.target.parentElement;
        if (p) {
          const block = p.closest('p, li, h1, h2, h3, h4, h5, h6, blockquote, [data-testid="user-message-bubble"], [data-testid="user-input-step"]') || p;
          applyBiDiToElement(block);
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  let pollCount = 0;
  const poller = setInterval(() => {
    patchBiDi();
    pollCount++;
    if (pollCount > 30) {
      clearInterval(poller);
      setInterval(() => patchBiDi(), 1500);
    }
  }, 300);

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el) return;
    // Guard against editor, sidebar, or terminal input fields
    if (el.closest('.part.sidebar') || el.closest('.sidebar') || el.closest('.part.editor') || el.closest('.editor') || el.closest('.monaco-editor')) return;
    if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const val = el.value || el.textContent || '';
      if (isPersian(val)) {
        el.setAttribute('dir', 'rtl');
        el.style.setProperty('direction', 'rtl', 'important');
        el.style.setProperty('text-align', 'right', 'important');
        el.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif", 'important');
        el.style.setProperty('unicode-bidi', 'isolate', 'important');
      } else if (val.trim().length > 0) {
        el.setAttribute('dir', 'ltr');
        el.style.setProperty('direction', 'ltr');
        el.style.setProperty('text-align', 'left');
      }
    }
  }, true);
})();
"""

# 3. Patch workbench.desktop.main.js with Native Preact AST dir="auto" and Vazirmatn
wb_main_path = os.path.join(OUT_DIR, "vs", "workbench", "workbench.desktop.main.js")
wb_orig_path = wb_main_path + ".orig"

if not os.path.exists(wb_orig_path):
    shutil.copy2(wb_main_path, wb_orig_path)
    print(f"Created backup of pristine bundle: {wb_orig_path}")

# Always patch from pristine original for idempotency and rock-solid consistency
with open(wb_orig_path, 'r', encoding='utf-8') as f:
    wb_content = f.read()

wb_replacements = [
    # 1. oDd (paragraph renderer)
    ('oDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v("p",{...t,className:ht(t.className)',
     'oDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v("p",{dir:"auto",...t,className:ht(t.className)'),
    
    # 2. aDd (list item renderer)
    ('aDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v(KTd,{...t,animate:e,claimStaggerDelays:i})}',
     'aDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v(KTd,{dir:"auto",...t,animate:e,claimStaggerDelays:i})}'),

    # 3. _3e (heading renderer)
    ('_3e=t=>{let e=i=>{let{animate:n,claimStaggerDelays:r}=$ne();return v(t,{...i,className:ht(i.className)',
     '_3e=t=>{let e=i=>{let{animate:n,claimStaggerDelays:r}=$ne();return v(t,{dir:"auto",...i,className:ht(i.className)'),

    # 4. pDd (CustomMarkdown wrapper div)
    ('return v("div",{className:ht("leading-relaxed","select-text","text-sm","flex flex-col","[&_strong]:font-semibold","[&_b]:font-semibold",',
     'return v("div",{dir:"auto",className:ht("leading-relaxed","select-text","text-sm","flex flex-col","[&_strong]:font-semibold","[&_b]:font-semibold",'),

    # 5. wNd (CustomMarkdown internal style)
    ('wNd=`\ndiv:has(> table),\ntable th,\ntable td {\n  border-style: solid;\n  border-color: rgba(128, 128, 128, 0.2);\n}\n`',
     'wNd=`\ndiv:has(> table),\ntable th,\ntable td {\n  border-style: solid;\n  border-color: rgba(128, 128, 128, 0.2);\n}\np, li, dd, dt, h1, h2, h3, h4, h5, h6, blockquote, span, div {\n  font-family: \'Vazirmatn\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Tahoma, sans-serif !important;\n}\np[dir="auto"], div[dir="auto"], span[dir="auto"], li[dir="auto"] {\n  unicode-bidi: plaintext !important;\n}\np:dir(rtl), li:dir(rtl), h1:dir(rtl), h2:dir(rtl), h3:dir(rtl), h4:dir(rtl), h5:dir(rtl), h6:dir(rtl), blockquote:dir(rtl), [dir="rtl"], :dir(rtl) {\n  text-align: right !important;\n  direction: rtl !important;\n}\nul, ol {\n  padding-left: 0 !important;\n  margin-left: 0 !important;\n}\nul:dir(rtl), ol:dir(rtl), ul:has(> li:dir(rtl)), ol:has(> li:dir(rtl)) {\n  padding-right: 28px !important;\n  direction: rtl !important;\n  text-align: right !important;\n}\n`'),

    # 6. PHd (last text response wrapper)
    ('function PHd({step:t}){let{renderers:e}=Ur(),i=e.markdown,n=(t.step.case==="plannerResponse"?t.step.value:null)?.response;if(!n)return null;let r=t.status===Kr.RUNNING||t.status===Kr.GENERATING,s=Pm(t.metadata,null);return v("div",{className:"px-2 py-1"',
     'function PHd({step:t}){let{renderers:e}=Ur(),i=e.markdown,n=(t.step.case==="plannerResponse"?t.step.value:null)?.response;if(!n)return null;let r=t.status===Kr.RUNNING||t.status===Kr.GENERATING,s=Pm(t.metadata,null);return v("div",{dir:"auto",className:"px-2 py-1"'),

    # 7. zHd (Agent response)
    ('v("div",{role:"article","aria-label":"Agent response","data-quotable":"true",children:',
     'v("div",{dir:"auto",role:"article","aria-label":"Agent response","data-quotable":"true",children:'),

    # 8. LPd (User message bubble)
    ('LPd=({items:t})=>{let{chatParams:{artifactsDir:e},trajectorySummariesProvider:i,stepHandler:n,isBrowserPaneAvailable:r,openUrlInBrowserPane:s}=Ur(),o=Kt().get("browserAuxPane");return v("div",{"data-quotable":"true",className:"whitespace-pre-wrap text-sm"',
     'LPd=({items:t})=>{let{chatParams:{artifactsDir:e},trajectorySummariesProvider:i,stepHandler:n,isBrowserPaneAvailable:r,openUrlInBrowserPane:s}=Ur(),o=Kt().get("browserAuxPane");return v("div",{dir:"auto","data-quotable":"true",className:"whitespace-pre-wrap text-sm"'),

    # 9. ConversationView root container
    ('style:a?sWe.container:void 0,"data-testid":"conversation-view"',
     'dir:"auto",style:a?sWe.container:void 0,"data-testid":"conversation-view"'),

    # 10. User message bubble wrapper
    ('children:v("div",{ref:se,"data-testid":"user-message-bubble"',
     'children:v("div",{ref:se,dir:"auto","data-testid":"user-message-bubble"')
]

for idx, (target, replacement) in enumerate(wb_replacements, 1):
    if target in wb_content:
        wb_content = wb_content.replace(target, replacement, 1)
        print(f"Applied replacement {idx} to workbench.desktop.main.js")
    else:
        print(f"Warning: replacement {idx} target not found!")

with open(wb_main_path, 'w', encoding='utf-8') as f:
    f.write(wb_content)
    f.flush()
    os.fsync(f.fileno())
print(f"Saved patched workbench.desktop.main.js: {os.path.getsize(wb_main_path):,} bytes")

# 4. Patch CSS files idempotently
css_targets = [
    os.path.join(OUT_DIR, "vs", "workbench", "workbench.desktop.main.css"),
    os.path.join(OUT_DIR, "jetskiAgent", "main.css")
]

for cp in css_targets:
    if not os.path.exists(cp):
        print(f"Skipping missing CSS: {cp}")
        continue
    with open(cp, 'r', encoding='utf-8') as f:
        content = f.read()
    if "/* [Antigravity-Shield-RTL-Vazirmatn]" in content:
        pos = content.find("/* [Antigravity-Shield-RTL-Vazirmatn]")
        content = content[:pos].rstrip() + "\n\n"
    content = content + f"/* [Antigravity-Shield-RTL-Vazirmatn] */\n{VAZIRMATN_RTL_CSS}\n/* [/Antigravity-Shield-RTL-Vazirmatn] */\n"
    with open(cp, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched CSS: {cp}")

# 5. Patch JS Sentinel files
js_targets = [
    os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench.js"),
    os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "jetskiAgent.js")
]

for jp in js_targets:
    if not os.path.exists(jp):
        continue
    with open(jp, 'r', encoding='utf-8') as f:
        content = f.read()
    if "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in content:
        pos = content.find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
        content = content[:pos].rstrip() + "\n\n"
    content = content + f"{SENTINEL_CODE}\n"
    with open(jp, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched Sentinel in: {jp}")

# 6. Patch HTML Style Block
html_targets = [
    os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench.html"),
    os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench-jetski-agent.html"),
    os.path.join(OUT_DIR, "vs", "workbench", "contrib", "webview", "browser", "pre", "index.html")
]

STYLE_BLOCK = f'<style id="antigravity-shield-ide-bidi">\n{VAZIRMATN_RTL_CSS}\n</style>'

for hp in html_targets:
    if not os.path.exists(hp):
        continue
    with open(hp, 'r', encoding='utf-8') as f:
        content = f.read()
    old_fsrc = "\t\t\t\tfont-src\n\t\t\t\t\t'self'\n\t\t\t\t\tvscode-remote-resource:"
    new_fsrc = "\t\t\t\tfont-src\n\t\t\t\t\t'self'\n\t\t\t\t\tdata:\n\t\t\t\t\tvscode-remote-resource:"
    if old_fsrc in content:
        content = content.replace(old_fsrc, new_fsrc)
    if "style-src 'unsafe-inline';" in content and "font-src" not in content:
        content = content.replace("style-src 'unsafe-inline';", "style-src 'unsafe-inline'; font-src 'self' data:;")

    if '<style id="antigravity-shield-ide-bidi">' in content:
        content = re.sub(r'\s*<style id="antigravity-shield-ide-bidi">.*?</style>\s*', '\n', content, flags=re.DOTALL)
    content = content.replace('</head>', f'{STYLE_BLOCK}\n</head>')
    with open(hp, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched HTML: {hp}")

# 7. Update product.json checksums
product_json_path = os.path.join(APP_DIR, "product.json")
with open(product_json_path, 'r', encoding='utf-8') as f:
    pj = json.load(f)

checksums = pj.get("checksums", {})

all_patched = [
    ("vs/workbench/workbench.desktop.main.js", wb_main_path),
    ("vs/workbench/workbench.desktop.main.css", os.path.join(OUT_DIR, "vs", "workbench", "workbench.desktop.main.css")),
    ("jetskiAgent/main.css", os.path.join(OUT_DIR, "jetskiAgent", "main.css")),
    ("jetskiMain.tailwind.css", os.path.join(OUT_DIR, "jetskiMain.tailwind.css")),
    ("tw-base.tailwind.css", os.path.join(OUT_DIR, "tw-base.tailwind.css")),
    ("vs/code/electron-browser/workbench/workbench.js", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench.js")),
    ("vs/code/electron-browser/workbench/jetskiAgent.js", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "jetskiAgent.js")),
    ("vs/code/electron-browser/workbench/workbench.html", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench.html")),
    ("vs/code/electron-browser/workbench/workbench-jetski-agent.html", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench-jetski-agent.html")),
    ("vs/workbench/contrib/webview/browser/pre/index.html", os.path.join(OUT_DIR, "vs", "workbench", "contrib", "webview", "browser", "pre", "index.html")),
]

for rel, path in all_patched:
    if os.path.exists(path):
        h = compute_b64_hash(path)
        checksums[rel] = h
        checksums[f"out/{rel}"] = h
        print(f"Updated checksum: {rel} -> {h}")

pj["checksums"] = checksums
with open(product_json_path, 'w', encoding='utf-8') as f:
    json.dump(pj, f, indent=2)

# 8. Clear Electron V8 code cache so changes take effect immediately
roaming_ide = os.path.expandvars(r"%APPDATA%\Antigravity IDE")
for sub in ["Cache", os.path.join("Code Cache", "js"), "CachedData"]:
    cdir = os.path.join(roaming_ide, sub)
    if os.path.exists(cdir):
        try:
            shutil.rmtree(cdir)
            print(f"Cleared V8 cache dir: {cdir}")
        except Exception as e:
            print(f"Note: Could not clear {cdir}: {e}")

print("\n=== IDE PATCH APPLICATION COMPLETE ===")
