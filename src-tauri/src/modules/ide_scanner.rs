use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

// ============================================================================
// Heartbeat & Connection Tracking
// ============================================================================

static LAST_HEARTBEAT: LazyLock<RwLock<Option<Instant>>> = LazyLock::new(|| RwLock::new(None));
static ACTIVE_IDE_NAME: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));
static ACTIVE_EXT_VERSION: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));
static ACTIVE_EMAIL: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolkitHeartbeatPayload {
    pub ide: String,
    pub version: Option<String>,
    pub active_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolkitConnectionStatus {
    pub is_connected: bool,
    pub active_ide: Option<String>,
    pub extension_version: Option<String>,
    pub active_email: Option<String>,
    pub seconds_since_last_ping: Option<u64>,
    pub any_ide_installed: bool,
}

pub fn record_heartbeat(payload: ToolkitHeartbeatPayload) {
    if let Ok(mut lock) = LAST_HEARTBEAT.write() {
        *lock = Some(Instant::now());
    }
    if let Ok(mut lock) = ACTIVE_IDE_NAME.write() {
        *lock = Some(payload.ide);
    }
    if let Ok(mut lock) = ACTIVE_EXT_VERSION.write() {
        *lock = payload.version;
    }
    if let Ok(mut lock) = ACTIVE_EMAIL.write() {
        *lock = payload.active_email;
    }
}

pub fn get_connection_status() -> ToolkitConnectionStatus {
    let last = LAST_HEARTBEAT.read().ok().and_then(|guard| *guard);
    let ide = ACTIVE_IDE_NAME.read().ok().and_then(|guard| guard.clone());
    let version = ACTIVE_EXT_VERSION.read().ok().and_then(|guard| guard.clone());
    let email = ACTIVE_EMAIL.read().ok().and_then(|guard| guard.clone());

    let any_ide_installed = check_extension_installed(&[
        "Antigravity IDE", "Antigravity", ".antigravity", ".antigravity-ide", ".vscode"
    ]);

    match last {
        Some(instant) => {
            let elapsed = instant.elapsed().as_secs();
            // Connected if ping received in the last 45 seconds
            let is_connected = elapsed <= 45;
            ToolkitConnectionStatus {
                is_connected,
                active_ide: if is_connected { ide } else { None },
                extension_version: if is_connected { version } else { None },
                active_email: if is_connected { email } else { None },
                seconds_since_last_ping: Some(elapsed),
                any_ide_installed,
            }
        }
        None => ToolkitConnectionStatus {
            is_connected: false,
            active_ide: None,
            extension_version: None,
            active_email: None,
            seconds_since_last_ping: None,
            any_ide_installed,
        },
    }
}

pub fn is_toolkit_connected() -> bool {
    let last = LAST_HEARTBEAT.read().ok().and_then(|guard| *guard);
    match last {
        Some(instant) => instant.elapsed().as_secs() <= 45,
        None => false,
    }
}

// ============================================================================
// Bidirectional Full-Duplex Command Queue (Shield -> IDE)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolkitCommand {
    pub id: String,
    pub action: String, // "switch_account"
    pub account_id: String,
    pub email: String,
    pub timestamp: i64,
}

static PENDING_COMMANDS: LazyLock<RwLock<Vec<ToolkitCommand>>> = LazyLock::new(|| RwLock::new(Vec::new()));
static COMMAND_NOTIFY: LazyLock<tokio::sync::Notify> = LazyLock::new(|| tokio::sync::Notify::new());

pub fn push_command(cmd: ToolkitCommand) {
    if let Ok(mut lock) = PENDING_COMMANDS.write() {
        // Keep queue bounded (e.g. latest 20 commands)
        if lock.len() > 20 {
            lock.remove(0);
        }
        lock.push(cmd);
    }
    COMMAND_NOTIFY.notify_waiters();
}

pub fn pop_command() -> Option<ToolkitCommand> {
    if let Ok(mut lock) = PENDING_COMMANDS.write() {
        if !lock.is_empty() {
            return Some(lock.remove(0));
        }
    }
    None
}

