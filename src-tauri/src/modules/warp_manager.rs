use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const WARP_MSI_URL: &str = "https://1111-releases.cloudflareclient.com/windows/Cloudflare_WARP_Release-x64.msi";
const DEFAULT_WARP_PROXY_PORT: u16 = 40000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarpStatus {
    pub is_installed: bool,
    pub is_running: bool,
    pub is_port_listening: bool,
    pub is_connected: bool,
    pub mode: String,
    pub is_downloading: bool,
    pub download_progress: u8,
    pub error: Option<String>,
}

pub struct WarpManager {
    is_downloading: AtomicBool,
    download_progress: AtomicU8,
    last_error: RwLock<Option<String>>,
}

lazy_static::lazy_static! {
    pub static ref WARP_MANAGER: WarpManager = WarpManager {
        is_downloading: AtomicBool::new(false),
        download_progress: AtomicU8::new(0),
        last_error: RwLock::new(None),
    };
}

/// دریافت مسیر فایل‌های اجرایی رسمی Cloudflare WARP در ویندوز
pub fn get_warp_executable_paths() -> (Option<PathBuf>, Option<PathBuf>) {
    let mut exe_path = None;
    let mut cli_path = None;

    let candidate_dirs = [
        PathBuf::from(r"C:\Program Files\Cloudflare\Cloudflare WARP"),
        PathBuf::from(r"C:\Program Files (x86)\Cloudflare\Cloudflare WARP"),
    ];

    for dir in &candidate_dirs {
        let app = dir.join("Cloudflare WARP.exe");
        let cli = dir.join("warp-cli.exe");

        if app.exists() && exe_path.is_none() {
            exe_path = Some(app);
        }
        if cli.exists() && cli_path.is_none() {
            cli_path = Some(cli);
        }
    }

    (exe_path, cli_path)
}

impl WarpManager {
    /// استعلام وضعیت فعلی وارپ
    pub async fn get_status(&self) -> WarpStatus {
        let (_, cli_path_opt) = get_warp_executable_paths();
        let is_installed = cli_path_opt.is_some();

        // بررسی باز بودن پورت 40000
        let addr: std::net::SocketAddr = "127.0.0.1:40000".parse().unwrap();
        let is_port_listening = std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(80)).is_ok();

