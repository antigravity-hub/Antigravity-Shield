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
    /// آیا مسیر ترافیک به صورت مستقیم و بدون نیاز به پروکسی لوکال (TUN Mode) برقرار است؟
    pub is_tun_active: bool,
    /// پروکسی‌های محلی باز و در حال گوش‌دادن (مانند 10808 یا 7890)
    pub discovered_proxies: Vec<crate::modules::proxy_scanner::DiscoveredProxy>,
    /// لیست فیلترشکن‌های شناخته‌شده روی سیستم کاربر (وضعیت اجرا و مسیر فایل)
    pub installed_vpns: Vec<InstalledVpnInfo>,
    /// کشور خروجی کاربر بر اساس تریس کلودفلر (مانند IR, TR, US, DE)
    pub egress_country: Option<String>,
    /// آیا کلودفلر وارپ فعال است؟
    pub is_warp_active: Option<bool>,
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
    pub is_port_listening: Option<bool>,
}

/// نتیجه تریس کلودفلر برای تشخیص لوکیشن و وضعیت وارپ
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CloudflareTrace {
    pub ip: Option<String>,
    pub loc: Option<String>,
    pub warp: bool,
}

pub fn parse_cloudflare_trace(body: &str) -> CloudflareTrace {
    let mut trace = CloudflareTrace::default();
    for line in body.lines() {
        if let Some((k, v)) = line.split_once('=') {
            let key = k.trim();
            let val = v.trim();
            match key {
                "ip" => trace.ip = Some(val.to_string()),
                "loc" => trace.loc = Some(val.to_ascii_uppercase()),
                "warp" => {
                    let lower = val.to_ascii_lowercase();
                    trace.warp = lower == "on" || lower == "plus";
                }
                _ => {}
            }
        }
    }
    trace
}

/// بررسی آیا کشور خروجی در لیست تحریم‌های مستقیم جمینای گوگل قرار دارد
pub fn is_sanctioned_gemini_country(loc: &str) -> bool {
    matches!(loc.to_ascii_uppercase().as_str(), "IR" | "CU" | "SY" | "KP" | "RU")
}

/// بررسی سریع باز بودن و شنود یک پورت TCP روی لوکال‌هاست (127.0.0.1)
pub fn is_local_port_listening(port: u16) -> bool {
    let addr: std::net::SocketAddr = match format!("127.0.0.1:{}", port).parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(60)).is_ok()
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
            let is_port_listening = default_port.map(is_local_port_listening);
            results.push(InstalledVpnInfo {
                id: id.to_string(),
                name: name.to_string(),
                process_name: process_name.to_string(),
                is_running,
                executable_path,
                default_port,
                is_port_listening,
            });
        }
    }

    results
}

/// اجرای مستقیم یک فیلترشکن توسط کاربر (با پشتیبانی از UAC Elevation در ویندوز)
pub fn launch_vpn_executable(exe_path: &str) -> Result<String, String> {
    let path = Path::new(exe_path);
    if !path.exists() {
        return Err(format!("Executable file not found at path: {}", exe_path));
    }

    let parent_dir = path.parent().unwrap_or(Path::new("."));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        let spawn_res = std::process::Command::new(path)
            .current_dir(parent_dir)
            .creation_flags(DETACHED_PROCESS)
            .spawn();

        match spawn_res {
            Ok(_) => Ok("Application launched successfully.".to_string()),
            Err(e) => {
                // اگر خطای ۷۴۰ (نیاز به دسترسی Administrator) رخ داد، درخواست دیالوگ UAC با RunAs
                if e.raw_os_error() == Some(740) {
                    let ps_cmd = format!(
                        "Start-Process -FilePath '{}' -WorkingDirectory '{}' -Verb RunAs",
                        path.display(),
                        parent_dir.display()
                    );
                    let fallback = std::process::Command::new("powershell")
                        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_cmd])
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();

                    match fallback {
                        Ok(_) => Ok("Administrator elevation prompt (UAC) requested. Please confirm in the Windows prompt.".to_string()),
                        Err(fe) => Err(format!("Failed to request administrator privileges: {}", fe)),
                    }
                } else {
                    Err(format!("Failed to launch application: {}", e))
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(path)
            .current_dir(parent_dir)
            .spawn()
            .map_err(|e| format!("Failed to launch application: {}", e))?;
        Ok("Application launched successfully.".to_string())
    }
}

struct ProbeOutput {
    internet_ok: bool,
    google_ok: bool,
    api_ok: bool,
    api_region_blocked: bool,
    latency_ms: Option<u64>,
    api_err: Option<String>,
    web_ok: bool,
    web_region_blocked: bool,
    web_err: Option<String>,
    cf_trace: Option<CloudflareTrace>,
}