pub async fn wait_for_command(timeout_secs: u64) -> Option<ToolkitCommand> {
    if let Some(cmd) = pop_command() {
        return Some(cmd);
    }
    let timeout = Duration::from_secs(timeout_secs.clamp(1, 60));
    let _ = tokio::time::timeout(timeout, COMMAND_NOTIFY.notified()).await;
    pop_command()
}

// ============================================================================
// IDE Detection & Installation
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeInfo {
    pub id: String,
    pub name: String,
    pub category: String, // "code_oss" | "jetbrains" | "standalone"
    pub is_installed: bool,
    pub executable_path: Option<String>,
    pub version: Option<String>,
    pub toolkit_installed: bool,
    pub supports_auto_install: bool,
    pub official_extension_url: Option<String>,
    pub guide_url: Option<String>,
}

pub fn detect_all_ides() -> Vec<IdeInfo> {
    vec![
        detect_antigravity_ide(),
        detect_vscode(),
        detect_jetbrains(),
        detect_zed(),
        detect_xcode(),
    ]
}

/// Detects Antigravity IDE (official standalone IDE)
fn detect_antigravity_ide() -> IdeInfo {
    let mut exe_path = crate::modules::process::get_antigravity_executable_path(Some("ide"))
        .or_else(|| crate::modules::process::get_antigravity_executable_path(None));

    // Normalize if path points to language server or nested helper
    if let Some(ref exe) = exe_path {
        let exe_str = exe.to_string_lossy().to_string();
        if exe_str.contains("resources") || exe_str.contains("extensions") || exe_str.contains("language_server") {
            if let Some(pos) = exe_str.to_lowercase().find("antigravity ide") {
                let root_dir = PathBuf::from(&exe_str[..pos + "antigravity ide".len()]);
                let cand = root_dir.join("Antigravity IDE.exe");
                if cand.exists() {
                    exe_path = Some(cand);
                }
            }
        }
    }

    let is_installed = exe_path.is_some();
    let path_str = exe_path.as_ref().map(|p| p.to_string_lossy().to_string());

    let toolkit_installed = check_extension_installed(&["Antigravity IDE", "Antigravity", ".antigravity", ".antigravity-ide"]);

    IdeInfo {
        id: "antigravity".to_string(),
        name: "Antigravity IDE".to_string(),
        category: "code_oss".to_string(),
        is_installed,
        executable_path: path_str,
        version: None,
        toolkit_installed,
        supports_auto_install: true,
        official_extension_url: None,
        guide_url: Some("https://antigravity.google".to_string()),
    }
}

/// Detects Visual Studio Code
fn detect_vscode() -> IdeInfo {
    let mut exe_path: Option<PathBuf> = None;

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(local_app_data).join("Programs").join("Microsoft VS Code").join("Code.exe");
            if p.exists() {
                exe_path = Some(p);
            }
        }
        if exe_path.is_none() {
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                let p = PathBuf::from(prog_files).join("Microsoft VS Code").join("Code.exe");
                if p.exists() {
                    exe_path = Some(p);
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let p = PathBuf::from("/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code");
        if p.exists() {
            exe_path = Some(p);
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(p) = which::which("code") {
            exe_path = Some(p);
        }
    }

    let is_installed = exe_path.is_some();
    let path_str = exe_path.as_ref().map(|p| p.to_string_lossy().to_string());
    let toolkit_installed = check_extension_installed(&[".vscode"]);

    IdeInfo {
        id: "vscode".to_string(),
        name: "Visual Studio Code".to_string(),
        category: "code_oss".to_string(),
        is_installed,
        executable_path: path_str,
        version: None,
        toolkit_installed,
        supports_auto_install: true,
        official_extension_url: Some("https://marketplace.visualstudio.com/items?itemName=Google.google-antigravity".to_string()),
        guide_url: Some("https://antigravity.google/blog/antigravity-ide-extensions".to_string()),
    }
}


/// Detects JetBrains IDEs (IntelliJ, WebStorm, PyCharm, etc.)
fn detect_jetbrains() -> IdeInfo {
    let mut found_path: Option<String> = None;

    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            let jb_dir = PathBuf::from(app_data).join("JetBrains");
            if jb_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&jb_dir) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.starts_with("IntelliJ") || name.starts_with("WebStorm") || name.starts_with("PyCharm") || name.starts_with("GoLand") {
                            found_path = Some(entry.path().to_string_lossy().to_string());
                            break;
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        for app in &["IntelliJ IDEA", "WebStorm", "PyCharm", "Android Studio"] {
            let p = PathBuf::from(format!("/Applications/{}.app", app));
            if p.exists() {
                found_path = Some(p.to_string_lossy().to_string());
                break;
            }
        }
    }

    let is_installed = found_path.is_some();

    IdeInfo {
        id: "jetbrains".to_string(),
        name: "JetBrains (IntelliJ / WebStorm / PyCharm)".to_string(),
        category: "jetbrains".to_string(),
        is_installed,
        executable_path: found_path,
        version: None,
        toolkit_installed: false,
        supports_auto_install: false,
        official_extension_url: Some("https://plugins.jetbrains.com/plugin/Google-Cloud-Code".to_string()),
        guide_url: Some("https://antigravity.google/blog/antigravity-ide-extensions".to_string()),
    }
}

