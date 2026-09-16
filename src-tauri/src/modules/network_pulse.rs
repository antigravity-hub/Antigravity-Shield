use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use sysinfo::System;
use tracing::{info, warn};

/// وضعیت نهایی بررسی شبکه و هوش مصنوعی جمینای
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPulseResult {
    /// اتصال اینترنت پایه (تست پینگ/204 کلودفلر)
    pub internet_ok: bool,
    /// امکان دسترسی به سرورهای گوگل (عدم فیلترینگ عمومی)
    pub google_ok: bool,
    /// امکان ارتباط با هسته هوش مصنوعی گوگل و CloudCode API (موتور Antigravity)
    pub gemini_api_ok: bool,
    /// امکان دسترسی به رابط وب جمینای (gemini.google.com)
    pub gemini_web_ok: bool,
    /// آیا ارور تحریم کشور و ریجن گوگل وجود دارد؟ (HTTP 400 یا پیام not supported)
    pub is_region_blocked: bool,
    /// شرح متن خطای ریجن (در صورت وجود)
    pub region_error_message: Option<String>,
    /// وضعیت تجمیعی: "healthy" | "region_blocked" | "filtered" | "offline"
    pub overall_status: String,
    /// میزان تأخیر پینگ بر حسب میلی‌ثانیه (به سرورهای جمینای)
    pub latency_ms: Option<u64>,
    /// آدرس پروکسی فعال روی سیستم یا ورودی کاربر
    pub active_proxy_url: Option<String>,
    /// پروکسی‌های محلی باز و در حال گوش‌دادن (مانند 10808 یا 7890)
    pub discovered_proxies: Vec<crate::modules::proxy_scanner::DiscoveredProxy>,
    /// لیست فیلترشکن‌های شناخته‌شده روی سیستم کاربر (وضعیت اجرا و مسیر فایل)
    pub installed_vpns: Vec<InstalledVpnInfo>,
}

/// اطلاعات کلاینت VPN یا فیلترشکن شناخته‌شده در ویندوز
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledVpnInfo {
    pub id: String,
    pub name: String,
    pub process_name: String,
    pub is_running: bool,
    pub executable_path: Option<String>,
    pub default_port: Option<u16>,
}

const KNOWN_VPNS: &[(&str, &str, &str, Option<u16>, &[&str])] = &[
    (
        "v2rayn",
        "v2rayN",
        "v2rayN.exe",
        Some(10808),
        &["v2rayN", "v2rayN-Core", "v2rayN-With-Core"],
    ),
    (
        "clash-verge",
        "Clash Verge",
        "clash-verge.exe",
        Some(7897),
        &["clash-verge", "Clash Verge", "Clash Verge Rev"],
    ),
    (
        "clash-nyanpasu",
        "Clash Nyanpasu",
        "clash-nyanpasu.exe",
        Some(7890),
        &["Clash Nyanpasu", "clash-nyanpasu"],
    ),
    (
        "nekoray",
        "NekoRay",
        "nekoray.exe",
        Some(2080),
        &["nekoray", "NekoBox"],
    ),
    (
        "sing-box",
        "Sing-Box",
        "sing-box.exe",
        Some(2080),
        &["sing-box", "sing-box-windows"],
    ),
    (
        "hiddify",
        "Hiddify Next",
        "Hiddify.exe",
        Some(2080),
        &["Hiddify", "HiddifyNext"],
    ),
    (
        "warp",
        "Cloudflare WARP",
        "Cloudflare WARP.exe",
        Some(40000),
        &["Cloudflare\\Cloudflare WARP", "Cloudflare WARP"],
    ),
];

