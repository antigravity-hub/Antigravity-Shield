# -*- coding: utf-8 -*-
"""
Persian (fa) i18n synchronization for Antigravity Shield.
Consolidates all authentic Persian translations, fixes variable corruptions,
and ensures 100% key parity with src/locales/en.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from scripts.i18n.engine import sync_and_write, load_en, load_locale, extract_vars, TECHNICAL_INVARIANTS

# Import dictionaries
import scripts.generate_fa as g_fa
import scripts.translate_all_locales as t_all
import scripts.translate_proxy_all as t_proxy
import scripts.locales.build_fa_full as fa_full
import scripts.locales.build_fa_final as fa_final
import scripts.locales.build_fa_final_p2 as fa_final_p2

VAR_FIXES = {
    "accounts.add.token.batch_progress": "در حال وارد کردن {{current}}/{{total}} حساب...",
    "accounts.add.token.batch_success": "{{count}} حساب با موفقیت وارد شدند",
    "accounts.add.token.batch_partial": "پایان واردسازی: {{success}} موفق، {{fail}} ناموفق",
    "accounts.add.oauth_error": "خطا در احراز هویت OAuth: {{error}}",
    "tray.current": "فعلی",
    "tray.quota": "سهمیه",
    "security.logs.total_records": "مجموعاً {{total}} رکورد",
    "security.logs.page_num": "صفحه {{page}}",
}

def build():
    en_tree, en_flat = load_en()
    _, fa_flat = load_locale('fa')

    # Merge all authentic translations
    combined_dict = dict(fa_flat)
    combined_dict.update(g_fa.TRANSLATIONS)
    combined_dict.update(t_all.FA_TRANSLATIONS)
    combined_dict.update(t_proxy.FA_PROXY_TRANSLATIONS)
    combined_dict.update(fa_full.FA_TRANSLATIONS)
    combined_dict.update(fa_final.FA_FINAL_484)
    combined_dict.update(fa_final_p2.FA_FINAL_P2)

    # Clean up any dictionary entries that are raw English unless invariant
    final_dict = {}
    for k, v in combined_dict.items():
        if k in en_flat:
            en_val = en_flat[k]
            if v.strip() != en_val.strip() or en_val.strip() in TECHNICAL_INVARIANTS:
                final_dict[k] = v

    return sync_and_write('fa', final_dict, VAR_FIXES)

if __name__ == '__main__':
    build()