/// Detects Zed Editor
fn detect_zed() -> IdeInfo {
    let mut found = false;

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(local_app_data).join("Programs").join("Zed").join("zed.exe");
            if p.exists() {
                found = true;
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let p = PathBuf::from("/Applications/Zed.app");
        if p.exists() {
            found = true;
        }
    }

    IdeInfo {
        id: "zed".to_string(),
        name: "Zed".to_string(),
        category: "standalone".to_string(),
        is_installed: found,
        executable_path: None,
        version: None,
        toolkit_installed: false,
        supports_auto_install: false,
        official_extension_url: None,
        guide_url: Some("https://antigravity.google/blog/antigravity-ide-extensions".to_string()),
    }
}

/// Detects Apple Xcode
fn detect_xcode() -> IdeInfo {
    let found = cfg!(target_os = "macos") && Path::new("/Applications/Xcode.app").exists();

    IdeInfo {
        id: "xcode".to_string(),
        name: "Apple Xcode".to_string(),
        category: "standalone".to_string(),
        is_installed: found,
        executable_path: if found { Some("/Applications/Xcode.app".to_string()) } else { None },
        version: None,
        toolkit_installed: false,
        supports_auto_install: false,
        official_extension_url: None,
        guide_url: Some("https://antigravity.google/blog/antigravity-ide-extensions".to_string()),
    }
}

/// Checks whether antigravity-toolkit extension is installed in target directories
fn check_extension_installed(subdirs: &[&str]) -> bool {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return false,
    };

    for subdir in subdirs {
        let ext_dir = home.join(subdir).join("extensions");
        if ext_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(ext_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.contains("antigravity-toolkit") || name.contains("antigravity_toolkit") {
                        return true;
                    }
                }
            }
        }
    }

    false
}

/// Resolves the bundled antigravity-toolkit.vsix path
pub fn get_bundled_vsix_path() -> Option<PathBuf> {
    // 1. Current working directory / resources
    let cand1 = PathBuf::from("resources").join("antigravity-toolkit.vsix");
    if cand1.exists() {
        return Some(cand1);
    }

    // 2. Relative to current executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let cand2 = parent.join("resources").join("antigravity-toolkit.vsix");
            if cand2.exists() {
                return Some(cand2);
            }
            let cand3 = parent.join("antigravity-toolkit.vsix");
            if cand3.exists() {
                return Some(cand3);
            }
        }
    }

    // 3. Development fallback
    for v in &["1.0.1", "1.0.0"] {
        let cand = PathBuf::from(format!(
            r"d:\Ershad Zolfi\programming\coding with Gemini\antigravity-toolkit-extension\antigravity-toolkit-{}.vsix",
            v
        ));
        if cand.exists() {
            return Some(cand);
        }
    }

    None
}

