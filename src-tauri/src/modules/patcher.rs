// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatcherExecutionResult {
    pub success: bool,
    pub language_server_patched: bool,
    pub main_js_patched: bool,
    pub cache_cleared: bool,
    pub message: String,
    pub details: Vec<String>,
}

/// Discovers candidate paths for Antigravity language_server binaries
pub fn find_language_server_paths() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let base = PathBuf::from(&local_appdata);
            candidates.push(base.join("Programs").join("Antigravity IDE").join("resources").join("app").join("extensions").join("antigravity").join("bin").join("language_server_windows_x64.exe"));
            candidates.push(base.join("Programs").join("Antigravity IDE").join("resources").join("app").join("extensions").join("antigravity").join("bin").join("language_server_windows_arm64.exe"));
            candidates.push(base.join("Programs").join("antigravity").join("resources").join("bin").join("language_server.exe"));
            candidates.push(base.join("Programs").join("Antigravity IDE").join("resources").join("app").join("extensions").join("antigravity").join("bin").join("language_server.exe"));
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let ubase = PathBuf::from(&userprofile);
            candidates.push(ubase.join(".antigravity").join("extensions").join("antigravity").join("bin").join("language_server_windows_x64.exe"));
            candidates.push(ubase.join(".antigravity").join("extensions").join("antigravity").join("bin").join("language_server_windows_arm64.exe"));
            candidates.push(ubase.join(".antigravity-ide").join("extensions").join("antigravity").join("bin").join("language_server_windows_x64.exe"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/bin/language_server"));
        candidates.push(PathBuf::from("/Applications/Antigravity.app/Contents/Resources/app/extensions/antigravity/bin/language_server"));
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join(".antigravity/extensions/antigravity/bin/language_server"));
            candidates.push(home.join(".antigravity-ide/extensions/antigravity/bin/language_server"));
            candidates.push(home.join("Library/Application Support/Antigravity IDE/extensions/antigravity/bin/language_server"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        candidates.push(PathBuf::from("/usr/share/antigravity-ide/resources/app/extensions/antigravity/bin/language_server"));
        candidates.push(PathBuf::from("/opt/antigravity/resources/app/extensions/antigravity/bin/language_server"));
        candidates.push(PathBuf::from("/opt/antigravity-ide/resources/app/extensions/antigravity/bin/language_server"));
        if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            let xdg_p = PathBuf::from(&xdg);
            candidates.push(xdg_p.join("Antigravity IDE/extensions/antigravity/bin/language_server"));
            candidates.push(xdg_p.join("Antigravity/extensions/antigravity/bin/language_server"));
        }
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join(".antigravity/extensions/antigravity/bin/language_server"));
            candidates.push(home.join(".antigravity-ide/extensions/antigravity/bin/language_server"));
            candidates.push(home.join(".config/Antigravity IDE/extensions/antigravity/bin/language_server"));
            candidates.push(home.join(".config/Antigravity/extensions/antigravity/bin/language_server"));
            candidates.push(home.join(".local/share/antigravity-ide/extensions/antigravity/bin/language_server"));
        }
    }

    candidates.into_iter().filter(|p| p.exists()).collect()
}

/// Discovers candidate paths for main.js in Antigravity IDE installations
pub fn find_main_js_paths() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let base = PathBuf::from(&local_appdata);
            candidates.push(base.join("Programs").join("Antigravity IDE").join("resources").join("app").join("out").join("main.js"));
            candidates.push(base.join("Programs").join("antigravity").join("resources").join("app").join("out").join("main.js"));
            candidates.push(base.join("Programs").join("Antigravity IDE").join("resources").join("app").join("out").join("vs").join("workbench").join("workbench.desktop.main.js"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/Applications/Antigravity IDE.app/Contents/Resources/app/out/main.js"));
        candidates.push(PathBuf::from("/Applications/Antigravity.app/Contents/Resources/app/out/main.js"));
        candidates.push(PathBuf::from("/Applications/Antigravity IDE.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"));
    }

    #[cfg(target_os = "linux")]
    {
        candidates.push(PathBuf::from("/usr/share/antigravity-ide/resources/app/out/main.js"));
        candidates.push(PathBuf::from("/usr/share/antigravity/resources/app/out/main.js"));
        candidates.push(PathBuf::from("/opt/antigravity/resources/app/out/main.js"));
        candidates.push(PathBuf::from("/opt/antigravity-ide/resources/app/out/main.js"));
    }

    candidates.into_iter().filter(|p| p.exists()).collect()
}

/// Terminate running language_server instances to release executable write locks
pub fn kill_running_language_servers() {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "language_server_windows_x64.exe"])
            .output();
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "language_server_windows_arm64.exe"])
            .output();
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "language_server.exe"])
            .output();
    }

    #[cfg(unix)]
    {
        let _ = Command::new("pkill")
            .args(["-9", "-f", "language_server"])
            .output();
    }

    // Give OS kernel time to release file locks on terminating processes
    std::thread::sleep(std::time::Duration::from_millis(500));
}

