import os
import sys
import hashlib
import json
import base64
import subprocess
import shutil
import re

app_dir = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app"
out_dir = os.path.join(app_dir, "out")
wb_orig = os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.js.orig")
wb_main = os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.js")
product_json_path = os.path.join(app_dir, "product.json")
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
patch_rs_path = os.path.join(repo_root, "src-tauri", "src", "commands", "patch.rs")
apply_patch_script = os.path.join(repo_root, "scripts", "apply_ide_patch.py")
verify_deep_script = os.path.join(repo_root, "scripts", "verify_deep.py")

print("======================================================================")
print("   ADVERSARIAL CHALLENGER: PATCH IDEMPOTENCY & INVARIANTS HARNESS   ")
print("======================================================================")

def compute_sha256_b64(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    digest = hashlib.sha256(data).digest()
    return base64.b64encode(digest).decode('ascii').rstrip('=')

def compute_sha256_hex(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    return hashlib.sha256(data).hexdigest()

target_files = [
    ("vs/workbench/workbench.desktop.main.js", os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.js")),
    ("vs/workbench/workbench.desktop.main.css", os.path.join(out_dir, "vs", "workbench", "workbench.desktop.main.css")),
    ("jetskiAgent/main.css", os.path.join(out_dir, "jetskiAgent", "main.css")),
    ("jetskiMain.tailwind.css", os.path.join(out_dir, "jetskiMain.tailwind.css")),
    ("tw-base.tailwind.css", os.path.join(out_dir, "tw-base.tailwind.css")),
    ("vs/code/electron-browser/workbench/workbench.js", os.path.join(out_dir, "vs", "code", "electron-browser", "workbench", "workbench.js")),
    ("vs/code/electron-browser/workbench/jetskiAgent.js", os.path.join(out_dir, "vs", "code", "electron-browser", "workbench", "jetskiAgent.js")),
    ("vs/code/electron-browser/workbench/workbench.html", os.path.join(out_dir, "vs", "code", "electron-browser", "workbench", "workbench.html")),
    ("vs/code/electron-browser/workbench/workbench-jetski-agent.html", os.path.join(out_dir, "vs", "code", "electron-browser", "workbench", "workbench-jetski-agent.html")),
    ("vs/workbench/contrib/webview/browser/pre/index.html", os.path.join(out_dir, "vs", "workbench", "contrib", "webview", "browser", "pre", "index.html")),
]

# PHASE 1: Baseline Verification of product.json checksums
print("\n>>> PHASE 1: INDEPENDENT CHECKSUM AUDIT (DIRECT DISK VS product.json)")
with open(product_json_path, 'r', encoding='utf-8') as f:
    pj = json.load(f)
checksums = pj.get("checksums", {})

phase1_failures = 0
for rel, path in target_files:
    if not os.path.exists(path):
        print(f"[FAIL] Target file missing: {path}")
        phase1_failures += 1
        continue
    actual_b64 = compute_sha256_b64(path)
    expected_rel = checksums.get(rel)
    expected_out = checksums.get(f"out/{rel}")
    
    if actual_b64 != expected_rel:
        print(f"[FAIL] {rel}: expected {expected_rel}, got actual {actual_b64}")
        phase1_failures += 1
    elif actual_b64 != expected_out:
        print(f"[FAIL] out/{rel}: expected {expected_out}, got actual {actual_b64}")
        phase1_failures += 1
    else:
        print(f"[PASS] {rel} (and out/{rel}) -> {actual_b64}")

if phase1_failures > 0:
    print(f"PHASE 1 FAILED with {phase1_failures} checksum mismatches!")
    sys.exit(1)
else:
    print("PHASE 1 PASSED: 100% of checksums match raw physical bytes.")

# PHASE 2: Backup Invariant Initial State
print("\n>>> PHASE 2: BACKUP INTEGRITY AUDIT (.orig Pristine State)")
if not os.path.exists(wb_orig):
    print(f"[FAIL] Pristine backup {wb_orig} does not exist!")
    sys.exit(1)

initial_orig_hash = compute_sha256_hex(wb_orig)
initial_orig_size = os.path.getsize(wb_orig)
print(f"[INFO] wb_orig initial size: {initial_orig_size:,} bytes")
print(f"[INFO] wb_orig initial SHA-256: {initial_orig_hash}")

# Check pristine orig content
with open(wb_orig, 'r', encoding='utf-8') as f:
    orig_content = f.read()

# Assert orig does not have patched marker or replacement strings
assert 'dir:"auto",...t,className:ht(t.className)' not in orig_content, "orig contains patched oDd!"
assert 'dir:"auto",...t,animate:e,claimStaggerDelays:i' not in orig_content, "orig contains patched aDd!"
assert 'dir:"auto",...i,className:ht(i.className)' not in orig_content, "orig contains patched _3e!"
assert 'dir:"auto",className:ht("leading-relaxed"' not in orig_content, "orig contains patched pDd!"
assert 'font-family: \'Vazirmatn\'' not in orig_content, "orig contains patched wNd!"
assert 'dir:"auto",className:"px-2 py-1"' not in orig_content, "orig contains patched PHd!"
assert 'dir:"auto",role:"article","aria-label":"Agent response"' not in orig_content, "orig contains patched zHd!"
assert 'dir:"auto","data-quotable":"true",className:"whitespace-pre-wrap text-sm"' not in orig_content, "orig contains patched LPd!"
assert 'dir:"auto",style:a?sWe.container:void 0,"data-testid":"conversation-view"' not in orig_content, "orig contains patched conversation-view!"
assert 'dir:"auto","data-testid":"user-message-bubble"' not in orig_content, "orig contains patched user-message-bubble!"
print("[PASS] wb_orig is 100% clean of all patched Preact AST replacements.")

# Record initial hashes of all target files before repeated runs
baseline_hashes = {}
for rel, path in target_files:
    baseline_hashes[rel] = {
        "size": os.path.getsize(path),
        "sha256": compute_sha256_hex(path),
        "b64": compute_sha256_b64(path)
    }

# PHASE 3: Patch Idempotency Stress Test (3 Consecutive Iterations)
print("\n>>> PHASE 3: CONSECUTIVE PATCH APPLICATION STRESS-TEST (IDEMPOTENCY)")
num_iterations = 3
iteration_hashes = []

for i in range(1, num_iterations + 1):
    print(f"\n--- Running apply_ide_patch.py (Iteration {i}/{num_iterations}) ---")
    proc = subprocess.run([sys.executable, apply_patch_script], capture_output=True, text=True, check=True)
    print(f"apply_ide_patch.py exited 0. Output lines: {len(proc.stdout.splitlines())}")

    # Check wb_orig integrity
    current_orig_hash = compute_sha256_hex(wb_orig)
    current_orig_size = os.path.getsize(wb_orig)
    if current_orig_hash != initial_orig_hash or current_orig_size != initial_orig_size:
        print(f"[FAIL] wb_orig was corrupted or modified during iteration {i}!")
        print(f"Expected: {initial_orig_hash} ({initial_orig_size} bytes)")
        print(f"Actual:   {current_orig_hash} ({current_orig_size} bytes)")
        sys.exit(1)
    else:
        print(f"[PASS] wb_orig remains pristine and untouched in iteration {i}.")

    # Snapshot target files hashes
    curr_hashes = {}
    for rel, path in target_files:
        curr_hashes[rel] = {
            "size": os.path.getsize(path),
            "sha256": compute_sha256_hex(path),
            "b64": compute_sha256_b64(path)
        }
    iteration_hashes.append(curr_hashes)

    # Check needle counts in CSS (open count must be 1, close count must be 2 due to embedded marker, no growth!)
    for css_rel in ["vs/workbench/workbench.desktop.main.css", "jetskiAgent/main.css"]:
        cp = os.path.join(out_dir, css_rel.replace('/', os.sep))
        with open(cp, 'r', encoding='utf-8') as f:
            c = f.read()
        open_tag = c.count("/* [Antigravity-Shield-RTL-Vazirmatn] */")
        close_tag = c.count("/* [/Antigravity-Shield-RTL-Vazirmatn] */")
        if open_tag != 1:
            print(f"[FAIL] {css_rel} has invalid opening tag count: {open_tag} (expected 1)")
            sys.exit(1)
        if close_tag != 1:
            print(f"[FAIL] {css_rel} has unexpected close tag count: {close_tag} (expected 1)")
            sys.exit(1)
        print(f"[PASS] {css_rel} opening tag count={open_tag}, close tag count={close_tag} (stable, zero growth).")

    # Check needle counts in JS sentinels
    for js_rel in ["vs/code/electron-browser/workbench/workbench.js", "vs/code/electron-browser/workbench/jetskiAgent.js"]:
        jp = os.path.join(out_dir, js_rel.replace('/', os.sep))
        with open(jp, 'r', encoding='utf-8') as f:
            c = f.read()
        sentinel_count = c.count("// [Antigravity-Shield-IDE-BiDi-Sentinel]")
        if sentinel_count != 1:
            print(f"[FAIL] {js_rel} has duplicate Sentinel blocks: count={sentinel_count}")
            sys.exit(1)
        else:
            print(f"[PASS] {js_rel} has exactly 1 Sentinel block.")

    # Check needle counts in HTML
    for html_rel in ["vs/code/electron-browser/workbench/workbench.html", "vs/code/electron-browser/workbench/workbench-jetski-agent.html", "vs/workbench/contrib/webview/browser/pre/index.html"]:
        hp = os.path.join(out_dir, html_rel.replace('/', os.sep))
        with open(hp, 'r', encoding='utf-8') as f:
            c = f.read()
        style_count = c.count('<style id="antigravity-shield-ide-bidi">')
        if style_count != 1:
            print(f"[FAIL] {html_rel} has duplicate style tags: count={style_count}")
            sys.exit(1)
        else:
            print(f"[PASS] {html_rel} has exactly 1 style tag.")

    # Re-verify product.json checksums
    with open(product_json_path, 'r', encoding='utf-8') as f:
        curr_pj = json.load(f)
    curr_csums = curr_pj.get("checksums", {})
    for rel, path in target_files:
        act = compute_sha256_b64(path)
        exp = curr_csums.get(rel)
        if act != exp:
            print(f"[FAIL] product.json checksum mismatch in iteration {i} for {rel}!")
            sys.exit(1)
    print(f"[PASS] product.json checksums 100% synchronized in iteration {i}.")

    # Run verify_deep.py
    vproc = subprocess.run([sys.executable, verify_deep_script], capture_output=True, text=True)
    if vproc.returncode != 0:
        print(f"[FAIL] verify_deep.py failed in iteration {i}!")
        print(vproc.stdout)
        print(vproc.stderr)
        sys.exit(1)
    else:
        print(f"[PASS] verify_deep.py passed all tests (0 failures) in iteration {i}.")

# Compare baseline vs iteration 1, 2, and 3 hashes
print("\n>>> COMPARING REPEATABILITY AND STABILITY ACROSS CONSECUTIVE RUNS")
for rel, _ in target_files:
    b = baseline_hashes[rel]
    h1 = iteration_hashes[0][rel]
    h2 = iteration_hashes[1][rel]
    h3 = iteration_hashes[2][rel]
    if not (b['sha256'] == h1['sha256'] == h2['sha256'] == h3['sha256']):
        print(f"[FAIL] Non-idempotent hash mutation detected on {rel}!")
        print(f"Base:  {b['sha256']}")
        print(f"Run 1: {h1['sha256']}")
        print(f"Run 2: {h2['sha256']}")
        print(f"Run 3: {h3['sha256']}")
        sys.exit(1)
    if not (b['size'] == h1['size'] == h2['size'] == h3['size']):
        print(f"[FAIL] Non-idempotent file size drift detected on {rel}!")
        sys.exit(1)
    print(f"[PASS] {rel} perfectly idempotent across baseline and 3 runs (size={h3['size']:,} bytes).")

# PHASE 4: Cross-Engine Synchronization Check (Rust vs Python)
print("\n>>> PHASE 4: CROSS-ENGINE SYNCHRONIZATION AUDIT (Rust vs Python)")
with open(patch_rs_path, 'r', encoding='utf-8') as f:
    rs_code = f.read()

with open(apply_patch_script, 'r', encoding='utf-8') as f:
    py_code = f.read()

# 1. Compare Preact AST replacement needles
rs_replacements_pattern = re.search(r'let wb_replacements = \[(.*?)\];', rs_code, re.DOTALL)
assert rs_replacements_pattern, "Could not find wb_replacements in patch.rs"
rs_block = rs_replacements_pattern.group(1)

wb_replacements_py = re.search(r'wb_replacements = \[(.*?)\]\n\nfor idx', py_code, re.DOTALL)
assert wb_replacements_py, "Could not find wb_replacements in apply_ide_patch.py"
py_block = wb_replacements_py.group(1)

# Check each of the 10 needles in Rust
ns = {}
exec('py_reps = [' + py_block + ']', ns)
for idx, (t, r) in enumerate(ns['py_reps'], 1):
    sub_t = t[:40]
    sub_escaped = sub_t.replace('"', '\\"').replace('\n', '\\n')
    assert (sub_t in rs_code or sub_escaped in rs_code), f"Target {idx} substring '{sub_t}' not found in patch.rs!"
    print(f"[PASS] AST Needle {idx} verified present in both Python and Rust patchers.")

# 2. Check CSS extraction
m_css = re.search(r'pub const VAZIRMATN_RTL_CSS: &str = r#"(.*?)"#;', rs_code, re.DOTALL)
assert m_css, "VAZIRMATN_RTL_CSS not found in patch.rs"
rust_css = m_css.group(1).strip()
print(f"[PASS] Rust VAZIRMATN_RTL_CSS verified: {len(rust_css):,} bytes.")
assert len(rust_css) > 300000, "CSS too small, possible corruption!"

# 3. Check Sentinel in Rust
assert '// [Antigravity-Shield-IDE-BiDi-Sentinel]' in rs_code, "Sentinel missing in patch.rs"
assert 'isPersian' in rs_code, "isPersian regex missing in patch.rs sentinel!"
assert 'applyBiDiToElement' in rs_code, "applyBiDiToElement missing in patch.rs"
print("[PASS] Sentinel code synchronized in patch.rs.")

print("\n======================================================================")
print("   ALL ADVERSARIAL CHALLENGE CHECKS PASSED WITH 100% PERFECTION!     ")
print("======================================================================")
