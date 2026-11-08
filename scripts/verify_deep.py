import os
import sys
import json
import hashlib
import base64
import subprocess
import re

sys.stdout.reconfigure(encoding='utf-8')

app_dir = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
out_dir = os.path.join(app_dir, "out")
product_json_path = os.path.join(app_dir, "product.json")
wb_orig_path = os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.js.orig")
wb_main_path = os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.js")
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
apply_patch_script = os.path.join(repo_root, "scripts", "apply_ide_patch.py")

print("=================================================================")
print("   HARDENED DEEP VERIFIER (ROCK-SOLID ANTIGRAVITY IDE ENGINE)   ")
print("=================================================================")

failures = 0

# Target files list
files_to_verify = [
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

# --- PHASE 1: Direct Disk vs product.json Checksums Verification ---
print("\n--- PHASE 1: Checksums Verification against product.json ---")
with open(product_json_path, 'r', encoding='utf-8') as f:
    pj = json.load(f)
checksums = pj.get("checksums", {})

for key, rel in files_to_verify:
    full_path = os.path.join(app_dir, rel.replace('/', os.sep))
    if not os.path.exists(full_path):
        print(f"[FAIL] Missing file: {rel}")
        failures += 1
        continue
    with open(full_path, 'rb') as f:
        h = hashlib.sha256(f.read()).digest()
        calc_b64 = base64.b64encode(h).decode('ascii').rstrip('=')
    expected = checksums.get(key)
    if calc_b64 == expected:
        print(f"[PASS] {key} -> {calc_b64}")
    else:
        print(f"[FAIL] {key}: expected {expected}, got {calc_b64}")
        failures += 1

# --- PHASE 2: Pristine Backup (.orig) Invariant ---
print("\n--- PHASE 2: Pristine Backup (.orig) Integrity Invariant ---")
if not os.path.exists(wb_orig_path):
    print(f"[FAIL] Missing pristine backup: {wb_orig_path}")
    failures += 1
else:
    with open(wb_orig_path, 'r', encoding='utf-8') as f:
        orig_c = f.read()
    orig_clean = ('dir:"auto",...t,className:ht(t.className)' not in orig_c and
                  'dir:"auto","data-testid":"conversation-view"' not in orig_c)
    if orig_clean:
        print(f"[PASS] workbench.desktop.main.js.orig is 100% clean and unpatched ({len(orig_c):,} bytes).")
    else:
        print(f"[FAIL] workbench.desktop.main.js.orig contains patched markers!")
        failures += 1

# --- PHASE 3: JS Bundles & Native Preact BiDi Invariant ---
print("\n--- PHASE 3: JS Bundles & Native Preact BiDi Invariant ---")
with open(wb_main_path, 'r', encoding='utf-8') as f:
    wbc = f.read()

wb_checks = [
    ('oDd paragraph dir="auto"', 'v("p",{dir:"auto",...t,className:ht(t.className)'),
    ('aDd list item dir="auto"', 'v(KTd,{dir:"auto",...t,animate:e,claimStaggerDelays:i})'),
    ('_3e heading dir="auto"', 'v(t,{dir:"auto",...i,className:ht(i.className)'),
    ('pDd markdown wrapper dir="auto"', 'v("div",{dir:"auto",className:ht("leading-relaxed"'),
    ('wNd internal style Vazirmatn rule', "font-family: 'Vazirmatn'"),
    ('PHd last text response dir="auto"', 'v("div",{dir:"auto",className:"px-2 py-1"'),
    ('zHd Agent response article dir="auto"', 'v("div",{dir:"auto",role:"article","aria-label":"Agent response"'),
    ('LPd user message bubble dir="auto"', 'v("div",{dir:"auto","data-quotable":"true",className:"whitespace-pre-wrap text-sm"'),
    ('ConversationView container dir="auto"', 'dir:"auto",style:a?sWe.container:void 0,"data-testid":"conversation-view"'),
    ('user-message-bubble wrapper dir="auto"', 'dir:"auto","data-testid":"user-message-bubble"'),
]

for label, needle in wb_checks:
    if needle in wbc:
        print(f"[PASS] workbench.desktop.main.js has {label}")
    else:
        print(f"[FAIL] workbench.desktop.main.js missing {label}!")
        failures += 1

# --- PHASE 4: Clean Tailwind Bundles Verification ---
print("\n--- PHASE 4: Clean Tailwind Bundles Verification ---")
for tw_rel in ["jetskiMain.tailwind.css", "tw-base.tailwind.css"]:
    p = os.path.join(out_dir, tw_rel.replace('/', os.sep))
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    if "/* [Antigravity-Shield-RTL-Vazirmatn" in c:
        print(f"[FAIL] {tw_rel} still contains patch bloat!")
        failures += 1
    else:
        print(f"[PASS] {tw_rel} is completely clean ({len(c):,} bytes).")

# --- PHASE 5: CSS & Animated Sublist Geometry Verification ---
print("\n--- PHASE 5: CSS & Animated Sublist Geometry Verification ---")
for css_rel in ["vs/workbench/workbench.desktop.main.css", "jetskiAgent/main.css"]:
    p = os.path.join(out_dir, css_rel.replace('/', os.sep))
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    has_raindrop = "@keyframes agyRaindropFlow" in c
    has_pulse = "@keyframes agyPulseGlow" in c or "@keyframes agyEmeraldPulseGlow" in c
    has_cyber_emerald = "--sidebar: #090e13" in c and "--sidebar-primary: #10b981" in c
    has_chat_selectors = '[data-testid="chat-message"]' in c and '[data-testid="user-message-content"]' in c and '.rendered-markdown' in c
    has_ltr_isolation = '.cursor-edit.text-secondary-foreground' in c and 'unicode-bidi: isolate !important;' in c
    has_icon_protection = '.codicon' in c and '.google-symbols' in c
    
    # Check duplicate closing tags
    close_tags = c.count("/* [/Antigravity-Shield-RTL-Vazirmatn] */")
    has_duplicate_close = (close_tags > 1)

    if has_duplicate_close:
        print(f"[FAIL] {css_rel} has duplicate closing comments: count={close_tags}")
        failures += 1
    else:
        print(f"[PASS] {css_rel} closing comment count={close_tags} (no duplicate tags).")

    if has_raindrop and has_pulse and has_cyber_emerald and has_chat_selectors and has_ltr_isolation and has_icon_protection:
        print(f"[PASS] {css_rel} has valid geometry and visual shield rules.")
    else:
        print(f"[FAIL] {css_rel} missing core styling rules!")
        failures += 1

# --- PHASE 6: HTML Style Block, CSP & Clean Idempotency Formatting ---
print("\n--- PHASE 6: HTML Style Block & Clean Idempotency Formatting ---")
html_files = [
    "vs/code/electron-browser/workbench/workbench.html",
    "vs/code/electron-browser/workbench/workbench-jetski-agent.html",
    "vs/workbench/contrib/webview/browser/pre/index.html",
]
for h_rel in html_files:
    p = os.path.join(out_dir, h_rel.replace('/', os.sep))
    if not os.path.exists(p):
        print(f"[WARN] {h_rel} not found on disk.")
        continue
    with open(p, 'r', encoding='utf-8') as f:
        hc = f.read()
    style_count = hc.count('<style id="antigravity-shield-ide-bidi">')
    has_csp_data = "data:" in hc

    # Check for newline accumulation before <style>
    idx = hc.find('<style id="antigravity-shield-ide-bidi">')
    if idx != -1:
        prefix = hc[max(0, idx-60):idx]
        nl_count = prefix.count('\n')
        has_clean_newlines = (nl_count <= 2)
    else:
        nl_count = -1
        has_clean_newlines = False

    if style_count == 1 and has_csp_data and has_clean_newlines:
        print(f"[PASS] {h_rel} exactly 1 style tag, CSP data: present, and clean newlines (count={nl_count}).")
    else:
        print(f"[FAIL] {h_rel}: style_count={style_count}, csp_data={has_csp_data}, clean_newlines={has_clean_newlines} (nl_count={nl_count})")
        failures += 1

# --- PHASE 7: DOM Sentinels Shell-Isolation & Container Immunity ---
print("\n--- PHASE 7: DOM Sentinels Shell-Isolation & Container Immunity ---")
for js_rel in ["vs/code/electron-browser/workbench/jetskiAgent.js", "vs/code/electron-browser/workbench/workbench.js"]:
    p = os.path.join(out_dir, js_rel.replace('/', os.sep))
    with open(p, 'r', encoding='utf-8') as f:
        sc = f.read()
    has_sentinel = "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in sc
    has_body_guard = ("el === document.body" in sc) or ("el.tagName === 'BODY'" in sc)
    has_sidebar_guard = (".part.sidebar" in sc) or ("el.closest('.sidebar')" in sc) or ("el.classList.contains('sidebar')" in sc)
    has_editor_guard = (".part.editor" in sc) or ("el.closest('.editor')" in sc) or ("el.classList.contains('editor')" in sc)
    has_no_container_target = ('[data-testid="conversation-view"],' not in sc) and ('.part.auxiliarybar,' not in sc)

    if has_sentinel and has_body_guard and has_sidebar_guard and has_editor_guard and has_no_container_target:
        print(f"[PASS] {js_rel} sentinel is shell-isolated (body, sidebar, editor protected; containers excluded).")
    else:
        print(f"[FAIL] {js_rel} sentinel lacks shell isolation! body_guard={has_body_guard}, sidebar_guard={has_sidebar_guard}, editor_guard={has_editor_guard}, no_container_target={has_no_container_target}")
        failures += 1

# --- PHASE 8: Empirical Blink Engine Behavioral Boundary Invariants ---
print("\n--- PHASE 8: Empirical Blink Engine Behavioral Boundary Invariants ---")
try:
    from playwright.sync_api import sync_playwright

    wb_css_path = os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.css")
    wb_js_path = os.path.join(out_dir, "vs", "code", "electron-browser", "workbench", "workbench.js")
    
    with open(wb_css_path, 'r', encoding='utf-8') as f:
        css_data = f.read()
    sentinel_js = ""
    if os.path.exists(wb_js_path):
        with open(wb_js_path, 'r', encoding='utf-8') as f:
            js_data = f.read()
        if "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in js_data:
            s_idx = js_data.find("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
            sentinel_js = js_data[s_idx:]

    test_html = f"""<!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <style id="patched-css">{css_data}</style>
    </head><body>
      <div class="monaco-workbench">
        <div class="part sidebar" id="explorer-sidebar"><div class="row">src/main.rs</div></div>
        <div class="part editor" id="editor-part"><div class="tab">editor.rs</div></div>
        <div class="part auxiliarybar">
          <div data-testid="conversation-view" id="conversation-view">
            <p id="pure-en">Pure English text here.</p>
            <p id="pure-fa">متن کاملا فارسی در این قسمت قرار دارد.</p>
            <div data-testid="user-message-bubble" id="user-bubble-en">English user prompt</div>
          </div>
        </div>
      </div>
      <script>{sentinel_js}</script>
    </body></html>"""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(test_html, wait_until="networkidle")
        page.wait_for_timeout(500)

        body_dir = page.evaluate("() => document.body.getAttribute('dir') || window.getComputedStyle(document.body).direction")
        sidebar_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('explorer-sidebar')).direction")
        editor_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('editor-part')).direction")
        en_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('pure-en')).direction")
        fa_dir = page.evaluate("() => window.getComputedStyle(document.getElementById('pure-fa')).direction")

        browser.close()

    if body_dir != 'rtl' and sidebar_dir == 'ltr' and editor_dir == 'ltr':
        print(f"[PASS] Shell isolation confirmed (body={body_dir}, sidebar={sidebar_dir}, editor={editor_dir}).")
    else:
        print(f"[FAIL] Shell isolation breached! body={body_dir}, sidebar={sidebar_dir}, editor={editor_dir}")
        failures += 1

    if en_dir == 'ltr' and fa_dir == 'rtl':
        print(f"[PASS] Chat bidi direction confirmed (English={en_dir}, Persian={fa_dir}).")
    else:
        print(f"[FAIL] Chat bidi direction invalid! English={en_dir}, Persian={fa_dir}")
        failures += 1

