# -*- coding: utf-8 -*-
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from scripts.i18n.engine import sync_and_write

# Load final dictionary
with open('scripts/locales/zh_final_dict.json', 'r', encoding='utf-8') as f:
    zh_dict = json.load(f)

# Extra fixes for zh
VAR_FIXES = {
    "proxy.cli_sync.toast.sync_error": "同步失败：{{error}}",
}

def build():
    return sync_and_write('zh', zh_dict, VAR_FIXES)

if __name__ == '__main__':
    res = build()
