import os, sys, json, hashlib, base64, re
sys.stdout.reconfigure(encoding='utf-8')

app_dir = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
out_dir = os.path.join(app_dir, "out")
product_json_path = os.path.join(app_dir, "product.json")

print("==================================================")
print("   DEEP FORENSIC VERIFICATION FOR ANTIGRAVITY IDE 2.6.0")
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

# 2. Forensic AST / Text Pattern Verification in jetskiAgent/main.js
print("\n--- 2. jetskiAgent/main.js Pattern Verification ---")
with open(os.path.join(out_dir, "jetskiAgent", "main.js"), 'r', encoding='utf-8') as f:
    jc = f.read()

jc_checks = [
    ("WBa table header BiDi", 'WBa=({node:e,...t})=>d("th",{...t,dir:'),
    ("QBa blockquote BiDi", 'QBa=e=>{let t=pVe(),isR=Boolean(e?.children&&'),
    ("UZa in-progress task BiDi", 'if(a)return d("li",{...n,dir:'),
    ("UZa checked task BiDi", 'if(o){let{checkbox:h,inlineContent:f,sublists:E}=vdn(i);return d("li",{...n,dir:'),
    ("YBa paragraph object spread order", 'YBa=e=>{let{animate:t,claimStaggerDelays:r}=a9();return d("p",{...e,dir:'),
    ("OO header object spread order", 'OO=e=>{let t=r=>{let{animate:n,claimStaggerDelays:i}=a9();return d(e,{...r,dir:')
]

for name, sub in jc_checks:
    if sub in jc:
        print(f"[PASS] {name} verified.")
    else:
        print(f"[FAIL] {name} NOT matched!")
        failures += 1

# 3. Forensic Pattern Verification in workbench.desktop.main.js
print("\n--- 3. workbench.desktop.main.js Pattern Verification ---")
with open(os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.js"), 'r', encoding='utf-8') as f:
    wc = f.read()

wc_checks = [
    ("rDd table header BiDi", 'rDd=({node:t,...e})=>v("th",{...e,dir:'),
    ("dDd blockquote BiDi", 'dDd=t=>{let e=m8t(),isR=Boolean(t?.children&&'),
    ("KTd in-progress task BiDi", 'if(s)return v("li",{...n,dir:'),
    ("KTd checked task BiDi", 'if(o){let{checkbox:u,inlineContent:h,sublists:f}=pMo(r);return v("li",{...n,dir:'),
    ("oDd paragraph object spread order", 'oDd=t=>{let{animate:e,claimStaggerDelays:i}=$ne();return v("p",{...t,dir:'),
    ("_3e header object spread order", '_3e=t=>{let e=i=>{let{animate:n,claimStaggerDelays:r}=$ne();return v(t,{...i,dir:')
]

for name, sub in wc_checks:
    if sub in wc:
        print(f"[PASS] {name} verified.")
    else:
        print(f"[FAIL] {name} NOT matched!")
        failures += 1

# 4. DOM Sentinels Verification
print("\n--- 4. DOM Sentinels Verification ---")
for js_rel in ["vs/code/electron-browser/workbench/jetskiAgent.js", "vs/code/electron-browser/workbench/workbench.js"]:
    with open(os.path.join(out_dir, js_rel.replace('/', os.sep)), 'r', encoding='utf-8') as f:
        sc = f.read()
    has_sentinel = "// [Antigravity-Shield-IDE-BiDi-Sentinel]" in sc
    has_input_listener = "document.addEventListener('input'" in sc
    has_font = "Vazirmatn" in sc
    has_isolate = "unicode-bidi" in sc
    if has_sentinel and has_input_listener and has_font and has_isolate:
        print(f"[PASS] Sentinel in {js_rel} verified (contains observer, input listener, and Vazirmatn isolation).")
    else:
        print(f"[FAIL] Sentinel in {js_rel} incomplete! sentinel={has_sentinel}, input={has_input_listener}")
        failures += 1

# 5. HTML Style & Font Embedding Verification
print("\n--- 5. HTML Style & Font Embedding Verification ---")
for html_rel in ["vs/code/electron-browser/workbench/workbench.html", "vs/code/electron-browser/workbench/workbench-jetski-agent.html"]:
    with open(os.path.join(out_dir, html_rel.replace('/', os.sep)), 'r', encoding='utf-8') as f:
        hc = f.read()
    has_style = '<style id="antigravity-shield-ide-bidi">' in hc
    has_font_src = "font-src" in hc and "data:" in hc
    has_vazir_b64 = "data:font/woff2;base64," in hc
    has_table_rtl = 'th[dir="rtl"]' in hc
    has_input_rtl = 'contenteditable' in hc
    has_pre_isol = 'monaco-editor' in hc
    if has_style and has_font_src and has_vazir_b64 and has_table_rtl and has_input_rtl and has_pre_isol:
        print(f"[PASS] {html_rel} verified (Base64 WOFF2, font-src CSP, table & input RTL, pre isolation).")
    else:
        print(f"[FAIL] {html_rel} incomplete! style={has_style}, font_src={has_font_src}, b64={has_vazir_b64}")
        failures += 1

# 6. Cache directories verification
print("\n--- 6. Electron V8 Cache Clearance Verification ---")
roaming_ide = os.path.expandvars(r"%APPDATA%\Antigravity IDE")
for sub in ["Cache", os.path.join("Code Cache", "js"), "CachedData"]:
    cdir = os.path.join(roaming_ide, sub)
    exists = os.path.exists(cdir)
    print(f"[INFO] Cache dir '{sub}': {'EXISTS (may re-create on run)' if exists else 'PURGED'}")

print("\n==================================================")
if failures == 0:
    print(">>> FINAL RESULT: ALL 100% FORENSIC CHECKS PASSED SUCCESSFULLY! <<<")
else:
    print(f">>> FINAL RESULT: {failures} CHECKS FAILED! <<<")
print("==================================================")