except Exception as e:
    print(f"[WARN] Playwright behavioral phase encountered error: {e}")
    failures += 1

# --- PHASE 9: Strict Patch Idempotency Invariance Gate (f(f(x)) == f(x)) ---
print("\n--- PHASE 9: Strict Patch Idempotency Invariance Gate ---")
if not os.environ.get("ANTIGRAVITY_IDEMPOTENCY_CHECK_ACTIVE"):
    os.environ["ANTIGRAVITY_IDEMPOTENCY_CHECK_ACTIVE"] = "1"
    
    # Snapshot target hashes before run
    snap_before = {}
    for key, rel in files_to_verify:
        full_path = os.path.join(app_dir, rel.replace('/', os.sep))
        if os.path.exists(full_path):
            with open(full_path, 'rb') as f:
                raw_bytes = f.read()
                snap_before[key] = (len(raw_bytes), hashlib.sha256(raw_bytes).hexdigest())

    # Execute apply_ide_patch.py
    idemp_proc = subprocess.run([sys.executable, apply_patch_script], capture_output=True, text=True)
    if idemp_proc.returncode != 0:
        print(f"[FAIL] apply_ide_patch.py execution failed during idempotency verification!")
        failures += 1
    else:
        idemp_fails = 0
        for key, rel in files_to_verify:
            full_path = os.path.join(app_dir, rel.replace('/', os.sep))
            if os.path.exists(full_path):
                with open(full_path, 'rb') as f:
                    raw_bytes = f.read()
                    cur_size = len(raw_bytes)
                    cur_hash = hashlib.sha256(raw_bytes).hexdigest()
                prev_size, prev_hash = snap_before[key]
                if cur_size != prev_size or cur_hash != prev_hash:
                    print(f"[FAIL] Idempotency drift on {key}! Size: {prev_size} -> {cur_size}, Hash: {prev_hash[:12]}... -> {cur_hash[:12]}...")
                    idemp_fails += 1
                else:
                    print(f"[PASS] {key} perfectly idempotent (0 byte drift, 0 hash mutation).")
        if idemp_fails > 0:
            failures += idemp_fails