/// شناسایی فیلترشکن‌های در حال اجرا یا نصب‌شده روی ویندوز
pub fn detect_installed_vpns() -> Vec<InstalledVpnInfo> {
    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All);

    let mut results = Vec::new();

    // استخراج نام تمام پروسه‌های در حال اجرا
    let running_processes: Vec<(String, Option<PathBuf>)> = sys
        .processes()
        .values()
        .map(|p| {
            let name = p.name().to_string_lossy().to_string();
            let exe_path = p.exe().map(|path| path.to_path_buf());
            (name, exe_path)
        })
        .collect();

    // مسیرهای مرسوم نصب در ویندوز
    let mut search_dirs: Vec<PathBuf> = Vec::new();
    if let Some(appdata) = dirs::data_dir() {
        search_dirs.push(appdata);
    }
    if let Some(local_appdata) = dirs::data_local_dir() {
        search_dirs.push(local_appdata.clone());
        search_dirs.push(local_appdata.join("Programs"));
    }
    if let Some(desktop) = dirs::desktop_dir() {
        search_dirs.push(desktop);
    }
    search_dirs.push(PathBuf::from(r"C:\Program Files"));
    search_dirs.push(PathBuf::from(r"C:\Program Files (x86)"));

    for &(id, name, process_name, default_port, folder_hints) in KNOWN_VPNS {
        // ۱. بررسی اجرای پروسه
        let running_proc = running_processes
            .iter()
            .find(|(p_name, _)| p_name.eq_ignore_ascii_case(process_name));

        let is_running = running_proc.is_some();
        let mut executable_path = running_proc
            .and_then(|(_, path)| path.as_ref().map(|p| p.to_string_lossy().to_string()));

        // ۲. اگر در حال اجرا نبود، جستجو در مسیرهای استاندارد
        if executable_path.is_none() {
            for base_dir in &search_dirs {
                for hint in folder_hints {
                    let candidate = base_dir.join(hint).join(process_name);
                    if candidate.exists() && candidate.is_file() {
                        executable_path = Some(candidate.to_string_lossy().to_string());
                        break;
                    }
                }
                if executable_path.is_some() {
                    break;
                }
            }
        }

        // فقط در صورتی اضافه شود که در حال اجرا باشد یا فایل اجرایی آن پیدا شود
        if is_running || executable_path.is_some() {
            results.push(InstalledVpnInfo {
                id: id.to_string(),
                name: name.to_string(),
                process_name: process_name.to_string(),
                is_running,
                executable_path,
                default_port,
            });
        }
    }

    results
}