async fn execute_probe(client: rquest::Client) -> ProbeOutput {
    // ۱. تست اینترنت عمومی با اتصال چندگانه و مقاوم (Microsoft NCSI + Cloudflare + Firefox)
    let internet_future = {
        let c = client.clone();
        async move {
            let cf = {
                let cl = c.clone();
                async move {
                    cl.get("https://cp.cloudflare.com/generate_204")
                        .send()
                        .await
                        .map(|r| r.status().is_success() || r.status().as_u16() == 204)
                        .unwrap_or(false)
                }
            };
            let ms = {
                let cl = c.clone();
                async move {
                    cl.get("http://www.msftconnecttest.com/connecttest.txt")
                        .send()
                        .await
                        .map(|r| r.status().is_success())
                        .unwrap_or(false)
                }
            };
            let ff = {
                let cl = c.clone();
                async move {
                    cl.get("http://detectportal.firefox.com/success.txt")
                        .send()
                        .await
                        .map(|r| r.status().is_success())
                        .unwrap_or(false)
                }
            };

            let (r_cf, r_ms, r_ff) = tokio::join!(cf, ms, ff);
            r_cf || r_ms || r_ff
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

    // ۳. تست تریس کلودفلر برای تشخیص کشور خروجی و وضعیت WARP
    let cf_trace_future = {
        let c = client.clone();
        async move {
            if let Ok(resp) = c.get("https://www.cloudflare.com/cdn-cgi/trace").send().await {
                if let Ok(text) = resp.text().await {
                    return Some(parse_cloudflare_trace(&text));
                }
            }
            None
        }
    };

    // ۴. تست لایه API هوش مصنوعی جمینای (CloudCode Endpoint) با متد واقعی loadCodeAssist
    let gemini_api_future = {
        let c = client.clone();
        async move {
            let start = std::time::Instant::now();
            let res = c.post("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
                .body("{}")
                .send()
                .await;
            let latency = start.elapsed().as_millis() as u64;

            match res {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    let text = resp.text().await.unwrap_or_default();

                    if status == 200 || status == 401 {
                        // ۴۰۱ یعنی سرویس پاسخ داده، احراز هویت خواسته و گیت‌وی مسدود یا تحریم نیست
                        (
                            true,
                            true,
                            false,
                            Some(latency),
                            None,
                        )
                    } else if status == 400 {
                        let is_region = text.contains("User location is not supported")
                            || text.contains("FAILED_PRECONDITION");
                        (
                            true,
                            !is_region,
                            is_region,
                            Some(latency),
                            if is_region {
                                Some("CloudCode API: User location is not supported (HTTP 400)".to_string())
                            } else {
                                Some(format!("CloudCode API HTTP 400: {}", text))
                            },
                        )
                    } else if status == 403 {
                        (
                            true,
                            false,
                            true,
                            Some(latency),
                            Some("CloudCode API: Forbidden / Region Blocked (HTTP 403)".to_string()),
                        )
                    } else {
                        (
                            true,
                            false,
                            false,
                            Some(latency),
                            Some(format!("CloudCode API unexpected HTTP {}: {}", status, text)),
                        )
                    }
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

    // ۵. تست لایه وب هوش مصنوعی جمینای (gemini.google.com)
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
                            Some("Gemini Web: Gemini isn't currently supported in your country".to_string())
                        } else {
                            None
                        },
                    )
                }
                Err(_) => (false, false, false, None),
            }
        }
    };

    let (internet_ok, google_ok, cf_trace, api_result, web_result) = tokio::join!(
        internet_future,
        google_future,
        cf_trace_future,
        gemini_api_future,
        gemini_web_future
    );

    let (_api_reachable, api_ok, api_region_blocked, latency_ms, api_err) = api_result;
    let (_web_reachable, web_ok, web_region_blocked, web_err) = web_result;

    ProbeOutput {
        internet_ok,
        google_ok,
        api_ok,
        api_region_blocked,
        latency_ms,
        api_err,
        web_ok,
        web_region_blocked,
        web_err,
        cf_trace,
    }
}

