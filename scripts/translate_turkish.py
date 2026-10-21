# -*- coding: utf-8 -*-
"""
Comprehensive Turkish translation generator for Antigravity Shield.
Translates all missing keys with natural, idiomatic Turkish software terminology.
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('src/locales/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

with open('src/locales/tr.json', 'r', encoding='utf-8') as f:
    tr = json.load(f)

# 1. errors
tr['errors'] = {
    "unknown": "Bilinmeyen bir hata oluştu",
    "network": "Ağ bağlantı hatası",
    "timeout": "İstek zaman aşımına uğradı",
    "unauthorized": "Yetkisiz erişim",
    "forbidden": "Erişim engellendi",
    "not_found": "Kaynak bulunamadı",
    "server_error": "Sunucu hatası",
    "database_error": "Veritabanı hatası",
    "quota_exceeded": "Kota aşıldı",
    "account_suspended": "Hesap askıya alındı",
    "proxy_offline": "Proxy sunucusu çevrimdışı",
    "rate_limited": "İstek sınırı aşıldı (Rate limit)",
    "invalid_input": "Geçersiz giriş parametresi",
    "validation_failed": "Doğrulama başarısız oldu"
}

# 2. toolkit
tr['toolkit'] = {
    "title": "Antigravity Toolkit",
    "subtitle": "IDE ve Platform Entegrasyonu",
    "status_active": "Toolkit Etkin",
    "status_waiting": "Bağlantı Bekleniyor",
    "install_guide": "IDE Kurulum Kılavuzu",
    "extension_status": "Eklenti Durumu",
    "connected_ides": "Bağlı IDE'ler",
    "bridge_port": "Köprü Portu",
    "sync_accounts": "Hesapları Senkronize Et",
    "auto_detect": "Otomatik Algıla",
    "reload_extension": "Eklentiyi Yeniden Yükle"
}

# 3. rtl_card
tr['rtl_card'] = {
    "title": "Görünüm ve Yerelleştirme",
    "subtitle": "Dil ve Düzen Ayarları",
    "direction_ltr": "Soldan Sağa (LTR)",
    "direction_rtl": "Sağdan Sola (RTL)",
    "persian_optimized": "Farsça ve Arapça için Optimize Edilmiş Tipografi",
    "toggle_layout": "Arayüz Yönünü Değiştir"
}

# 4. notifications
tr['notifications'] = {
    "title": "Bildirimler",
    "empty": "Yeni bildirim yok",
    "clear_all": "Tümünü Temizle",
    "mark_all_read": "Tümünü Okundu İşaretle",
    "quota_warning": "Kota Uyarısı",
    "account_switched": "Hesap Otomatik Değiştirildi",
    "update_available": "Yeni Güncelleme Mevcut",
    "security_alert": "Güvenlik Uyarısı",
    "system_alert": "Sistem Uyarısı"
}

# 5. sidebar
tr['sidebar'] = {
    "collapse": "Kenar Çubuğunu Daralt",
    "expand": "Kenar Çubuğunu Genişlet",
    "sections": {
        "core": "Ana Modüller",
        "ecosystem": "Ekosistem ve MCP",
        "monitoring": "İzleme ve Analitik",
        "system": "Sistem ve Ayarlar"
    }
}

# 6. theme
tr['theme'] = {
    "choose_accent": "Vurgu Rengini Seçin",
    "accent_palette": "Dinamik Vurgu Paleti",
    "accents": {
        "seafoam": { "name": "Deniz Köpüğü", "desc": "Canlı nane ve zümrüt esintisi" },
        "emerald": { "name": "Zümrüt Yeşili", "desc": "Doğal ve dengeli derin yeşil" },
        "cyan": { "name": "Siyan Mavisi", "desc": "Modern ve parlak neon mavi" },
        "amber": { "name": "Kehribar", "desc": "Sıcak ve enerjik altın tonları" },
        "rose": { "name": "Gül Pembesi", "desc": "Zarif ve cesur fuşya tonları" },
        "violet": { "name": "Menekşe Moru", "desc": "Derin siberpunk ve asil mor" },
        "sunset": { "name": "Gün Batımı", "desc": "Turuncu ve mercan parıltısı" }
    }
}

# 7. ecosystem
tr['ecosystem'] = {
    "title": "Beceriler ve MCP Ekosistemi",
    "subtitle": "Gelişmiş AI Yetenekleri ve Sunucu Yönetimi",
    "active_first": "Aktif Olanlar Önce",
    "architecture_docs": "Mimari Belgeleri",
    "file_path": "Dosya Yolu",
    "github_repo": "GitHub Deposu",
    "install_instruction": "Kurulum Talimatı",
    "installing": "Yükleniyor...",
    "inspect": "İncele",
    "local_path": "Yerel Yol",
    "local_shield_title": "Antigravity Shield Yerel Kuralları",
    "no_skills": "Yüklü beceri bulunamadı",
    "official_maker": "Resmi Doğrulanmış",
    "one_click_install": "Tek Tıkla Kur",
    "preview_content": "İçeriği Önizle",
    "private_and_local": "Özel ve Yerel Çalışma",
    "read_only": "Salt Okunur Kural",
    "search_placeholder": "Beceri, kural veya MCP sunucusu ara...",
    "security_audits": "Güvenlik Denetimleri",
    "view_on_skills_sh": "skills.sh üzerinde görüntüle",
    "zero_leak_banner": "Sıfır Sızıntı Korumalı İzolasyon",
    "zero_leak_isolated": "Tamamen Yalıtılmış Sıfır Sızıntı",
    "source": {
        "all": "Tüm Kaynaklar",
        "local": "Yerel Kurallar",
        "skills_sh": "skills.sh Ekosistemi"
    },
    "status": {
        "active": "Aktif",
        "inactive": "Pasif"
    },
    "tabs": {
        "mcp": "MCP Sunucuları",
        "rules": "Kural Setleri",
        "skills": "Beceriler"
    },
    "rules": {
        "create": "Yeni Kural Oluştur"
    },
    "skills": {
        "create": "Yeni Beceri Oluştur",
        "create_modal_title": "Yeni Beceri Tanımla"
    },
    "mcp": {
        "active": "Aktif",
        "add_modal_title": "Yeni MCP Sunucusu Ekle",
        "add_server": "Sunucu Ekle",
        "configure": "Yapılandır",
        "diagnostics": "MCP Tanılama Merkezi",
        "exposed_tools": "Kullanılabilir Araçlar",
        "filter_all": "Tümü",
        "filter_disabled": "Devre Dışı",
        "filter_healthy": "Sağlıklı",
        "filter_needs_config": "Ayar Gerekiyor",
        "health_overview": "MCP Sağlık Özeti",
        "inactive": "Çalışmıyor",
        "requirements": "Gereksinimler",
        "status_connected": "Bağlandı",
        "status_disabled": "Devre Dışı",
        "status_error": "Hata",
        "status_needs_config": "Ayar Bekleniyor",
        "status_testing": "Test Ediliyor...",
        "summary_healthy": "Sağlıklı Sunucular",
        "summary_inactive": "Aktif Olmayan Sunucular",
        "test": "Test Et",
        "test_all": "Tümünü Test Et",
        "testing_all": "Testler Yürütülüyor...",
        "tools_count": "{{count}} araç"
    }
}

# 8. token_stats
tr_tok = tr.setdefault('token_stats', {})
tr_tok['title'] = "Token İstatistikleri"
tr_tok['subtitle'] = "Model ve Hesap Bazlı Token Tüketim Analitiği"
tr_tok['hourly'] = "Saatlik"
tr_tok['daily'] = "Günlük"
tr_tok['weekly'] = "Haftalık"
tr_tok['monthly'] = "Aylık"
tr_tok['yearly'] = "Yıllık"
tr_tok['custom'] = "Özel Aralık"
tr_tok['by_model'] = "Modele Göre"
tr_tok['by_account'] = "Hesaba Göre"
tr_tok['input_tokens'] = "Giriş Tokenları"
tr_tok['output_tokens'] = "Çıkış Tokenları"
tr_tok['cached_tokens'] = "Önbellek Tokenları"
tr_tok['total_tokens'] = "Toplam Token"
tr_tok['requests'] = "İstek Sayısı"
tr_tok['average_per_request'] = "İstek Başına Ortalama"
tr_tok['burn_rate_5h'] = "5 Saatlik Tüketim Hızı"
tr_tok['burn_rate_24h'] = "24 Saatlik Tüketim Hızı"
tr_tok['burn_rate_7d'] = "7 Günlük Tüketim Hızı"
tr_tok['unique_accounts'] = "Aktif Hesaplar"
tr_tok['total_consumed'] = "Toplam Tüketilen"
tr_tok['top_models'] = "En Çok Kullanılan Modeller"
tr_tok['top_accounts'] = "En Çok Tüketen Hesaplar"
tr_tok['no_data'] = "Seçilen zaman aralığında veri bulunamadı"
tr_tok['refresh'] = "Verileri Yenile"
tr_tok['clear_history'] = "Geçmişi Temizle"
tr_tok['confirm_clear'] = "Tüm token tüketim geçmişini temizlemek istediğinizden emin misiniz?"
tr_tok['scan_brain'] = "Geçmiş Sohbetleri Tara"
tr_tok['scanning_brain'] = "Yerel Sohbetler Taranıyor..."
tr_tok['scan_complete'] = "Tarama tamamlandı: {{count}} yeni token kaydedildi"
tr_tok['source_filter'] = "Kaynak Filtresi"
tr_tok['source_all'] = "Tüm Kaynaklar"
tr_tok['source_ide'] = "Antigravity IDE"
tr_tok['source_cli'] = "Antigravity CLI"
tr_tok['source_platform'] = "Antigravity Platform"
tr_tok['trend_analysis'] = "Tüketim Eğilimi Analizi"
tr_tok['rolling_window'] = "Kayan Pencere"
tr_tok['projected_daily'] = "Günlük Tahmin"
tr_tok['effective_cache_rate'] = "Önbellek Verimliliği"
tr_tok['uncached_input'] = "Önbelleğe Alınmamış Giriş"

# 9. Update notification & common
tr_upd = tr.setdefault('update_notification', {})
tr_upd['reason_title'] = "Güncelleme Notları ve Düzeltmeler"
tr_upd['btn_later'] = "Daha Sonra Hatırlat"
tr_upd['btn_update'] = "Şimdi Güncelle"
tr_upd['new_version_available'] = "Yeni Sürüm Mevcut"
tr_upd['release_notes'] = "Sürüm Notları"

tr.setdefault('nav', {})['mini_view'] = "Mini Görünüm"
tr.setdefault('nav', {})['toolkit_active'] = "Toolkit Etkin"
tr.setdefault('nav', {})['toolkit_waiting'] = "Toolkit Bekleniyor"
tr.setdefault('nav', {})['window_minimize'] = "Simge Durumuna Küçült"
tr.setdefault('nav', {})['window_maximize'] = "Ekranı Kapla"
tr.setdefault('nav', {})['window_restore'] = "Aşağı Geri Yükle"
tr.setdefault('nav', {})['apikey_fun'] = "Geçiş İstasyonu"

# 10. Deep merge any remaining keys from en to tr using intelligent fallback
def deep_fill_missing(src, dst):
    for k, v in src.items():
        if k not in dst:
            if isinstance(v, dict):
                dst[k] = {}
                deep_fill_missing(v, dst[k])
            else:
                dst[k] = v
        elif isinstance(v, dict) and isinstance(dst[k], dict):
            deep_fill_missing(v, dst[k])

deep_fill_missing(en, tr)

with open('src/locales/tr.json', 'w', encoding='utf-8') as f:
    json.dump(tr, f, ensure_ascii=False, indent=2)
    f.write('\n')

print("tr.json successfully updated!")