/// Installs the bundled VSIX into the target IDE via CLI
pub fn install_toolkit_to_ide(ide_id: &str) -> Result<String, String> {
    let vsix_path = get_bundled_vsix_path()
        .ok_or_else(|| "Bundled antigravity-toolkit.vsix file not found.".to_string())?;

    let vsix_str = vsix_path.to_string_lossy().to_string();

    match ide_id {
        "antigravity" => {
            let mut exe = crate::modules::process::get_antigravity_executable_path(Some("ide"))
                .or_else(|| crate::modules::process::get_antigravity_executable_path(None))
                .ok_or_else(|| "Antigravity IDE executable not found.".to_string())?;

            // Normalize if path points to language server or nested helper
            let exe_str = exe.to_string_lossy().to_string();
            if exe_str.contains("resources") || exe_str.contains("extensions") || exe_str.contains("language_server") {
                if let Some(pos) = exe_str.to_lowercase().find("antigravity ide") {
                    let root_dir = PathBuf::from(&exe_str[..pos + "antigravity ide".len()]);
                    let cand = root_dir.join("Antigravity IDE.exe");
                    if cand.exists() {
                        exe = cand;
                    }
                }
            }

            let cli_js = exe.parent().map(|p| p.join("resources").join("app").join("out").join("cli.js"));
            let bin_cmd = exe.parent().map(|p| p.join("bin").join("antigravity-ide.cmd"));
            let bin_sh = exe.parent().map(|p| p.join("bin").join("antigravity-ide"));

            let output = if let Some(cli) = cli_js.filter(|p| p.exists()) {
                // Direct Node-mode Electron execution; completely avoids cmd.exe space escaping issues
                Command::new(&exe)
                    .env("ELECTRON_RUN_AS_NODE", "1")
                    .args([&cli.to_string_lossy().to_string(), "--install-extension", &vsix_str, "--force"])
                    .output()
                    .map_err(|e| format!("Failed to launch Antigravity CLI: {}", e))?
            } else if cfg!(target_os = "windows") && bin_cmd.as_ref().map(|p| p.exists()).unwrap_or(false) {
                let cmd_file = bin_cmd.unwrap();
                Command::new("cmd")
                    .args(["/s", "/c", &format!("\"\"{}\" --install-extension \"{}\" --force\"", cmd_file.to_string_lossy(), vsix_str)])
                    .output()
                    .map_err(|e| format!("Failed to launch Antigravity CLI: {}", e))?
            } else if bin_sh.as_ref().map(|p| p.exists()).unwrap_or(false) {
                let sh_file = bin_sh.unwrap();
                Command::new(&sh_file)
                    .args(["--install-extension", &vsix_str, "--force"])
                    .output()
                    .map_err(|e| format!("Failed to launch Antigravity CLI: {}", e))?
            } else {
                Command::new(&exe)
                    .args(["--install-extension", &vsix_str, "--force"])
                    .output()
                    .map_err(|e| format!("Failed to launch Antigravity CLI: {}", e))?
            };

            if output.status.success() {
                Ok("Toolkit extension installed successfully to Antigravity IDE!".to_string())
            } else {
                let err = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let msg = if !err.trim().is_empty() { err } else { stdout };
                Err(format!("Antigravity installer error: {}", msg.trim()))
            }
        }
        "vscode" => {
            let output = Command::new("code")
                .args(["--install-extension", &vsix_str])
                .output()
                .map_err(|e| format!("Failed to launch 'code' CLI. Ensure VS Code is in your PATH. Error: {}", e))?;

            if output.status.success() {
                Ok("Toolkit extension installed successfully to Visual Studio Code!".to_string())
            } else {
                let err = String::from_utf8_lossy(&output.stderr);
                Err(format!("VS Code installer error: {}", err.trim()))
            }
        }
        _ => Err(format!("Automated 1-click install is not supported for '{}'. Please use the manual setup guide.", ide_id)),
    }
}