/// پروب پیشرفته سلامت شبکه، فیلترینگ و تحریم ریجن هوش مصنوعی جمینای
pub async fn probe_network_health(custom_proxy: Option<String>) -> NetworkPulseResult {
    let proxy_url_opt = custom_proxy.or_else(|| {
        crate::modules::config::load_app_config()
            .ok()
            .filter(|c| {
                c.proxy.upstream_proxy.enabled && !c.proxy.upstream_proxy.url.trim().is_empty()
            })
            .map(|c| c.proxy.upstream_proxy.url)
    });

    let timeout_duration = Duration::from_secs(6);

    // ۱. کلاینت مستقیم برای تست وضعیت TUN
    let direct_client = rquest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .unwrap_or_else(|_| rquest::Client::new());

    let mut is_tun_active = false;
    let probe_res;

    if let Some(ref p_url) = proxy_url_opt {
        let mut builder = rquest::Client::builder().timeout(timeout_duration);
        if let Ok(proxy) = rquest::Proxy::all(p_url) {
            builder = builder.proxy(proxy);
        }
        let proxy_client = builder.build().unwrap_or_else(|_| rquest::Client::new());

        let initial_probe = execute_probe(proxy_client).await;

        // اگر با پروکسی گوگل در دسترس نبود، اتصال مستقیم (TUN) را بررسی می‌کنیم
        if !initial_probe.google_ok {
            let direct_probe = execute_probe(direct_client).await;
            if direct_probe.google_ok {
                probe_res = direct_probe;
            } else {
                probe_res = initial_probe;
            }
        } else {
            probe_res = initial_probe;
        }
    } else {
        probe_res = execute_probe(direct_client).await;
    }

    // اگر از طریق Cloudflare trace یا API یا وب مشخص شود که کشور کاربر تحریم است
    let is_sanctioned_country = probe_res.cf_trace.as_ref()
        .and_then(|t| t.loc.as_deref())
        .map_or(false, is_sanctioned_gemini_country);
    let is_warp = probe_res.cf_trace.as_ref().map_or(false, |t| t.warp);

    let is_region_blocked = (is_sanctioned_country && !is_warp)
        || probe_res.api_region_blocked
        || probe_res.web_region_blocked;

    let region_error_message = if is_region_blocked {
        if is_sanctioned_country && !is_warp {
            Some(format!(
                "Google Gemini: Egress country ({}) is restricted. Connect with Cloudflare WARP or proxy.",
                probe_res.cf_trace.as_ref().and_then(|t| t.loc.clone()).unwrap_or_else(|| "IR".to_string())
            ))
        } else {
            probe_res.api_err.or(probe_res.web_err).or(Some(
                "Google Gemini: Region/Country not supported.".to_string(),
            ))
        }
    } else {
        None
    };

    // تشخیص وضعیت کلی
    let overall_status = if !probe_res.internet_ok && !probe_res.google_ok {
        "offline".to_string()
    } else if is_region_blocked {
        "region_blocked".to_string()
    } else if !probe_res.google_ok || !probe_res.api_ok {
        "filtered".to_string()
    } else if probe_res.api_ok {
        "healthy".to_string()
    } else {
        "filtered".to_string()
    };

    // اگر پروکسی ست شده باشد، is_tun_active هرگز true نمی‌شود تا تناقض ایجاد نشود
    if proxy_url_opt.is_some() {
        is_tun_active = false;
    } else if overall_status == "healthy" {
        is_tun_active = true;
    } else {
        is_tun_active = false;
    }

    let egress_country = probe_res.cf_trace.as_ref().and_then(|t| t.loc.clone());
    let is_warp_active = probe_res.cf_trace.as_ref().map(|t| t.warp);

    // اسکن پورت‌های لوکال در پس‌زمینه برای پیشنهاد دکمه
    let discovered_proxies = crate::modules::proxy_scanner::scan_local_proxies().await;
    let installed_vpns = detect_installed_vpns();

    NetworkPulseResult {
        internet_ok: probe_res.internet_ok,
        google_ok: probe_res.google_ok,
        gemini_api_ok: probe_res.api_ok,
        gemini_web_ok: probe_res.web_ok,
        is_region_blocked,
        region_error_message,
        overall_status,
        latency_ms: probe_res.latency_ms,
        active_proxy_url: proxy_url_opt,
        is_tun_active,
        discovered_proxies,
        installed_vpns,
        egress_country,
        is_warp_active,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cloudflare_trace() {
        let sample = "fl=1275f1\nh=www.cloudflare.com\nip=45.74.158.167\nts=1789732310.000\nvisit_scheme=https\nuag=curl/8.21.0\ncolo=IST\nsliver=none\nhttp=http/1.1\nloc=IR\ntls=TLSv1.3\nsni=plaintext\nwarp=off\ngateway=off\nrbi=off\nkex=X25519\n";
        let trace = parse_cloudflare_trace(sample);
        assert_eq!(trace.loc.as_deref(), Some("IR"));
        assert_eq!(trace.ip.as_deref(), Some("45.74.158.167"));
        assert!(!trace.warp);
        assert!(is_sanctioned_gemini_country("IR"));
        assert!(is_sanctioned_gemini_country("ir"));
        assert!(!is_sanctioned_gemini_country("TR"));
        assert!(!is_sanctioned_gemini_country("US"));
    }

    #[test]
    fn test_parse_cloudflare_trace_warp_on() {
        let sample = "loc=DE\nwarp=on\n";
        let trace = parse_cloudflare_trace(sample);
        assert_eq!(trace.loc.as_deref(), Some("DE"));
        assert!(trace.warp);
    }

    #[test]
    fn test_parse_cloudflare_trace_warp_plus() {
        let sample = "loc=US\nwarp=plus\n";
        let trace = parse_cloudflare_trace(sample);
        assert_eq!(trace.loc.as_deref(), Some("US"));
        assert!(trace.warp);
    }
}