else:
    print("[INFO] Sub-invocation detected; skipping nested idempotency check.")

# --- PHASE 10: Chat Webview Iframe Proxy & Typography Invariant ---
print("\n--- PHASE 10: Chat Webview Iframe Proxy & Typography Invariant ---")
agy_vscode_dir = os.path.join(app_dir, "extensions", "agy", "vscode")
agy_ext_js = os.path.join(agy_vscode_dir, "extension.js")
agy_proxy_js = os.path.join(agy_vscode_dir, "rtl-proxy.js")
agy_font_file = os.path.join(agy_vscode_dir, "Vazirmatn-Variable.woff2")

if not os.path.exists(agy_ext_js):
    print(f"[FAIL] Missing agy extension.js: {agy_ext_js}")
    failures += 1
else:
    with open(agy_ext_js, 'r', encoding='utf-8') as f:
        ext_c = f.read()
    if 'require("./rtl-proxy.js").wrap(a.toString())' in ext_c:
        print("[PASS] agy extension.js has active rtl-proxy hook.")
    else:
        print("[FAIL] agy extension.js missing rtl-proxy hook!")
        failures += 1

if not os.path.exists(agy_proxy_js):
    print(f"[FAIL] Missing rtl-proxy.js: {agy_proxy_js}")
    failures += 1
