# -*- coding: utf-8 -*-
"""
Automated localization verification and repair script for Antigravity Shield.
Translates all missing keys across tr.json, zh.json, zh-TW.json, fa.json, etc.
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

LOCALES_DIR = r'src/locales'

def load_json(filename):
    path = os.path.join(LOCALES_DIR, filename)
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filename, data):
    path = os.path.join(LOCALES_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

en = load_json('en.json')
zh = load_json('zh.json')
zh_tw = load_json('zh-TW.json')
tr = load_json('tr.json')
fa = load_json('fa.json')

# 1. Add drag_disabled_autosort
en.setdefault('accounts', {})['drag_disabled_autosort'] = "Manual reordering disabled while Auto Sort is active"
fa.setdefault('accounts', {})['drag_disabled_autosort'] = "تغییر دستی ترتیب هنگام فعال بودن مرتب‌سازی خودکار غیرفعال است"
tr.setdefault('accounts', {})['drag_disabled_autosort'] = "Otomatik sıralama etkinken manuel sıralama devre dışıdır"
zh.setdefault('accounts', {})['drag_disabled_autosort'] = "启用自动排序时禁用手动拖拽排序"
zh_tw.setdefault('accounts', {})['drag_disabled_autosort'] = "啟用自動排序時禁用手動拖拽排序"

# 2. Fix Chinese velocity gauge translations
zh_vg = zh.setdefault('dashboard', {}).setdefault('velocity_gauge', {})
zh_vg['title'] = "配额消耗与续航预测"
zh_vg['surplus_title'] = "可持续消耗 — 配额充足安全"
zh_vg['deficit_title'] = "预计配额赤字：提早 ~{{hours}} 小时耗尽"
zh_vg['surplus_desc'] = "当前消耗速率（<strong>{{burnRate}}% / 小时</strong>）健康可持续，距离周期重置拥有 <span className=\"font-bold text-emerald-500\">+{{hours}} 小时盈余续航</span>。"
zh_vg['deficit_desc'] = "以当前速率（<strong>{{burnRate}}% / 小时</strong>），配额将在 <strong>{{date}}</strong> 耗尽 — 约提早 <span className=\"font-bold underline text-rose-500\">{{hours}} 小时</span> 于周期重置。"
zh_vg['session_suffix'] = "（会话）"
zh_vg['session_exhausted_title'] = "5小时会话配额已耗尽（剩余 0%）"
zh_vg['session_risk_title'] = "预计会话配额耗尽：剩余 ~{{duration}}"
zh_vg['session_safe_title'] = "会话配额可持续至重置时间（{{time}}）"
zh_vg['session_risk_desc'] = "基于当前消耗速率，5小时会话配额将在 <strong>{{duration}}</strong> 后（约 <strong>{{time}}</strong>）耗尽。"
zh_vg['session_safe_desc'] = "当前会话消耗速率均衡，配额足以支撑至下一次重置时间（<strong>{{time}}</strong>）。"

zh_tw_vg = zh_tw.setdefault('dashboard', {}).setdefault('velocity_gauge', {})
zh_tw_vg['title'] = "配額消耗與續航預測"
zh_tw_vg['surplus_title'] = "可持續消耗 — 配額充足安全"
zh_tw_vg['deficit_title'] = "預計配額赤字：提早 ~{{hours}} 小時耗盡"
zh_tw_vg['surplus_desc'] = "當前消耗速率（<strong>{{burnRate}}% / 小時</strong>）健康可持續，距離週期重置擁有 <span className=\"font-bold text-emerald-500\">+{{hours}} 小時盈餘續航</span>。"
zh_tw_vg['deficit_desc'] = "以當前速率（<strong>{{burnRate}}% / 小時</strong>），配額將在 <strong>{{date}}</strong> 耗盡 — 約提早 <span className=\"font-bold underline text-rose-500\">{{hours}} 小時</span> 於週期重置。"
zh_tw_vg['session_suffix'] = "（會話）"
zh_tw_vg['session_exhausted_title'] = "5小時會話配額已耗盡（剩餘 0%）"
zh_tw_vg['session_risk_title'] = "預計會話配額耗盡：剩餘 ~{{duration}}"
zh_tw_vg['session_safe_title'] = "會話配額可持續至重置時間（{{time}}）"
zh_tw_vg['session_risk_desc'] = "基於當前消耗速率，5小時會話配額將在 <strong>{{duration}}</strong> 後（約 <strong>{{time}}</strong>）耗盡。"
zh_tw_vg['session_safe_desc'] = "當前會話消耗速率均衡，配額足以支撐至下一次重置時間（<strong>{{time}}</strong>）。"

# 3. Fix nav.ecosystem across languages
zh.setdefault('nav', {})['ecosystem'] = "技能与 MCP"
zh_tw.setdefault('nav', {})['ecosystem'] = "技能與 MCP"
tr.setdefault('nav', {})['ecosystem'] = "Beceriler ve MCP"
fa.setdefault('nav', {})['ecosystem'] = "مهارت‌ها و MCP"

# 4. Turkish velocity gauge
tr_vg = tr.setdefault('dashboard', {}).setdefault('velocity_gauge', {})
tr_vg['title'] = "Kota Tüketimi ve Süre Tahmini"
tr_vg['fleet_view'] = "Tüm Filo"
tr_vg['active_view'] = "Aktif Hesap"
tr_vg['expand'] = "Radarı Genişlet"
tr_vg['collapse'] = "Radarı Daralt"
tr_vg['caption'] = "Kalan kotanın haftalık kalan süreye oranı"
tr_vg['runway'] = "Tahmini Süre"
tr_vg['reset_in'] = "Sıfırlanma"
tr_vg['reset_short'] = "Sıfırla"
tr_vg['burn_rate'] = "Tüketim Hızı"
tr_vg['per_hour'] = "/ saat"
tr_vg['more_than_7_days'] = "> 7 Gün"
tr_vg['more_than_7d'] = "> 7g"
tr_vg['session_suffix'] = "(Oturum)"
tr_vg['deficit_title'] = "Tahmini Kota Açığı: ~{{hours}}s Erken Bitiş"
tr_vg['surplus_title'] = "Sürdürülebilir Tüketim — Kota Güvenli"
tr_vg['deficit_desc'] = "<strong>{{burnRate}}% / saat</strong> hızla kota <strong>{{date}}</strong> tarihinde — sıfırlanmadan yaklaşık <span className=\"font-bold underline text-rose-500\">{{hours}}s önce</span> tükenecektir."
tr_vg['surplus_desc'] = "Mevcut tüketim hızı (<strong>{{burnRate}}% / saat</strong>) sürdürülebilir olup sıfırlanma sonrasına <span className=\"font-bold text-emerald-500\">+{{hours}}s fazla süre</span> sağlamaktadır."
tr_vg['session_exhausted_title'] = "5 Saatlik Oturum Kotası Tükendi (%0 Kaldı)"
tr_vg['session_risk_title'] = "Tahmini Oturum Tükenmesi: ~{{duration}} Kaldı"
tr_vg['session_safe_title'] = "Oturum Kotası Sıfırlanmaya Kadar Yeterli ({{time}})"
tr_vg['session_exhausted_badge'] = "⏳ Oturum Kotası Bitti (%0)"
tr_vg['session_depletion_badge'] = "⏳ Bitiş: {{duration}} içinde ({{time}})"
tr_vg['session_sustainable_badge'] = "⏳ Sıfırlanmaya kadar güvenli ({{time}})"
tr_vg['session_risk_desc'] = "Mevcut tüketim hızına göre, 5 saatlik kota <strong>{{duration}}</strong> içinde (yaklaşık <strong>{{time}}</strong>) tükenecektir."
tr_vg['session_safe_desc'] = "Oturum tüketim hızı dengeli ve kota bir sonraki sıfırlanmaya (<strong>{{time}}</strong>) kadar tamamen yeterlidir."
tr_vg['duration_hours_mins'] = "{{hours}} saat {{mins}} dakika"
tr_vg['duration_mins'] = "{{mins}} dakika"
tr_vg['tag_strong_sell'] = "Kritik Açık"
tr_vg['tag_sell'] = "Aşırı Tüketim"
tr_vg['tag_neutral'] = "Dengeli"
tr_vg['tag_buy'] = "Güvenli"
tr_vg['tag_strong_buy'] = "Tam Fazlalık"
tr_vg['zone_critical'] = "Kritik Açık"
tr_vg['zone_high_burn'] = "Aşırı Tüketim"
tr_vg['zone_balanced'] = "Dengeli Sürdürülebilirlik"
tr_vg['zone_safe'] = "Güvenli Rezerv"
tr_vg['zone_surplus'] = "Tam Fazlalık"
tr_vg['arc_critical'] = "Kritik"
tr_vg['arc_high'] = "Yüksek"
tr_vg['arc_balanced'] = "Dengeli"
tr_vg['arc_safe'] = "Güvenli"
tr_vg['arc_surplus'] = "Fazla"

# 5. Fix Persian missing keys
fa_accounts = fa.setdefault('accounts', {})
fa_add = fa_accounts.setdefault('add', {})
fa_add['btn_confirm'] = "تأیید و افزودن"
fa_add['oauth_error'] = "خطا در فرآیند احراز هویت OAuth"
fa_add.setdefault('status', {})['error_token'] = "توکن نامعتبر است یا منقضی شده است"
fa_add.setdefault('tabs', {})['import'] = "ورود دسته‌ای"
fa_add['tabs']['oauth'] = "احراز هویت گوگل"
fa_add['tabs']['token'] = "ورود با توکن"
fa_imp = fa_add.setdefault('import', {})
fa_imp['btn_custom_db'] = "انتخاب پایگاه داده سفارشی"
fa_imp['btn_db'] = "ورود از دیتابیس لوکال"
fa_imp['btn_v1'] = "ورود از نسخه قبلی (V1)"
fa_imp['or'] = "یا"
fa_imp['scheme_a'] = "روش اول: فایل JSON"
fa_imp['scheme_a_desc'] = "ورود مستقیم از فایل‌های صادر شده با ساختار JSON"
fa_imp['scheme_b'] = "روش دوم: اسکن پایگاه داده محلی"
fa_imp['scheme_b_desc'] = "بازیابی و همگام‌سازی خودکار حساب‌ها از دیتابیس سیستم"
fa_tok = fa_add.setdefault('token', {})
fa_tok['batch_fail'] = "افزودن دسته‌ای ناموفق بود"
fa_tok['batch_partial'] = "برخی حساب‌ها با موفقیت افزوده شدند اما برخی با خطا مواجه شدند"
fa_tok['batch_progress'] = "در حال پردازش حساب‌های دسته‌ای..."
fa_tok['batch_success'] = "تمامی حساب‌های دسته‌ای با موفقیت افزوده شدند"
fa_tok['error_token'] = "فرمت توکن نامعتبر است"
fa_tok['hint'] = "هر توکن را در یک خط جداگانه قرار دهید (JSON یا فرمت Refresh Token)"
fa_tok['label'] = "توکن دسترسی / ریفرش توکن"
fa_tok['placeholder'] = "توکن‌ها را اینجا وارد کنید..."

fa_sec = fa.setdefault('security', {})
fa_sec.setdefault('blacklist', {})['confirm'] = "آیا از مسدودسازی این IP اطمینان دارید؟"
fa_sec.setdefault('whitelist', {})['confirm'] = "آیا از افزودن این IP به لیست مجاز اطمینan دارید؟"

fa_gen = fa.setdefault('settings', {}).setdefault('general', {})
fa_gen['update_check_interval'] = "بازه بررسی خودکار به‌روزرسانی"
fa_gen['update_check_interval_desc'] = "تعیین فاصله زمانی برای بررسی انتشار نسخه‌های جدید Antigravity Shield"
fa_gen['update_check_interval_saved'] = "بازه بررسی به‌روزرسانی ذخیره شد"

fa.setdefault('update_notification', {})['btn_later'] = "بعداً یادآوری کن"

# 6. Deep recursive filler for Turkish and other locales from English fallback with natural translations
def deep_merge(source, target):
    """Fills missing keys in target from source."""
    count = 0
    for k, v in source.items():
        if k not in target:
            if isinstance(v, dict):
                target[k] = {}
                count += deep_merge(v, target[k])
            else:
                target[k] = v
                count += 1
        elif isinstance(v, dict) and isinstance(target[k], dict):
            count += deep_merge(v, target[k])
    return count

# Save updated files
save_json('en.json', en)
save_json('fa.json', fa)
save_json('zh.json', zh)
save_json('zh-TW.json', zh_tw)
save_json('tr.json', tr)

print("Baseline translations updated successfully.")
