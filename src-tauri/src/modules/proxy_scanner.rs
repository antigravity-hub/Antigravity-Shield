use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::timeout;

/// اطلاعات یک پروکسی شناسایی‌شده یا تست‌شده
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredProxy {
    /// آدرس کامل پروکسی (مانند socks5://127.0.0.1:10808 یا http://127.0.0.1:10809)
    pub url: String,
    /// پروتکل (socks5 یا http)
    pub protocol: String,
    /// پورت محلی
    pub port: u16,
    /// نام حدس‌زده‌شده کلاینت (مانند V2Ray / Xray / Clash / Sing-box / Custom)
    pub client_hint: String,
    /// وضعیت در دسترس بودن پورت محلی
    pub is_listening: bool,
    /// وضعیت ارتباط اینترنت با گوگل از طریق این پروکسی
    pub is_working: bool,
    /// میزان تأخیر پینگ بر حسب میلی‌ثانیه (در صورت موفقیت)
    pub latency_ms: Option<u64>,
    /// پیام خطا در صورت عدم ارتباط
    pub error: Option<String>,
}

/// پورت‌های استاندارد و معروفی که فیلترشکن‌ها و کلاینت‌ها استفاده می‌کنند
const CANDIDATE_PORTS: &[(u16, &str, &str)] = &[
    (10808, "socks5", "V2Ray / Xray (SOCKS5)"),
    (10809, "http", "V2Ray / Xray (HTTP)"),
    (7890, "http", "Clash / Mihomo (Mixed HTTP/SOCKS)"),
    (7891, "socks5", "Clash / Mihomo (SOCKS5)"),
    (7897, "http", "Clash Verge (HTTP/SOCKS)"),
    (2080, "socks5", "Sing-box / Nekoray (SOCKS5)"),
    (2081, "http", "Sing-box / Nekoray (HTTP)"),
    (1080, "socks5", "Shadowsocks / Standard SOCKS5"),
    (1081, "http", "Standard HTTP Proxy"),
    (8888, "http", "Fiddler / HTTP Proxy"),
    (8080, "http", "General HTTP Proxy"),
];

/// اسکن پورت‌های لوکال و تست ارتباط فعال
pub async fn scan_local_proxies() -> Vec<DiscoveredProxy> {
    let mut results = Vec::new();
    let timeout_duration = Duration::from_millis(150);

    for &(port, protocol, hint) in CANDIDATE_PORTS {
        let addr: SocketAddr = match format!("127.0.0.1:{}", port).parse() {
            Ok(a) => a,
            Err(_) => continue,
        };

        // 1. بررسی سریع اینکه آیا پورتی در 127.0.0.1 باز و در حال شنود (Listening) است
        let is_listening = match timeout(timeout_duration, TcpStream::connect(&addr)).await {
            Ok(Ok(_stream)) => true,
            _ => false,
        };

        if is_listening {
            let proxy_url = if protocol == "socks5" {
                format!("socks5://127.0.0.1:{}", port)
            } else {
                format!("http://127.0.0.1:{}", port)
            };

            // 2. تست پروب اتصال و تأخیر به گوگل
            let probe = probe_proxy_url(&proxy_url).await;

            results.push(DiscoveredProxy {
                url: proxy_url,
                protocol: protocol.to_string(),
                port,
                client_hint: hint.to_string(),
                is_listening: true,
                is_working: probe.is_working,
                latency_ms: probe.latency_ms,
                error: probe.error,
            });
        }
    }

    // مرتب‌سازی نتایج: پروکسی‌های سالم و متصل اول، سپس بر اساس کمترین تأخیر (Latency)
    results.sort_by(|a, b| {
        match (a.is_working, b.is_working) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.latency_ms.unwrap_or(99999).cmp(&b.latency_ms.unwrap_or(99999)),
        }
    });

    results
}

pub struct ProbeResult {
    pub is_working: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

/// تست تأخیر و صحت اتصال یک URL پروکسی دلخواه
pub async fn probe_proxy_url(proxy_url: &str) -> ProbeResult {
    let test_url = "https://cloudcode-pa.googleapis.com";
    let start_time = std::time::Instant::now();

    // ایجاد یک rquest با پروکسی
    let proxy = match rquest::Proxy::all(proxy_url) {
        Ok(p) => p,
        Err(e) => {
            return ProbeResult {
                is_working: false,
                latency_ms: None,
                error: Some(format!("Invalid proxy format: {}", e)),
            };
        }
    };

    let client_builder = rquest::Client::builder()
        .proxy(proxy)
        .timeout(Duration::from_secs(5));

    let client = match client_builder.build() {
        Ok(c) => c,
        Err(e) => {
            return ProbeResult {
                is_working: false,
                latency_ms: None,
                error: Some(format!("Failed to build client: {}", e)),
            };
        }
    };

    match client.head(test_url).send().await {
        Ok(_resp) => {
            let latency = start_time.elapsed().as_millis() as u64;
            ProbeResult {
                is_working: true,
                latency_ms: Some(latency),
                error: None,
            }
        }
        Err(err) => {
            let fallback_start = std::time::Instant::now();
            match client.head("https://www.google.com").send().await {
                Ok(_) => {
                    let latency = fallback_start.elapsed().as_millis() as u64;
                    ProbeResult {
                        is_working: true,
                        latency_ms: Some(latency),
                        error: None,
                    }
                }
                Err(_) => ProbeResult {
                    is_working: false,
                    latency_ms: None,
                    error: Some(format!("{}", err)),
                },
            }
        }
    }
}
