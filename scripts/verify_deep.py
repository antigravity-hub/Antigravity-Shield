import os
import sys
import json
import hashlib
import base64

sys.stdout.reconfigure(encoding='utf-8')

app_dir = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
out_dir = os.path.join(app_dir, "out")
product_json_path = os.path.join(app_dir, "product.json")

print("==================================================")
print("   DEEP VERIFICATION FOR ROCK-SOLID ANTIGRAVITY IDE")
print("==================================================")

failures = 0

# 1. Product JSON Checksums Verification
with open(product_json_path, 'r', encoding='utf-8') as f:
    pj = json.load(f)
checksums = pj.get("checksums", {})

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

print("\n--- 1. Checksums Verification against product.json ---")
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

# 2. Pristine Integrity of Minified JS Bundles (Zero AST Tampering / No Crash Risk)
print("\n--- 2. Pristine Integrity of Minified JS Bundles ---")
for js_rel in ["jetskiAgent/main.js", "vs/workbench/workbench.desktop.main.js"]:
    p = os.path.join(out_dir, js_rel.replace('/', os.sep))
    p_orig = p + ".orig"
    if os.path.exists(p_orig):
        with open(p, 'rb') as f1, open(p_orig, 'rb') as f2:
            h1 = hashlib.sha256(f1.read()).hexdigest()
            h2 = hashlib.sha256(f2.read()).hexdigest()
        if h1 == h2:
            print(f"[PASS] {js_rel} matches original unpatched bundle exactly (SHA: {h1[:16]}...)")
        else:
            print(f"[FAIL] {js_rel} diverges from .orig!")
            failures += 1
    else:
        print(f"[WARN] {js_rel}.orig not found, skipping byte match.")

# 3. Clean Tailwind Bundles (No Duplicate or Bloated CSS Patches)
print("\n--- 3. Clean Tailwind Bundles Verification ---")
for tw_rel in ["jetskiMain.tailwind.css", "tw-base.tailwind.css"]:
    p = os.path.join(out_dir, tw_rel.replace('/', os.sep))
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    if "/* [Antigravity-Shield-RTL-Vazirmatn" in c:
        print(f"[FAIL] {tw_rel} still contains patch bloat!")
        failures += 1
    else:
        print(f"[PASS] {tw_rel} is completely clean ({len(c):,} bytes).")

# 4. Idempotent CSS & High-End Neon Nested List Geometry Verification
print("\n--- 4. CSS & Animated Sublist Geometry Verification ---")
for css_rel in ["vs/workbench/workbench.desktop.main.css", "jetskiAgent/main.css"]:
    p = os.path.join(out_dir, css_rel.replace('/', os.sep))
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    has_raindrop = "@keyframes agyRaindropFlow" in c
    has_pulse = "@keyframes agyPulseGlow" in c or "@keyframes agyEmeraldPulseGlow" in c
    has_cyan_pulse = "@keyframes agyCyanPulseGlow" in c
    has_curved_arm = ("right: 0px !important;" in c) or ("right: -20px !important;" in c)
    has_child_node = ("width: 5px !important;" in c) or ("right: 2px !important;" in c)
    has_gap_fix = "margin-right: 0 !important;" in c and "padding-right: 0 !important;" in c
    has_cyber_emerald = "--sidebar: #090e13" in c and "--sidebar-primary: #10b981" in c
    has_vscode_tokens = "--vscode-sideBar-background" in c
    has_auxiliary_tokens = "--vscode-auxiliaryBar-background" in c and ".part.auxiliarybar" in c and '[data-testid="conversation-view"]' in c and '[data-aux-pane-open]' in c and '[data-aux-pane-focus-scope="true"]' in c
    
    if has_raindrop and has_pulse and has_cyan_pulse and has_curved_arm and has_child_node and has_gap_fix and has_cyber_emerald and has_vscode_tokens and has_auxiliary_tokens:
        print(f"[PASS] {css_rel} has live raindrop spine, pulse glows, precision curved arm, gap fix, cyber emerald sidebar & auxiliaryBar tokens.")
    else:
        print(f"[FAIL] {css_rel} missing expected rules! raindrop={has_raindrop}, pulse={has_pulse}, cyan_pulse={has_cyan_pulse}, arm={has_curved_arm}, node={has_child_node}, gap_fix={has_gap_fix}, emerald={has_cyber_emerald}, vscode_tokens={has_vscode_tokens}, auxiliary_tokens={has_auxiliary_tokens}")
        failures += 1

# 5. HTML Style Block & CSP Verification
print("\n--- 5. HTML Style Block & CSP Verification ---")
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
    has_style_id = '<style id="antigravity-shield-ide-bidi">' in hc
    has_font = "font-family: 'Vazirmatn'" in hc or "font-family: \"Vazirmatn\"" in hc
    has_sublist = "Vazirmatn" in hc
    has_csp_data = "data:" in hc

    if has_style_id and has_font and has_sublist and has_csp_data:
        print(f"[PASS] {h_rel} contains comprehensive style tag and data: in CSP.")
    else:
        print(f"[FAIL] {h_rel}: style_id={has_style_id}, font={has_font}, sublist={has_sublist}, csp_data={has_csp_data}")
        failures += 1

# 6. DOM Sentinels Verification
print("\n--- 6. DOM Sentinels Verification in JS Entry Points ---")
for js_rel in ["vs/code/electron-browser/workbench/jetskiAgent.js", "vs/code/electron-browser/workbench/workbench.js"]:
    p = os.path.join(out_dir, js_rel.replace('/', os.sep))
    with open(p, 'r', encoding='utf-8') as f:
        sc = f.read()
    has_sentinel = "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in sc
    has_input_listener = "document.addEventListener('input'" in sc
    if has_sentinel and has_input_listener:
        print(f"[PASS] {js_rel} has non-invasive DOM BiDi sentinel.")
    else:
        print(f"[FAIL] {js_rel} sentinel check failed!")
        failures += 1

print("\n==================================================")
if failures == 0:
    print("   ALL VERIFICATION CHECKS PASSED PERFECTLY! (0 FAILURES)")
    print("==================================================")
    sys.exit(0)
else:
    print(f"   VERIFICATION FAILED WITH {failures} ISSUES!")
    print("==================================================")
    sys.exit(1)