        // بررسی پروسه‌های وارپ
        let mut sys = sysinfo::System::new();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All);
        let is_running = sys.processes().values().any(|p| {
            let name = p.name().to_string_lossy().to_ascii_lowercase();
            name.contains("cloudflare warp") || name.contains("warp-svc")
        });

        let mut is_connected = false;
        let mut mode = "unknown".to_string();

        if let Some(ref cli_path) = cli_path_opt {
            #[cfg(target_os = "windows")]
            {
                let mut cmd = tokio::process::Command::new(cli_path);
                cmd.args(["--accept-tos", "status"]);
                cmd.creation_flags(CREATE_NO_WINDOW);

                if let Ok(output) = cmd.output().await {
                    let out_str = String::from_utf8_lossy(&output.stdout).to_lowercase();
                    if out_str.contains("connected") {
                        is_connected = true;
                    }
                    if out_str.contains("proxy") {
                        mode = "proxy".to_string();
                    } else if out_str.contains("warp") {
                        mode = "warp".to_string();
                    }
                }
            }
        }

        let err = self.last_error.read().await.clone();

        WarpStatus {
            is_installed,
            is_running,
            is_port_listening,
            is_connected,
            mode,
            is_downloading: self.is_downloading.load(Ordering::Relaxed),
            download_progress: self.download_progress.load(Ordering::Relaxed),
            error: err,
        }
    }

    /// دانلود و نصب بی‌صدا (Silent) وارپ در پس‌زمینه
    pub async fn download_and_install(&self) -> Result<String, String> {
        if self.is_downloading.load(Ordering::SeqCst) {
            return Err("WARP download is already in progress.".to_string());
        }

        self.is_downloading.store(true, Ordering::SeqCst);
        self.download_progress.store(0, Ordering::SeqCst);
        *self.last_error.write().await = None;

        let temp_dir = std::env::temp_dir();
        let msi_path = temp_dir.join("Cloudflare_WARP_Release-x64.msi");

        info!("[WarpManager] Starting download of Cloudflare WARP MSI to {:?}", msi_path);

        // دانلود با reqwest و ردیابی پیشرفت
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let res = match client.get(WARP_MSI_URL).send().await {
            Ok(r) => r,
            Err(e) => {
                self.is_downloading.store(false, Ordering::SeqCst);
                let err_msg = format!("Failed to connect to Cloudflare download server: {}", e);
                *self.last_error.write().await = Some(err_msg.clone());
                return Err(err_msg);
            }
        };

        if !res.status().is_success() {
            self.is_downloading.store(false, Ordering::SeqCst);
            let err_msg = format!("Download failed with HTTP {}", res.status());
            *self.last_error.write().await = Some(err_msg.clone());
            return Err(err_msg);
        }

        let total_size = res.content_length().unwrap_or(85_000_000);
        let mut downloaded: u64 = 0;
        let mut stream = res.bytes_stream();
        let mut file = tokio::fs::File::create(&msi_path)
            .await
            .map_err(|e| format!("Failed to create temporary file: {}", e))?;

        use futures::StreamExt;
        use tokio::io::AsyncWriteExt;

        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    self.is_downloading.store(false, Ordering::SeqCst);
                    let err_msg = format!("Download stream error: {}", e);
                    *self.last_error.write().await = Some(err_msg.clone());
                    return Err(err_msg);
                }
            };

            if let Err(e) = file.write_all(&chunk).await {
                self.is_downloading.store(false, Ordering::SeqCst);
                let err_msg = format!("Failed to write chunk to file: {}", e);
                *self.last_error.write().await = Some(err_msg.clone());
                return Err(err_msg);
            }

            downloaded += chunk.len() as u64;
            let progress = ((downloaded as f64 / total_size as f64) * 90.0) as u8;
            self.download_progress.store(progress.min(90), Ordering::Relaxed);
        }

        let _ = file.flush().await;
        self.download_progress.store(95, Ordering::Relaxed);
        info!("[WarpManager] Download complete. Executing silent MSI install...");

        // اجرای نصب سایلنت با msiexec
        #[cfg(target_os = "windows")]
        {
            let mut cmd = tokio::process::Command::new("msiexec");
            cmd.args(["/i", msi_path.to_str().unwrap(), "/qn", "/norestart"]);
            cmd.creation_flags(CREATE_NO_WINDOW);

            let install_res = cmd.status().await;
            self.is_downloading.store(false, Ordering::SeqCst);
            self.download_progress.store(100, Ordering::Relaxed);

            match install_res {
                Ok(status) => {
                    if status.success() {
                        info!("[WarpManager] Cloudflare WARP installed successfully.");
                        // حذف فایل موقت
                        let _ = tokio::fs::remove_file(&msi_path).await;
                        Ok("Cloudflare WARP was downloaded and installed successfully.".to_string())
                    } else {
                        let err_msg = format!("MSI installer finished with code: {:?}", status.code());
                        *self.last_error.write().await = Some(err_msg.clone());
                        Err(err_msg)
                    }
                }
                Err(e) => {
                    let err_msg = format!("Failed to launch MSI installer: {}", e);
                    *self.last_error.write().await = Some(err_msg.clone());
                    Err(err_msg)
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            self.is_downloading.store(false, Ordering::SeqCst);
            Err("Automatic WARP installation is currently supported on Windows.".to_string())
        }
    }

    /// راه‌اندازی و اتصال خودکار وارپ در حالت Proxy Mode و اتصال Antigravity
    pub async fn connect_proxy_mode(&self) -> Result<String, String> {
        let (exe_opt, cli_opt) = get_warp_executable_paths();
        let cli_path = cli_opt.ok_or_else(|| "Cloudflare WARP is not installed. Please click download first.".to_string())?;

        #[cfg(target_os = "windows")]
        {
            // ۱. اطمینان از ثبت نام / رجیستری رایگان وارپ
            let mut reg_cmd = tokio::process::Command::new(&cli_path);
            reg_cmd.args(["--accept-tos", "registration", "new"]);
            reg_cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = reg_cmd.output().await;

            // ۲. تغییر حالت به Proxy Mode (بدون نیاز به کارت شبکه TUN)
            let mut mode_cmd = tokio::process::Command::new(&cli_path);
            mode_cmd.args(["--accept-tos", "mode", "proxy"]);
            mode_cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = mode_cmd.output().await;

            // ۳. تنظیم پورت محلی 40000
            let mut port_cmd = tokio::process::Command::new(&cli_path);
            port_cmd.args(["--accept-tos", "proxy", "port", &DEFAULT_WARP_PROXY_PORT.to_string()]);
            port_cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = port_cmd.output().await;

            // ۴. برقراری اتصال وارپ
            let mut conn_cmd = tokio::process::Command::new(&cli_path);
            conn_cmd.args(["--accept-tos", "connect"]);
            conn_cmd.creation_flags(CREATE_NO_WINDOW);
            let _ = conn_cmd.output().await;

            // ۵. راه‌اندازی کلاینت گرافیکی در صورت متوقف بودن
            if let Some(ref exe_path) = exe_opt {
                let _ = crate::modules::network_pulse::launch_vpn_executable(&exe_path.to_string_lossy());
            }

            // انتظار کوتاه برای شنود پورت 40000
            let addr: std::net::SocketAddr = format!("127.0.0.1:{}", DEFAULT_WARP_PROXY_PORT).parse().unwrap();
            let mut listening = false;
            for _ in 0..12 {
                tokio::time::sleep(Duration::from_millis(300)).await;
                if std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(100)).is_ok() {
                    listening = true;
                    break;
                }
            }

            // ۶. اعمال پروکسی به محیط‌های Antigravity IDE
            let warp_url = format!("socks5://127.0.0.1:{}", DEFAULT_WARP_PROXY_PORT);
            let applied_count = crate::modules::antigravity_network_patcher::apply_proxy_to_settings(&warp_url)?;

            if listening {
                Ok(format!("WARP connected in Proxy Mode (Port {}). Applied to {} Antigravity instance(s).", DEFAULT_WARP_PROXY_PORT, applied_count))
            } else {
                Ok(format!("WARP connection command issued. Applied to {} Antigravity instance(s).", applied_count))
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err("WARP CLI proxy mode is supported on Windows.".to_string())
        }
    }

    /// قطع اتصال وارپ و بازگردانی تنظیمات پروکسی
    pub async fn disconnect_warp(&self) -> Result<String, String> {
        let (_, cli_opt) = get_warp_executable_paths();
        if let Some(cli_path) = cli_opt {
            #[cfg(target_os = "windows")]
            {
                let mut cmd = tokio::process::Command::new(&cli_path);
                cmd.args(["--accept-tos", "disconnect"]);
                cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = cmd.output().await;
            }
        }

        let cleared_count = crate::modules::antigravity_network_patcher::remove_proxy_from_settings()?;
        Ok(format!("WARP disconnected. Proxy settings cleared from {} Antigravity instance(s).", cleared_count))
    }
}
