# -*- coding: utf-8 -*-
"""
Milestone 2 Comprehensive Verification Script for Antigravity Shield.
Validates all 13 locales against en.json for:
1. Exact leaf key count (2,407)
2. 0 missing keys
3. 0 extra keys
4. 0 variable mismatches
5. UTF-8 without BOM
6. CRLF line endings
7. JSON validity
"""
import os
import json
import re

LOCALES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/locales'))
EN_PATH = os.path.join(LOCALES_DIR, 'en.json')
ALL_LOCALES = ['en', 'ar', 'es', 'fa', 'ja', 'ko', 'my', 'pt', 'ru', 'tr', 'vi', 'zh-TW', 'zh']

VAR_REGEX = re.compile(r'\{\{([^}]+)\}\}')

def flatten(d, prefix=''):
    res = {}
    for k, v in d.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            res.update(flatten(v, full))
        else:
            res[full] = str(v)
    return res

def extract_vars(s):
    return sorted(VAR_REGEX.findall(str(s)))

def audit():
    print("=" * 80)
    print("MILESTONE 2: COMPREHENSIVE 13-LOCALE AUDIT")
    print("=" * 80)

    # 1. Load en.json
    with open(EN_PATH, 'rb') as f:
        en_raw = f.read()
    if en_raw.startswith(b'\xef\xbb\xbf'):
        print("[FAIL] en.json has UTF-8 BOM!")
        return False
    en_str = en_raw.decode('utf-8')
    en_tree = json.loads(en_str)
    en_flat = flatten(en_tree)
    expected_leaf_count = len(en_flat)
    print(f"Canonical Source (en.json): {expected_leaf_count} leaf keys")
    print("-" * 80)

    results = []
    has_errors = False

    for loc in ALL_LOCALES:
        loc_path = os.path.join(LOCALES_DIR, f"{loc}.json")
        if not os.path.exists(loc_path):
            print(f"[FAIL] {loc}.json not found!")
            has_errors = True
            continue

        with open(loc_path, 'rb') as f:
            raw = f.read()

        has_bom = raw.startswith(b'\xef\xbb\xbf')
        has_crlf = (b'\r\n' in raw) and (not raw.replace(b'\r\n', b'').count(b'\n'))
        
        try:
            content = raw.decode('utf-8')
            tree = json.loads(content)
        except Exception as e:
            print(f"[FAIL] {loc}.json JSON parse error: {e}")
            has_errors = True
            continue

        flat = flatten(tree)
        leaf_count = len(flat)
        missing = [k for k in en_flat if k not in flat]
        extra = [k for k in flat if k not in en_flat]
        
        var_mismatches = []
        for k in en_flat:
            if k in flat:
                en_v = extract_vars(en_flat[k])
                loc_v = extract_vars(flat[k])
                if en_v != loc_v:
                    var_mismatches.append((k, en_v, loc_v))

        status_ok = (
            not has_bom and
            has_crlf and
            leaf_count == expected_leaf_count and
            len(missing) == 0 and
            len(extra) == 0 and
            len(var_mismatches) == 0
        )

        if not status_ok:
            has_errors = True

        results.append({
            "locale": f"{loc}.json",
            "leaf_count": leaf_count,
            "missing": len(missing),
            "extra": len(extra),
            "var_mismatches": len(var_mismatches),
            "no_bom": not has_bom,
            "crlf": has_crlf,
            "status": "PASS" if status_ok else "FAIL"
        })

    # Print summary table
    fmt = "{:<12} | {:<10} | {:<8} | {:<6} | {:<14} | {:<7} | {:<5} | {:<6}"
    print(fmt.format("Locale", "Leaf Keys", "Missing", "Extra", "Var Mismatches", "No BOM", "CRLF", "Status"))
    print("-" * 80)
    for r in results:
        print(fmt.format(
            r["locale"],
            f"{r['leaf_count']}/{expected_leaf_count}",
            r["missing"],
            r["extra"],
            r["var_mismatches"],
            "YES" if r["no_bom"] else "NO",
            "YES" if r["crlf"] else "NO",
            r["status"]
        ))
    print("=" * 80)

    if has_errors:
        print("RESULT: AUDIT FAILED - regressions detected.")
        return False
    else:
        print("RESULT: AUDIT PASSED - 100% PARITY & ZERO MISMATCHES ACROSS ALL 13 LOCALES!")
        return True

if __name__ == '__main__':
    import sys
    success = audit()
    sys.exit(0 if success else 1)
