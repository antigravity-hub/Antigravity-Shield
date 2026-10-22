# -*- coding: utf-8 -*-
"""
Traditional Chinese (zh-TW) i18n synchronization for Antigravity Shield.
Converts Simplified Chinese to authentic Taiwanese Traditional Chinese terminology.
"""
import json
import os
import re
import sys
import zhconv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from scripts.i18n.engine import sync_and_write, load_en, load_locale, extract_vars, TECHNICAL_INVARIANTS

# Taiwan IT Terminology Replacements
TW_TERMS = [
    ("默認", "預設"),
    ("設置", "設定"),
    ("項目", "專案"),
    ("支持", "支援"),
    ("登錄", "登入"),
    ("註銷", "登出"),
    ("退出登錄", "登出"),
    ("剪貼板", "剪貼簿"),
    ("刷新", "重新整理"),
    ("網絡", "網路"),
    ("高級", "進階"),
    ("幫助", "說明"),
    ("快捷鍵", "快速鍵"),
    ("保存", "儲存"),
    ("屏幕", "螢幕"),
    ("窗口", "視窗"),
    ("菜單", "選單"),
    ("圖標", "圖示"),
    ("鏈接", "連結"),
    ("正在運行", "執行中"),
    ("加載", "載入"),
    ("文件夾", "資料夾"),
    ("文件", "檔案"),
    ("數據", "資料"),
    ("信息", "資訊"),
    ("用戶", "使用者"),
    ("創建", "建立"),
    ("構建", "建置"),
    ("運行", "執行"),
    ("緩存", "快取"),
    ("內存", "記憶體"),
    ("硬盤", "硬碟"),
    ("光標", "游標"),
    ("提示詞", "提示詞"),
    ("客戶端", "用戶端"),
    ("代理伺服器", "代理伺服器"),
    ("服務器", "伺服器")
]

def to_taiwan_tw(text):
    if not text:
        return text
    # Keep invariants untouched
    res = zhconv.convert(text, 'zh-tw')
    for src, dst in TW_TERMS:
        res = res.replace(src, dst)
    return res

VAR_FIXES = {
    "proxy.cli_sync.toast.sync_error": "同步失敗：{{error}}"
}

def build():
    en_tree, en_flat = load_en()
    _, zh_flat = load_locale('zh')
    _, tw_flat = load_locale('zh-TW')

    tw_dict = {}

    for k, en_val in en_flat.items():
        en_vars = extract_vars(en_val)
        existing_tw = tw_flat.get(k)
        
        # If existing zh-TW has valid translation and variables match
        if existing_tw and existing_tw.strip() != en_val.strip() and extract_vars(existing_tw) == en_vars:
            tw_dict[k] = existing_tw
        elif k in zh_flat:
            zh_val = zh_flat[k]
            # Convert from zh
            if zh_val.strip() in TECHNICAL_INVARIANTS:
                tw_dict[k] = zh_val
            else:
                tw_dict[k] = to_taiwan_tw(zh_val)
        else:
            tw_dict[k] = en_val

    return sync_and_write('zh-TW', tw_dict, VAR_FIXES)

if __name__ == '__main__':
    build()