else:
    with open(agy_proxy_js, 'r', encoding='utf-8') as f:
        proxy_c = f.read()
    has_inject = 'id="antigravity-shield-chat-rtl"' in proxy_c
    has_font_route = '/__agy_rtl/vazirmatn.woff2' in proxy_c
    has_bidi = "root.setAttribute('dir', 'auto')" in proxy_c
    if has_inject and has_font_route and has_bidi:
        print(f"[PASS] rtl-proxy.js contains full injection engine ({len(proxy_c):,} bytes).")
    else:
        print("[FAIL] rtl-proxy.js missing required injection rules!")
        failures += 1

if not os.path.exists(agy_font_file) or os.path.getsize(agy_font_file) < 100000:
    print(f"[FAIL] Missing or invalid Vazirmatn font: {agy_font_file}")
    failures += 1
else:
    print(f"[PASS] Vazirmatn-Variable.woff2 present ({os.path.getsize(agy_font_file):,} bytes).")

print("\n=================================================================")
if failures == 0:
    print("   ALL VERIFICATION PHASES PASSED! (0 FAILURES)")
    print("=================================================================")
    sys.exit(0)
else:
    print(f"   VERIFICATION FAILED WITH {failures} ISSUES!")
    print("=================================================================")
    sys.exit(1)
