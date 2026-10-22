# -*- coding: utf-8 -*-
import json
import re
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

LOCALES_DIR = 'src/locales'
EN_PATH = os.path.join(LOCALES_DIR, 'en.json')
ZH_PATH = os.path.join(LOCALES_DIR, 'zh.json')

with open(EN_PATH, 'r', encoding='utf-8') as f:
    en_tree = json.load(f)

with open(ZH_PATH, 'r', encoding='utf-8') as f:
    zh_tree = json.load(f)

def flatten(d, p=''):
    res = {}
    for k, v in d.items():
        full = f"{p}.{k}" if p else k
        if isinstance(v, dict):
            res.update(flatten(v, full))
        else:
            res[full] = str(v)
    return res

en_flat = flatten(en_tree)
zh_flat = flatten(zh_tree)

with open('scripts/locales/zh_final_dict.json', 'r', encoding='utf-8') as f:
    zh_patch = json.load(f)

var_regex = re.compile(r'\{\{([^}]+)\}\}')
out_flat = {}

for k, en_val in en_flat.items():
    en_vars = sorted(var_regex.findall(en_val))
    
    chosen = None
    if k in zh_patch:
        chosen = zh_patch[k]
    elif k in zh_flat:
        existing = zh_flat[k]
        loc_vars = sorted(var_regex.findall(existing))
        is_same_en = (existing.strip() == en_val.strip())
        vars_ok = (en_vars == loc_vars)
        is_invariant = en_val.strip() in ["Antigravity Shield", "PRO", "ULTRA", "FREE", "API Key", "JSON", "URL", "OK", "cURL", "Python", "Node.js", "Docker", "VS Code", "Cursor", "Windsurf", "v1/chat/completions", "v1/messages"]
        
        if vars_ok and (not is_same_en or is_invariant):
            chosen = existing
            
    if chosen is None:
        chosen = en_val

    # Guarantee variables
    chosen_vars = sorted(var_regex.findall(chosen))
    if en_vars != chosen_vars:
        for v in en_vars:
            if f"{{{{{v}}}}}" not in chosen:
                chosen += f" {{{{{v}}}}}"
        for v in chosen_vars:
            if v not in en_vars:
                chosen = chosen.replace(f"{{{{{v}}}}}", "")

    out_flat[k] = chosen

# Reconstruct nested structure matching en.json exactly
def unflatten_from_en(en_obj, prefix=''):
    res = {}
    for k, v in en_obj.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            res[k] = unflatten_from_en(v, full)
        else:
            res[k] = out_flat[full]
    return res

zh_nested = unflatten_from_en(en_tree)

# Format with CRLF and 2 spaces
with open(ZH_PATH, 'w', encoding='utf-8') as f:
    json_str = json.dumps(zh_nested, ensure_ascii=False, indent=2).replace('\n', '\r\n') + '\r\n'
    f.write(json_str)

# Verification
missing = [k for k in en_flat if k not in out_flat]
var_mismatches = []
for k in en_flat:
    en_v = sorted(var_regex.findall(en_flat[k]))
    loc_v = sorted(var_regex.findall(out_flat[k]))
    if en_v != loc_v:
        var_mismatches.append(k)

untranslated_en = []
for k, en_val in en_flat.items():
    val = out_flat[k]
    if val == en_val and (' ' in en_val or len(en_val) > 10) and en_val.strip() not in ['Antigravity Shield', 'PRO', 'ULTRA', 'FREE', 'API Key', 'JSON', 'URL', 'OK']:
        untranslated_en.append((k, en_val))

print(f"=== ZH.JSON VERIFICATION ===")
print(f"Total keys: {len(out_flat)} / 2407")
print(f"Missing keys: {len(missing)}")
print(f"Variable mismatches: {len(var_mismatches)}")
print(f"Untranslated English: {len(untranslated_en)}")
if untranslated_en:
    print(f"First 5 untranslated: {untranslated_en[:5]}")
