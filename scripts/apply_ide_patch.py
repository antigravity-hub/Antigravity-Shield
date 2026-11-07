import os
import sys
import json
import hashlib
import base64
import shutil
import re

sys.stdout.reconfigure(encoding='utf-8')

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATCH_RS = os.path.join(REPO_ROOT, "src-tauri", "src", "commands", "patch.rs")

APP_DIR = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
OUT_DIR = os.path.join(APP_DIR, "out")
PRODUCT_JSON = os.path.join(APP_DIR, "product.json")

print("=== STARTING ROCK-SOLID ANTIGRAVITY IDE PATCH DEPLOYMENT ===")

# 1. Extract VAZIRMATN_RTL_CSS from patch.rs (Single Source of Truth)
if not os.path.exists(PATCH_RS):
    print(f"Error: {PATCH_RS} not found!")
    sys.exit(1)

with open(PATCH_RS, 'r', encoding='utf-8') as f:
    patch_rs_content = f.read()

m = re.search(r'pub const VAZIRMATN_RTL_CSS: &str = r#"(.*?)"#;', patch_rs_content, re.DOTALL)
if not m:
    print("Error: Could not extract VAZIRMATN_RTL_CSS from patch.rs!")
    sys.exit(1)

VAZIRMATN_RTL_CSS = m.group(1).strip()
print(f"Extracted VAZIRMATN_RTL_CSS ({len(VAZIRMATN_RTL_CSS)} bytes) from patch.rs")

# 2. Restore minified JS bundles from .orig (Zero AST Tampering / Rock-Solid Stability)
for js_rel in ["jetskiAgent/main.js", "vs/workbench/workbench.desktop.main.js"]:
    p = os.path.join(OUT_DIR, js_rel.replace('/', os.sep))
    p_orig = p + ".orig"
    if os.path.exists(p_orig):
        shutil.copy2(p_orig, p)
        print(f"Restored from pristine original: {js_rel} (size: {os.path.getsize(p):,} bytes)")
    elif os.path.exists(p):
        print(f"Found existing JS file without .orig: {js_rel}")

# 3. Clean bloated tailwind patches from jetskiMain.tailwind.css and tw-base.tailwind.css
for tw_rel in ["jetskiMain.tailwind.css", "tw-base.tailwind.css"]:
    p = os.path.join(OUT_DIR, tw_rel.replace('/', os.sep))
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            content = f.read()
        if "/* [Antigravity-Shield-RTL-Vazirmatn" in content:
            pos = content.find("/* [Antigravity-Shield-RTL-Vazirmatn")
            cleaned = content[:pos].rstrip()
            with open(p, 'w', encoding='utf-8') as f:
                f.write(cleaned)
            print(f"Cleaned bloated patch from {tw_rel} (new size: {len(cleaned):,} bytes)")
        else:
            print(f"{tw_rel} is already clean (size: {len(content):,} bytes)")

# 4. Idempotently patch CSS targets (workbench.desktop.main.css and jetskiAgent/main.css)
p_start = "/* [Antigravity-Shield-RTL-Vazirmatn] */"
p_end = "/* [/Antigravity-Shield-RTL-Vazirmatn] */"
css_patch_block = f"\n\n{p_start}\n{VAZIRMATN_RTL_CSS}\n{p_end}\n"

for css_rel in ["vs/workbench/workbench.desktop.main.css", "jetskiAgent/main.css"]:
    p = os.path.join(OUT_DIR, css_rel.replace('/', os.sep))
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        if p_start in c:
            s = c.find(p_start)
            c = c[:s].rstrip() + "\n\n" + p_start + "\n" + VAZIRMATN_RTL_CSS + "\n" + p_end + "\n"
        else:
            c = c.rstrip() + css_patch_block
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f"Idempotently updated CSS patch in: {css_rel} (size: {len(c):,} bytes)")

# 5. Sentinel in JS entry points (Isolated MutationObserver without AST tampering)
sentinel_code = r'''
// [Antigravity-Shield-IDE-BiDi-Sentinel]
(()=>{
  const isPersian = (s) => /[\u0600-\u06FF]/.test(s);
  function patchBiDi(root = document) {
    if (!root || !root.querySelectorAll) return;
    const targets = root.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, [data-testid="user-message-bubble"], [data-testid="user-message-bubble"] div, [data-testid="user-message-bubble"] span, [data-testid="user-input-step"], [role="article"], .leading-relaxed, .whitespace-pre-wrap, [data-testid="conversation-view"] span, [data-testid="conversation-view"] div, [data-testid="conversation-view"] p, [data-testid="conversation-view"] li, div.break-words p, div.break-words li, div.break-words h1, div.break-words h2, div.break-words h3, div.break-words h4, div.break-words h5, div.break-words h6, .part.auxiliarybar p, .part.auxiliarybar span, .part.auxiliarybar li, [data-aux-pane-open] p, [data-aux-pane-open] span, [data-aux-pane-open] div, [data-aux-pane-open] li, [data-aux-pane-focus-scope="true"] p, [data-aux-pane-focus-scope="true"] span, [data-aux-pane-focus-scope="true"] div, button[data-tab-id] span');
    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.closest('pre') || el.closest('.monaco-editor')) continue;
      const txt = el.textContent || '';
      if (isPersian(txt)) {
        if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
        if (el.style.direction !== 'rtl') el.style.setProperty('direction', 'rtl', 'important');
        if (el.style.fontFamily !== "'Vazirmatn'") el.style.setProperty('font-family', "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif", 'important');
        if (el.style.unicodeBidi !== 'isolate') el.style.setProperty('unicode-bidi', 'isolate', 'important');
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
          if (n.nodeType === 1) patchBiDi(n);
        }
      } else if (m.type === 'characterData') {
        const p = m.target.parentElement;
        if (p) patchBiDi(p);
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el) return;
    if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const val = el.value || el.textContent || '';
      if (isPersian(val)) {
        el.setAttribute('dir', 'rtl');
        el.style.setProperty('direction', 'rtl', 'important');
        el.style.setProperty('text-align', 'right', 'important');
        el.style.setProperty('unicode-bidi', 'isolate', 'important');
      } else if (val.trim().length > 0) {
        el.setAttribute('dir', 'ltr');
        el.style.setProperty('direction', 'ltr');
        el.style.setProperty('text-align', 'left');
      }
    }
  }, true);
})();
'''

