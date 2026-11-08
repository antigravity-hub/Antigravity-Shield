import os
import sys
import hashlib
import json
import base64
import subprocess
import re

APP_DIR = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
OUT_DIR = os.path.join(APP_DIR, "out")
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
APPLY_PATCH = os.path.join(REPO_ROOT, "scripts", "apply_ide_patch.py")
VERIFY_DEEP = os.path.join(REPO_ROOT, "scripts", "verify_deep.py")

TARGET_FILES = [
    ("workbench.desktop.main.js", os.path.join(OUT_DIR, "vs", "workbench", "workbench.desktop.main.js")),
    ("workbench.desktop.main.css", os.path.join(OUT_DIR, "vs", "workbench", "workbench.desktop.main.css")),
    ("jetskiAgent/main.css", os.path.join(OUT_DIR, "jetskiAgent", "main.css")),
    ("jetskiMain.tailwind.css", os.path.join(OUT_DIR, "jetskiMain.tailwind.css")),
    ("tw-base.tailwind.css", os.path.join(OUT_DIR, "tw-base.tailwind.css")),
    ("workbench.js", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench.js")),
    ("jetskiAgent.js", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "jetskiAgent.js")),
    ("workbench.html", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench.html")),
    ("workbench-jetski-agent.html", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench-jetski-agent.html")),
    ("index.html", os.path.join(OUT_DIR, "vs", "workbench", "contrib", "webview", "browser", "pre", "index.html")),
    ("jetskiAgent/main.js", os.path.join(OUT_DIR, "jetskiAgent", "main.js")),
]

HTML_FILES = [
    ("workbench.html", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench.html")),
    ("workbench-jetski-agent.html", os.path.join(OUT_DIR, "vs", "code", "electron-browser", "workbench", "workbench-jetski-agent.html")),
    ("index.html", os.path.join(OUT_DIR, "vs", "workbench", "contrib", "webview", "browser", "pre", "index.html")),
]

def get_file_stats(path):
    with open(path, 'rb') as f:
        data = f.read()
    digest = hashlib.sha256(data).digest()
    b64 = base64.b64encode(digest).decode('ascii').rstrip('=')
    hex_digest = hashlib.sha256(data).hexdigest()
    return len(data), hex_digest, b64

def inspect_html_head_spacing(path, label):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    style_count = content.count('<style id="antigravity-shield-ide-bidi">')
    if style_count != 1:
        raise AssertionError(f"[{label}] Expected 1 style tag, found {style_count}")
    
    # Check what appears directly before </head>
    head_pos = content.find('</head>')
    if head_pos == -1:
        raise AssertionError(f"[{label}] Missing </head> tag!")
    
    style_end = content.find('</style>', head_pos - 100)
    if style_end == -1:
        # style tag might be earlier, search before head_pos
        style_end = content.rfind('</style>', 0, head_pos)
    
    between = content[style_end + len('</style>'):head_pos]
    newline_count = between.count('\n')
    
    return {
        "style_count": style_count,
        "between_bytes": repr(between),
        "newline_count": newline_count
    }

print("=" * 70)
print("   EMPIRICAL ADVERSARIAL CHALLENGER: 5-RUN IDEMPOTENCY HARNESS   ")
print("=" * 70)

# Capture initial state
baseline_stats = {}
for name, p in TARGET_FILES:
    if os.path.exists(p):
        size, h_hex, b64 = get_file_stats(p)
        baseline_stats[name] = {"size": size, "hex": h_hex, "b64": b64}
        print(f"[BASELINE] {name:<30} size={size:>10,} bytes  sha256={b64}")

for name, p in HTML_FILES:
    res = inspect_html_head_spacing(p, name)
    print(f"[BASELINE-HTML] {name:<30} style_count={res['style_count']} newlines_before_head={res['newline_count']} raw={res['between_bytes']}")

NUM_RUNS = 5
for run_idx in range(1, NUM_RUNS + 1):
    print(f"\n>>> Executing Run {run_idx}/{NUM_RUNS} of apply_ide_patch.py ...")
    res = subprocess.run([sys.executable, APPLY_PATCH], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[FATAL] apply_ide_patch.py failed on run {run_idx}!")
        print(res.stderr)
        sys.exit(1)
    
    # Check drift across target files
    drift_detected = False
    for name, p in TARGET_FILES:
        if not os.path.exists(p):
            continue
        cur_size, cur_hex, cur_b64 = get_file_stats(p)
        base = baseline_stats[name]
        
        delta_bytes = cur_size - base["size"]
        if delta_bytes != 0 or cur_hex != base["hex"]:
            print(f"[DRIFT DETECTED] {name} on run {run_idx}: delta={delta_bytes} bytes, hash_change={cur_hex != base['hex']}")
            drift_detected = True
        else:
            pass
    
    if drift_detected:
        print(f"[FAIL] Idempotency violated on run {run_idx}!")
        sys.exit(1)
    else:
        print(f"[PASS] Run {run_idx}: EXACT 0 BYTES DRIFT across all target files!")
    
    # Check HTML head newlines
    for name, p in HTML_FILES:
        info = inspect_html_head_spacing(p, name)
        if info["newline_count"] != 1 or info["style_count"] != 1:
            print(f"[FAIL] HTML {name} on run {run_idx} has invalid spacing: {info}")
            sys.exit(1)
    print(f"[PASS] Run {run_idx}: HTML files have strictly 1 style tag and exactly 1 newline before </head>.")

# Audit product.json
print("\n>>> Auditing product.json checksums against physical disk bytes ...")
with open(os.path.join(APP_DIR, "product.json"), 'r', encoding='utf-8') as f:
    pj = json.load(f)
csums = pj.get("checksums", {})

for name, p in TARGET_FILES:
    if not os.path.exists(p):
        continue
    _, _, cur_b64 = get_file_stats(p)
    # Check rel and out/rel
    rel_key = os.path.relpath(p, APP_DIR).replace(os.sep, '/')
    if rel_key.startswith("out/"):
        short_key = rel_key[4:]
    else:
        short_key = rel_key
    
    exp1 = csums.get(short_key)
    exp2 = csums.get(f"out/{short_key}")
    
    if exp1 and exp1 != cur_b64:
        print(f"[FAIL] product.json mismatch for {short_key}: expected {exp1}, got {cur_b64}")
        sys.exit(1)
    if exp2 and exp2 != cur_b64:
        print(f"[FAIL] product.json mismatch for out/{short_key}: expected {exp2}, got {cur_b64}")
        sys.exit(1)
    print(f"[PASS] product.json matches disk for {short_key} ({cur_b64})")

# Run verify_deep.py
print("\n>>> Running scripts/verify_deep.py ...")
v_res = subprocess.run([sys.executable, VERIFY_DEEP], capture_output=True, text=True)
print(v_res.stdout)
if v_res.returncode != 0:
    print(f"[FAIL] verify_deep.py failed!")
    print(v_res.stderr)
    sys.exit(1)

print("=" * 70)
print("   EMPIRICAL ADVERSARIAL CHALLENGE COMPLETED: 100% PASS   ")
print("=" * 70)
