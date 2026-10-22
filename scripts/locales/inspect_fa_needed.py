# -*- coding: utf-8 -*-
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
with open('scripts/locales/fa_still_untranslated_484.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for k, v in sorted(d.items()):
    if k.startswith('settings.'):
        print(f'"{k}": "{v}",')
