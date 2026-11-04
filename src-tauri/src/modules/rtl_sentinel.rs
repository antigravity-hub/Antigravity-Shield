// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use std::time::Duration;
use tracing::{info, warn};
use crate::commands::patch::{get_antigravity_rtl_status, patch_antigravity_rtl};

/// Autonomous Sentinel for Antigravity RTL & Vazirmatn
/// 1. Runs immediately on Shield startup (after warmup) to ensure newly installed/launched IDEs are patched.
/// 2. If Antigravity IDE or Platform is installed but unpatched (e.g. freshly installed or auto-updated),
///    it automatically applies the RTL & Vazirmatn patch.
/// 3. Runs continuously in background every 3 minutes to auto-heal when Antigravity auto-updates.
pub fn start_rtl_auto_sentinel(_app_handle: Option<tauri::AppHandle>) {
    tauri::async_runtime::spawn(async move {
        // Initial warmup delay on Shield launch (4 seconds)
        tokio::time::sleep(Duration::from_secs(4)).await;

        auto_check_and_patch().await;

        // Recurring check interval: every 3 minutes
        let mut interval = tokio::time::interval(Duration::from_secs(180));
        loop {
            interval.tick().await;
            auto_check_and_patch().await;
        }
    });
}

async fn auto_check_and_patch() {
    match get_antigravity_rtl_status().await {
        Ok(status) => {
            let ide_needs_patch = status.ide_css_path.is_some() && !status.ide_is_patched;
            let desktop_needs_patch = status.desktop_asar_path.is_some() && !status.desktop_is_patched;

            if ide_needs_patch || desktop_needs_patch {
                info!(
                    "[RTL Sentinel] Detected unpatched Antigravity installation/update (IDE: {}, Desktop: {}). Auto-patching...",
                    ide_needs_patch, desktop_needs_patch
                );
                match patch_antigravity_rtl().await {
                    Ok(msg) => {
                        info!("[RTL Sentinel] Successfully auto-patched: {}", msg);
                    }
                    Err(e) => {
                        warn!("[RTL Sentinel] Failed to auto-patch: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            warn!("[RTL Sentinel] Status check error: {}", e);
        }
    }
}
