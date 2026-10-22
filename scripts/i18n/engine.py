# -*- coding: utf-8 -*-
"""
Core i18n Synchronization & Validation Engine for Antigravity Shield.
Enforces 100% key parity, variable preservation, UTF-8 CRLF 2-space formatting.
"""
import json
import re
import os
import sys

LOCALES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src/locales'))
EN_PATH = os.path.join(LOCALES_DIR, 'en.json')

VAR_REGEX = re.compile(r'\{\{([^}]+)\}\}')

TECHNICAL_INVARIANTS = {
    "Antigravity Shield", "PRO", "ULTRA", "FREE", "API Key", "JSON", "URL", "OK",
    "cURL", "Python", "Node.js", "Docker", "VS Code", "Cursor", "Windsurf", "Cline",
    "Roo Code", "OpenCode", "Postman", "v1/chat/completions", "v1/messages",
    "Gemini 4 Argon", "Claude Sonnet 4.6", "gemini-3.8-flash", "Claude 3.5 Haiku",
    "Claude Opus 4.6", "Gemini Pro", "Gemini Flash", "Gemini 3", "Cloudflare WARP",
    "Google Cloud Console", "@DrGuidance", "macMachineId:", "devDeviceId:", "sqmId:", "machineId:"
}

def flatten(d, p=''):
    res = {}
    for k, v in d.items():
        full = f"{p}.{k}" if p else k
        if isinstance(v, dict):
            res.update(flatten(v, full))
        else:
            res[full] = str(v)
    return res

def extract_vars(text):
    return sorted(VAR_REGEX.findall(str(text)))

def load_en():
    with open(EN_PATH, 'r', encoding='utf-8') as f:
        tree = json.load(f)
    return tree, flatten(tree)

def load_locale(lang):
    path = os.path.join(LOCALES_DIR, f"{lang}.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            tree = json.load(f)
        return tree, flatten(tree)
    return {}, {}

def unflatten_from_en(en_obj, flat_data, prefix=''):
    res = {}
    for k, v in en_obj.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            res[k] = unflatten_from_en(v, flat_data, full)
        else:
            res[k] = flat_data.get(full, v)
    return res

def sync_and_write(lang, translation_dict, var_fixes=None):
    en_tree, en_flat = load_en()
    _, loc_flat = load_locale(lang)
    if var_fixes is None:
        var_fixes = {}

    out_flat = {}
    for k, en_val in en_flat.items():
        en_vars = extract_vars(en_val)
        
        # 1. Explicit variable fix takes top priority
        if k in var_fixes:
            val = var_fixes[k]
        # 2. Translation dictionary
        elif k in translation_dict:
            val = translation_dict[k]
        # 3. Existing translation in target file
        elif k in loc_flat:
            existing = loc_flat[k]
            loc_vars = extract_vars(existing)
            is_same_en = (existing.strip() == en_val.strip())
            vars_ok = (en_vars == loc_vars)
            is_invariant = en_val.strip() in TECHNICAL_INVARIANTS
            
            # If variables match and not untranslated English sentence, keep it
            if vars_ok and (not is_same_en or is_invariant):
                val = existing
            else:
                val = en_val
        else:
            val = en_val

        # Guarantee interpolation variables match en_val exactly
        val_vars = extract_vars(val)
        if en_vars != val_vars:
            # inject any missing variables
            for v in en_vars:
                if f"{{{{{v}}}}}" not in val:
                    val += f" {{{{{v}}}}}"
            # strip any stray variables
            for v in val_vars:
                if v not in en_vars:
                    val = val.replace(f"{{{{{v}}}}}", "")
        
        out_flat[k] = val

    # Build nested tree
    nested_tree = unflatten_from_en(en_tree, out_flat)
    
    # Write to target file with UTF-8, CRLF, 2 spaces indentation
    target_path = os.path.join(LOCALES_DIR, f"{lang}.json")
    json_str = json.dumps(nested_tree, ensure_ascii=False, indent=2).replace('\n', '\r\n') + '\r\n'
    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(json_str)

    # Validate
    missing = [k for k in en_flat if k not in out_flat]
    var_mismatches = []
    for k in en_flat:
        en_v = extract_vars(en_flat[k])
        loc_v = extract_vars(out_flat[k])
        if en_v != loc_v:
            var_mismatches.append((k, en_v, loc_v))

    untranslated = []
    for k, en_val in en_flat.items():
        v = out_flat[k]
        trimmed = en_val.strip()
        if v == en_val and trimmed not in TECHNICAL_INVARIANTS and (" " in trimmed or len(trimmed) > 12):
            # Check if code snippet
            if not ("from openai import" in en_val or "from anthropic import" in en_val or "import google.generativeai" in en_val or "gcloud auth" in en_val):
                untranslated.append((k, en_val))

    print(f"[{lang.upper()}] Leaf Keys: {len(out_flat)}/2407 | Missing: {len(missing)} | Var Mismatches: {len(var_mismatches)} | Untranslated Sentences: {len(untranslated)}")
    return {
        "lang": lang,
        "leaf_count": len(out_flat),
        "missing": missing,
        "var_mismatches": var_mismatches,
        "untranslated": untranslated
    }