/// اجرای مستقیم یک فیلترشکن توسط کاربر
pub fn launch_vpn_executable(exe_path: &str) -> Result<String, String> {
    let path = Path::new(exe_path);
    if !path.exists() {
        return Err(format!("فایل اجرایی در مسیر یافت نشد: {}", exe_path));
    }

    let parent_dir = path.parent().unwrap_or(Path::new("."));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        std::process::Command::new(path)
            .current_dir(parent_dir)
            .creation_flags(DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("خطا در اجرای برنامه: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(path)
            .current_dir(parent_dir)
            .spawn()
            .map_err(|e| format!("خطا در اجرای برنامه: {}", e))?;
    }

    Ok("نرم‌افزار با موفقیت اجرا شد.".to_string())
}

/// پروب پیشرفته سلامت شبکه، فیلترینگ و تحریم ریجن هوش مصنوعی جمینای
pub async fn probe_network_health(custom_proxy: Option<String>) -> NetworkPulseResult {
    let proxy_url_opt = custom_proxy.or_else(|| {
        // اگر کاربر پروکسی نداده، بررسی تنظیمات شیلد
        crate::modules::config::load_app_config()
            .ok()
            .filter(|c| {
                c.proxy.upstream_proxy.enabled && !c.proxy.upstream_proxy.url.trim().is_empty()
            })
            .map(|c| c.proxy.upstream_proxy.url)
    });

    let timeout_duration = Duration::from_secs(4);

    // ساخت کلاینت HTTP با یا بدون پروکسی
    let client = {
        let mut builder = rquest::Client::builder().timeout(timeout_duration);
        if let Some(ref p_url) = proxy_url_opt {
            if let Ok(proxy) = rquest::Proxy::all(p_url) {
                builder = builder.proxy(proxy);
            }
        }
        builder.build().unwrap_or_else(|_| rquest::Client::new())
    };

    // ۱. تست اینترنت عمومی با اتصال فوق‌سریع 204
    let internet_future = {
        let c = client.clone();
        async move {
            c.get("https://cp.cloudflare.com/generate_204")
                .send()
                .await
                .map(|r| r.status().is_success() || r.status().as_u16() == 204)
                .unwrap_or(false)
        }
    };

    // ۲. تست فیلترینگ گوگل (Google Reachability)
    let google_future = {
        let c = client.clone();
        async move {
            c.head("https://www.google.com/generate_204")
                .send()
                .await
                .map(|r| r.status().is_success() || r.status().as_u16() == 204)
                .unwrap_or(false)
        }
    };

    // ۳. تست لایه API هوش مصنوعی جمینای (CloudCode Endpoint)
    let gemini_api_future = {
        let c = client.clone();
        async move {
            let start = std::time::Instant::now();
            let res = c.get("https://cloudcode-pa.googleapis.com").send().await;
            let latency = start.elapsed().as_millis() as u64;

            match res {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    let text = resp.text().await.unwrap_or_default();

                    // اگر استاتوس 400 باشد و شامل ارور لوکیشن باشد
                    let is_region = status == 400
                        && (text.contains("User location is not supported")
                            || text.contains("FAILED_PRECONDITION"));

                    (
                        true,
                        !is_region,
                        is_region,
                        Some(latency),
                        if is_region {
                            Some(
                                "CloudCode API: User location is not supported (HTTP 400)"
                                    .to_string(),
                            )
                        } else {
                            None
                        },
                    )
                }
                Err(err) => (
                    false,
                    false,
                    false,
                    None,
                    Some(format!("API Connection Error: {}", err)),
                ),
            }
        }
    };

    // ۴. تست لایه وب هوش مصنوعی جمینای (gemini.google.com)
    let gemini_web_future = {
        let c = client.clone();
        async move {
            let res = c.get("https://gemini.google.com")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                .header("Accept-Language", "en-US,en;q=0.9")
                .send()
                .await;

            match res {
                Ok(resp) => {
                    let text = resp.text().await.unwrap_or_default();
                    let lower = text.to_lowercase();
                    let is_region = lower.contains("isn't currently supported in your country")
                        || lower.contains("not supported in your country")
                        || lower.contains("supported in your country");

                    (
                        true,
                        !is_region,
                        is_region,
                        if is_region {
                            Some(
                                "Gemini Web: Gemini isn't currently supported in your country"
                                    .to_string(),
                            )
                        } else {
                            None
                        },
                    )
                }
                Err(_) => (false, false, false, None),
            }
        }
    };

    // اجرای موازی هر ۴ تست
    let (internet_ok, google_ok, api_result, web_result) = tokio::join!(
        internet_future,
        google_future,
        gemini_api_future,
        gemini_web_future
    );

    let (_api_reachable, api_ok, api_region_blocked, latency_ms, api_err) = api_result;
    let (_web_reachable, web_ok, web_region_blocked, web_err) = web_result;

    // تشخیص قطعی تحریم ریجن
    let is_region_blocked = api_region_blocked || web_region_blocked;
    let region_error_message = if is_region_blocked {
        api_err.or(web_err).or(Some(
            "Google Gemini: Region/Country not supported.".to_string(),
        ))
    } else {
        None
    };

    // تشخیص وضعیت کلی
    let overall_status = if !internet_ok && !google_ok {
        "offline".to_string()
    } else if !google_ok {
        "filtered".to_string()
    } else if is_region_blocked {
        "region_blocked".to_string()
    } else if api_ok || web_ok {
        "healthy".to_string()
    } else {
        "filtered".to_string()
    };

    // اسکن پورت‌های لوکال در پس‌زمینه برای پیشنهاد دکمه
    let discovered_proxies = crate::modules::proxy_scanner::scan_local_proxies().await;
    let installed_vpns = detect_installed_vpns();

    NetworkPulseResult {
        internet_ok,
        google_ok,
        gemini_api_ok: api_ok,
        gemini_web_ok: web_ok,
        is_region_blocked,
        region_error_message,
        overall_status,
        latency_ms,
        active_proxy_url: proxy_url_opt,
        discovered_proxies,
        installed_vpns,
    }
}