for js_rel in ["vs/code/electron-browser/workbench/jetskiAgent.js", "vs/code/electron-browser/workbench/workbench.js"]:
    p = os.path.join(OUT_DIR, js_rel.replace('/', os.sep))
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        if "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in c:
            idx = c.find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
            c = c[:idx].rstrip() + "\n" + sentinel_code
        else:
            c = c.rstrip() + "\n" + sentinel_code
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f"Updated Sentinel in: {js_rel}")

# 6. Deploy comprehensive style block in HTML targets
html_targets = [
    "vs/code/electron-browser/workbench/workbench.html",
    "vs/code/electron-browser/workbench/workbench-jetski-agent.html",
    "vs/workbench/contrib/webview/browser/pre/index.html",
]

style_tag = f'''	<style id="antigravity-shield-ide-bidi">
{VAZIRMATN_RTL_CSS}
	</style>'''

for html_rel in html_targets:
    p = os.path.join(OUT_DIR, html_rel.replace('/', os.sep))
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()

        # Update CSP to allow font-src data:
        old_fsrc = "\t\t\t\tfont-src\n\t\t\t\t\t'self'\n\t\t\t\t\tvscode-remote-resource:"
        new_fsrc = "\t\t\t\tfont-src\n\t\t\t\t\t'self'\n\t\t\t\t\tdata:\n\t\t\t\t\tvscode-remote-resource:"
        if old_fsrc in c:
            c = c.replace(old_fsrc, new_fsrc)
        if "style-src 'unsafe-inline';" in c and "font-src" not in c:
            c = c.replace("style-src 'unsafe-inline';", "style-src 'unsafe-inline'; font-src 'self' data:;")

        # Inject or replace style tag
        s_pos = c.find('<style id="antigravity-shield-ide-bidi">')
        if s_pos != -1:
            e_pos = c.find('</style>', s_pos)
            c = c[:s_pos] + style_tag.strip() + c[e_pos + 8:]
        else:
            c = c.replace("</head>", style_tag + "\n</head>")

        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f"Deployed comprehensive Vazirmatn style block in: {html_rel} (size: {len(c):,} bytes)")

# 7. Update product.json checksums for all modified files
with open(PRODUCT_JSON, 'r', encoding='utf-8') as f:
    pj = json.load(f)

tracked_files = [
    ("vs/workbench/workbench.desktop.main.css", "out/vs/workbench/workbench.desktop.main.css"),
    ("jetskiMain.tailwind.css", "out/jetskiMain.tailwind.css"),
    ("tw-base.tailwind.css", "out/tw-base.tailwind.css"),
    ("jetskiAgent/main.css", "out/jetskiAgent/main.css"),
    ("jetskiAgent/main.js", "out/jetskiAgent/main.js"),
    ("vs/code/electron-browser/workbench/jetskiAgent.js", "out/vs/code/electron-browser/workbench/jetskiAgent.js"),
    ("vs/workbench/workbench.desktop.main.js", "out/vs/workbench/workbench.desktop.main.js"),
    ("vs/code/electron-browser/workbench/workbench.js", "out/vs/code/electron-browser/workbench/workbench.js"),
    ("vs/code/electron-browser/workbench/workbench.html", "out/vs/code/electron-browser/workbench/workbench.html"),
    ("vs/code/electron-browser/workbench/workbench-jetski-agent.html", "out/vs/code/electron-browser/workbench/workbench-jetski-agent.html"),
    ("vs/workbench/contrib/webview/browser/pre/index.html", "out/vs/workbench/contrib/webview/browser/pre/index.html"),
]

for key, rel_path in tracked_files:
    fp = os.path.join(APP_DIR, rel_path.replace('/', os.sep))
    if os.path.exists(fp):
        with open(fp, 'rb') as f:
            h = hashlib.sha256(f.read()).digest()
            b64_hash = base64.b64encode(h).decode('ascii').rstrip('=')
            pj["checksums"][key] = b64_hash
            pj["checksums"][f"out/{key}"] = b64_hash
            print(f"Updated product.json: {key} -> {b64_hash}")

with open(PRODUCT_JSON, 'w', encoding='utf-8') as f:
    json.dump(pj, f, indent=4)
print("Saved updated product.json checksums.")

# 8. Clear Electron V8 code cache
roaming_ide = os.path.expandvars(r"%APPDATA%\Antigravity IDE")
for sub in ["Cache", os.path.join("Code Cache", "js"), "CachedData"]:
    cdir = os.path.join(roaming_ide, sub)
    if os.path.exists(cdir):
        try:
            shutil.rmtree(cdir)
            print(f"Cleared cache: {cdir}")
        except Exception as e:
            print(f"Cache clear skipped for {cdir}: {e}")

print("=== DEPLOYMENT COMPLETED SUCCESSFULLY ===")
