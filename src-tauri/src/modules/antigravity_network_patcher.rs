use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// وضعیت اعمال تنظیمات پروکسی در Antigravity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntigravityProxyStatus {
    pub is_applied: bool,
    pub current_proxy: Option<String>,
    pub ide_settings_path: Option<String>,
    pub platform_settings_path: Option<String>,
    pub hook_dll_installed: bool,
}

/// دریافت مسیرهای فایل settings.json برای تمام گونه‌های Antigravity
pub fn get_antigravity_settings_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let base = PathBuf::from(appdata);
            // 1. Antigravity Platform (2.0)
            paths.push(base.join("Antigravity").join("User").join("settings.json"));
            // 2. Antigravity IDE
            paths.push(base.join("Antigravity IDE").join("User").join("settings.json"));
            // 3. Code (اگر روی نسخه پایه نصب باشد)
            paths.push(base.join("Code").join("User").join("settings.json"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let base = PathBuf::from(home).join("Library/Application Support");
            paths.push(base.join("Antigravity/User/settings.json"));
            paths.push(base.join("Antigravity IDE/User/settings.json"));
            paths.push(base.join("Code/User/settings.json"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let base = PathBuf::from(home).join(".config");
            paths.push(base.join("Antigravity/User/settings.json"));
            paths.push(base.join("Antigravity IDE/User/settings.json"));
            paths.push(base.join("Code/User/settings.json"));
        }
    }

    paths
}

/// بررسی وضعیت فعلی پروکسی در Antigravity
pub fn check_antigravity_proxy_status() -> AntigravityProxyStatus {
    let paths = get_antigravity_settings_paths();
    let mut is_applied = false;
    let mut current_proxy = None;
    let mut ide_path = None;
    let mut platform_path = None;

    for path in paths {
        let path_str = path.to_string_lossy().to_string();
        if path_str.contains("Antigravity IDE") {
            ide_path = Some(path_str);
        } else if path_str.contains("Antigravity") {
            platform_path = Some(path_str);
        }

        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(proxy_val) = val.get("http.proxy").and_then(|v| v.as_str()) {
                        if !proxy_val.trim().is_empty() {
                            is_applied = true;
                            current_proxy = Some(proxy_val.to_string());
                        }
                    }
                }
            }
        }
    }

    AntigravityProxyStatus {
        is_applied,
        current_proxy,
        ide_settings_path: ide_path,
        platform_settings_path: platform_path,
        hook_dll_installed: false,
    }
}

/// اعمال تنظیمات پروکسی در تمام settings.json های شناسایی‌شده
pub fn apply_proxy_to_settings(proxy_url: &str) -> Result<usize, String> {
    let paths = get_antigravity_settings_paths();
    let mut modified_count = 0;

    for path in paths {
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
        }

        let mut json_obj = if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => serde_json::from_str::<serde_json::Value>(&content)
                    .unwrap_or_else(|_| serde_json::json!({})),
                Err(_) => serde_json::json!({}),
            }
        } else {
            serde_json::json!({})
        };

        if let Some(map) = json_obj.as_object_mut() {
            map.insert("http.proxy".to_string(), serde_json::Value::String(proxy_url.to_string()));
            map.insert("http.proxySupport".to_string(), serde_json::Value::String("override".to_string()));
            map.insert("http.proxyStrictSSL".to_string(), serde_json::Value::Bool(false));

            if let Ok(serialized) = serde_json::to_string_pretty(&json_obj) {
                if fs::write(&path, serialized).is_ok() {
                    info!("[ProxyPatcher] Applied proxy {} to {:?}", proxy_url, path);
                    modified_count += 1;
                }
            }
        }
    }

    if modified_count > 0 {
        Ok(modified_count)
    } else {
        Err("No Antigravity settings.json could be updated.".to_string())
    }
}

/// پاکسازی و حذف پروکسی از تمام settings.json ها
pub fn remove_proxy_from_settings() -> Result<usize, String> {
    let paths = get_antigravity_settings_paths();
    let mut cleared_count = 0;

    for path in paths {
        if !path.exists() {
            continue;
        }

        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(mut json_obj) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(map) = json_obj.as_object_mut() {
                    let mut changed = false;
                    if map.remove("http.proxy").is_some() {
                        changed = true;
                    }
                    if map.remove("http.proxySupport").is_some() {
                        changed = true;
                    }
                    if map.remove("http.proxyStrictSSL").is_some() {
                        changed = true;
                    }

                    if changed {
                        if let Ok(serialized) = serde_json::to_string_pretty(&json_obj) {
                            if fs::write(&path, serialized).is_ok() {
                                info!("[ProxyPatcher] Cleared proxy from {:?}", path);
                                cleared_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(cleared_count)
}