/// Applies the byte pattern patch to a language_server binary:
/// x64 Pattern:
///   80 78 08 00 74 ?? 48 8b ?? 24 ?? 48 89 ?? 60
/// Patched to:
///   c6 40 08 01 90 90 (replaces 80 78 08 00 74 ??)
///
/// ARM64 Pattern:
///   Detects and replaces ARM64 conditional eligibility branch with unconditional pass.
pub fn patch_language_server_binary(file_path: &Path, details: &mut Vec<String>) -> Result<bool, String> {
    if !file_path.exists() {
        return Err(format!("File does not exist: {:?}", file_path));
    }

    let mut data = fs::read(file_path).map_err(|e| format!("Failed to read binary: {}", e))?;
    let n = data.len();
    if n < 32 {
        return Err("Binary file too small".into());
    }

    let mut patched = false;
    let mut already_patched = false;

    // 1. Scan for x64 pattern:
    // [0x80, 0x78, 0x08, 0x00, 0x74, ??, 0x48, 0x8b, ??, 0x24, ??, 0x48, 0x89, ??, 0x60]
    let mut i = 0;
    while i + 15 <= n {
        // Check if already patched:
        if data[i..i + 6] == [0xc6, 0x40, 0x08, 0x01, 0x90, 0x90]
            && data[i + 6..i + 8] == [0x48, 0x8b]
            && data[i + 9] == 0x24
            && data[i + 11..i + 13] == [0x48, 0x89]
            && data[i + 14] == 0x60
        {
            already_patched = true;
            details.push(format!("x64 eligibility gate at offset 0x{:x} is already patched in {:?}", i, file_path));
            break;
        }

        // Check unpatched pattern:
        if data[i..i + 4] == [0x80, 0x78, 0x08, 0x00]
            && data[i + 4] == 0x74
            && data[i + 6..i + 8] == [0x48, 0x8b]
            && data[i + 9] == 0x24
            && data[i + 11..i + 13] == [0x48, 0x89]
            && data[i + 14] == 0x60
        {
            // Create backup if not present
            let backup = PathBuf::from(format!("{}.bak", file_path.to_string_lossy()));
            if !backup.exists() {
                let _ = fs::copy(file_path, &backup);
            }

            // Apply patch: c6 40 08 01 90 90
            data[i] = 0xc6;
            data[i + 1] = 0x40;
            data[i + 2] = 0x08;
            data[i + 3] = 0x01;
            data[i + 4] = 0x90;
            data[i + 5] = 0x90;

            patched = true;
            details.push(format!("Applied x64 byte patch at offset 0x{:x} in {:?}", i, file_path));
            break;
        }

        i += 1;
    }

    // 2. Scan for ARM64 pattern if not found in x64
    if !patched && !already_patched {
        for j in (0..n.saturating_sub(20)).step_by(4) {
            let inst1 = u32::from_le_bytes(data[j..j + 4].try_into().unwrap());
            let inst2 = u32::from_le_bytes(data[j + 4..j + 8].try_into().unwrap());

            // Check if already patched for ARM64:
            if (inst1 & 0xfffffc00) == 0x39402000 && data[j + 4..j + 8] == [0x1f, 0x20, 0x03, 0xd5] {
                already_patched = true;
                details.push(format!("ARM64 eligibility gate at offset 0x{:x} is already patched in {:?}", j + 4, file_path));
                break;
            }

            // ldrb wA, [xB, #8] -> 0x39402000
            if (inst1 & 0xfffffc00) == 0x39402000 {
                let a_reg = inst1 & 0x1f;
                // cbz/tbz wA
                if (inst2 & 0x7f00001f) == (0x34000000 | a_reg) || (inst2 & 0xff00001f) == (0x36000000 | a_reg) {
                    let backup = PathBuf::from(format!("{}.bak", file_path.to_string_lossy()));
                    if !backup.exists() {
                        let _ = fs::copy(file_path, &backup);
                    }
                    // Replace conditional branch with NOP (0x1f, 0x20, 0x03, 0xd5)
                    data[j + 4..j + 8].copy_from_slice(&[0x1f, 0x20, 0x03, 0xd5]);
                    patched = true;
                    details.push(format!("Applied ARM64 patch at offset 0x{:x} in {:?}", j + 4, file_path));
                    break;
                }
            }
        }
    }

    if patched {
        fs::write(file_path, &data).map_err(|e| format!("Failed to write patched binary {:?}: {}", file_path, e))?;
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("codesign")
                .args(["--remove-signature", &file_path.to_string_lossy().to_string()])
                .output();
            let _ = Command::new("codesign")
                .args(["--sign", "-", &file_path.to_string_lossy().to_string()])
                .output();
        }
        Ok(true)
    } else if already_patched {
        Ok(true)
    } else {
        details.push(format!("Pattern not found in {:?} (might already be patched or newer version)", file_path));
        Ok(false)
    }
}

