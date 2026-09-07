use serde_json::Value;
use std::collections::HashMap;

/// Tray text structure
#[derive(Debug, Clone)]
pub struct TrayTexts {
    pub current: String,
    pub quota: String,
    pub switch_next: String,
    pub refresh_current: String,
    pub show_window: String,
    pub quit: String,
    pub no_account: String,
    pub unknown_quota: String,
    pub forbidden: String,
}

/// Load translations from JSON
fn load_translations(lang: &str) -> HashMap<String, String> {
    // Map every language the frontend supports (see src/i18n.ts / navbar/constants.ts)
    // so the tray menu follows the in-app language switch. Unknown codes fall back to
    // English, matching the frontend's fallbackLng.
    let json_content = match lang {
        "zh" | "zh-CN" | "zh-Hans" => include_str!("../../../src/locales/zh.json"),
        "zh-TW" | "zh-Hant" => include_str!("../../../src/locales/zh-TW.json"),
        "ja" | "ja-JP" => include_str!("../../../src/locales/ja.json"),
        "tr" | "tr-TR" => include_str!("../../../src/locales/tr.json"),
        "vi" | "vi-VN" => include_str!("../../../src/locales/vi.json"),
        "pt" | "pt-BR" | "pt-PT" => include_str!("../../../src/locales/pt.json"),
        "ru" | "ru-RU" => include_str!("../../../src/locales/ru.json"),
        "ko" | "ko-KR" => include_str!("../../../src/locales/ko.json"),
        "ar" | "ar-SA" => include_str!("../../../src/locales/ar.json"),
        "es" | "es-ES" | "es-MX" => include_str!("../../../src/locales/es.json"),
        "my" | "ms" | "ms-MY" => include_str!("../../../src/locales/my.json"),
        "en" | "en-US" => include_str!("../../../src/locales/en.json"),
        _ => include_str!("../../../src/locales/en.json"),
    };

    let v: Value = serde_json::from_str(json_content).unwrap_or_else(|_| serde_json::json!({}));

    let mut map = HashMap::new();

    if let Some(tray) = v.get("tray").and_then(|t| t.as_object()) {
        for (key, value) in tray {
            if let Some(s) = value.as_str() {
                map.insert(key.clone(), s.to_string());
            }
        }
    }

    map
}

/// Get tray texts (based on language)
pub fn get_tray_texts(lang: &str) -> TrayTexts {
    let t = load_translations(lang);

    TrayTexts {
        current: t
            .get("current")
            .cloned()
            .unwrap_or_else(|| "Current".to_string()),
        quota: t
            .get("quota")
            .cloned()
            .unwrap_or_else(|| "Quota".to_string()),
        switch_next: t
            .get("switch_next")
            .cloned()
            .unwrap_or_else(|| "Switch to Next Account".to_string()),
        refresh_current: t
            .get("refresh_current")
            .cloned()
            .unwrap_or_else(|| "Refresh Current Quota".to_string()),
        show_window: t
            .get("show_window")
            .cloned()
            .unwrap_or_else(|| "Show Main Window".to_string()),
        quit: t
            .get("quit")
            .cloned()
            .unwrap_or_else(|| "Quit Application".to_string()),
        no_account: t
            .get("no_account")
            .cloned()
            .unwrap_or_else(|| "No Account".to_string()),
        unknown_quota: t
            .get("unknown_quota")
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string()),
        forbidden: t
            .get("forbidden")
            .cloned()
            .unwrap_or_else(|| "Account Forbidden".to_string()),
    }
}
