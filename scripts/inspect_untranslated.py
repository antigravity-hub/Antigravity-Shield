import sys, json, os
sys.stdout.reconfigure(encoding='utf-8')

with open('src/locales/en.json', encoding='utf-8') as f:
    en = json.load(f)

for lang in ['zh', 'zh-TW', 'tr', 'fa']:
    with open(f'src/locales/{lang}.json', encoding='utf-8') as f:
        loc = json.load(f)
    print(f'******************** {lang} ********************')
    count = 0
    for top_k, top_v in en.items():
        if isinstance(top_v, dict):
            for sub_k, sub_v in top_v.items():
                if isinstance(sub_v, str) and len(sub_v) > 3:
                    loc_val = loc.get(top_k, {}).get(sub_k)
                    if loc_val == sub_v and not sub_v.startswith('http') and not sub_v.startswith('{{') and not sub_v.isupper():
                        print(f'{top_k}.{sub_k}: {json.dumps(sub_v, ensure_ascii=False)}')
                        count += 1
                elif isinstance(sub_v, dict):
                    for sub2_k, sub2_v in sub_v.items():
                        if isinstance(sub2_v, str) and len(sub2_v) > 3:
                            loc_val = loc.get(top_k, {}).get(sub_k, {}).get(sub2_k)
                            if loc_val == sub2_v and not sub2_v.startswith('http') and not sub2_v.startswith('{{') and not sub2_v.isupper():
                                print(f'{top_k}.{sub_k}.{sub2_k}: {json.dumps(sub2_v, ensure_ascii=False)}')
                                count += 1
    print(f'Total untranslated in {lang}: {count}\n')