/// Patches main.js:
/// Replaces `resetIsTierGCPTos(),this.*.isGoogleInternal` with `resetIsTierGCPTos(),true`
pub fn patch_main_js_file(file_path: &Path, details: &mut Vec<String>) -> Result<bool, String> {
    if !file_path.exists() {
        return Err(format!("File does not exist: {:?}", file_path));
    }

    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {:?}: {}", file_path, e))?;

    if content.contains("resetIsTierGCPTos(),true") {
        details.push(format!("main.js at {:?} is already patched.", file_path));
        return Ok(true);
    }

    // Regex matching: resetIsTierGCPTos(),this.*.isGoogleInternal
    let regex = regex::Regex::new(r"resetIsTierGCPTos\(\),this\.[a-zA-Z0-9_$]+\.isGoogleInternal")
        .map_err(|e| format!("Regex compile error: {}", e))?;

    if let Some(mat) = regex.find(&content) {
        let backup = file_path.with_extension("js.bak");
        if !backup.exists() {
            let _ = fs::copy(file_path, &backup);
        }

        let patched_content = regex.replace_all(&content, "resetIsTierGCPTos(),true").to_string();
        fs::write(file_path, patched_content)
            .map_err(|e| format!("Failed to write patched main.js {:?}: {}", file_path, e))?;

        details.push(format!("Patched main.js at {:?} (replaced '{}' with 'resetIsTierGCPTos(),true')", file_path, mat.as_str()));
        Ok(true)
    } else {
        details.push(format!("Target pattern not found in main.js at {:?}", file_path));
        Ok(false)
    }
}

/// Purges IDE V8 bytecode and code caches (CachedData and Code Cache)
pub fn clear_ide_caches(details: &mut Vec<String>) -> bool {
    let mut cleared_any = false;
    let mut cache_dirs = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let base = PathBuf::from(&appdata);
            cache_dirs.push(base.join("Antigravity IDE").join("CachedData"));
            cache_dirs.push(base.join("Antigravity IDE").join("Code Cache"));
            cache_dirs.push(base.join("Antigravity").join("CachedData"));
            cache_dirs.push(base.join("Antigravity").join("Code Cache"));
        }
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            let base = PathBuf::from(&local_appdata);
            cache_dirs.push(base.join("Antigravity IDE").join("Cache"));
            cache_dirs.push(base.join("Antigravity").join("Cache"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let base = home.join("Library/Application Support");
            cache_dirs.push(base.join("Antigravity IDE/CachedData"));
            cache_dirs.push(base.join("Antigravity IDE/Code Cache"));
            cache_dirs.push(base.join("Antigravity/CachedData"));
            cache_dirs.push(base.join("Antigravity/Code Cache"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            let base = home.join(".config");
            cache_dirs.push(base.join("Antigravity IDE/CachedData"));
            cache_dirs.push(base.join("Antigravity IDE/Code Cache"));
            cache_dirs.push(base.join("Antigravity/CachedData"));
            cache_dirs.push(base.join("Antigravity/Code Cache"));
        }
    }

    for dir in cache_dirs {
        if dir.exists() {
            let mut removed = false;
            if fs::remove_dir_all(&dir).is_ok() {
                removed = true;
            } else if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        let _ = fs::remove_dir_all(&p);
                    } else {
                        let _ = fs::remove_file(&p);
                    }
                }
                removed = true;
            }
            if removed {
                cleared_any = true;
                details.push(format!("Cleared cache directory: {:?}", dir));
            }
        }
    }

    cleared_any
}

/// Master 1-click routine: Fix License #3501 & Region Restrictions
pub fn run_fix_license_and_region_patch() -> PatcherExecutionResult {
    let mut details = Vec::new();
    details.push("Starting Core Engine & Region Patcher...".to_string());

    // 1. Kill running language_server instances
    kill_running_language_servers();
    details.push("Released running language server process locks.".to_string());

    // 2. Patch language_server binaries
    let ls_paths = find_language_server_paths();
    let mut ls_patched = false;
    if ls_paths.is_empty() {
        details.push("No language_server binary found in standard install locations.".to_string());
    } else {
        for path in &ls_paths {
            match patch_language_server_binary(path, &mut details) {
                Ok(success) => {
                    if success {
                        ls_patched = true;
                    }
                }
                Err(err) => {
                    details.push(format!("Error patching language_server {:?}: {}", path, err));
                }
            }
        }
    }

    // 3. Patch main.js
    let js_paths = find_main_js_paths();
    let mut js_patched = false;
    if js_paths.is_empty() {
        details.push("No main.js found in standard install locations.".to_string());
    } else {
        for path in &js_paths {
            match patch_main_js_file(path, &mut details) {
                Ok(success) => {
                    if success {
                        js_patched = true;
                    }
                }
                Err(err) => {
                    details.push(format!("Error patching main.js {:?}: {}", path, err));
                }
            }
        }
    }

    // 4. Clear IDE caches
    let cache_cleared = clear_ide_caches(&mut details);

    let overall_success = ls_patched || js_patched || cache_cleared;
    let message = if overall_success {
        "License #3501 & Region bypass patch applied successfully! Restart Antigravity IDE to take effect.".to_string()
    } else {
        "Patcher completed, but no eligible files were modified (may already be patched).".to_string()
    };

    PatcherExecutionResult {
        success: overall_success,
        language_server_patched: ls_patched,
        main_js_patched: js_patched,
        cache_cleared,
        message,
        details,
    }
}
