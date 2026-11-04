// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use std::time::Duration;
use tracing::{info, warn};
use crate::commands::patch::{get_antigravity_rtl_status, patch_antigravity_rtl};

/// Autonomous Sentinel for Antigravity RTL & Vazirmatn
/// 1. Runs once on Shield startup (after 5s warmup) — covers installation, reboot, and manual relaunch.
/// 2. Runs on an ergonomic, low-overhead cycle of every 6 hours — zero CPU/disk thrashing.
/// 3. Provides `trigger_rtl_check()` for on-demand trigger when an IDE launches.
pub fn start_rtl_auto_sentinel(_app_handle: Option<tauri::AppHandle>) {
    tauri::async_runtime::spawn(async move {
        // Initial warmup delay on Shield launch (5 seconds)
        tokio::time::sleep(Duration::from_secs(5)).await;

        auto_check_and_patch().await;

        // Ergonomic recurring interval: every 6 hours (matches Toolkit Updater)
        let mut interval = tokio::time::interval(Duration::from_secs(6 * 3600));
        loop {
            interval.tick().await;
            auto_check_and_patch().await;
        }
    });
}

/// On-demand check (can be triggered on process detection or UI open)
pub fn trigger_rtl_check() {
    tauri::async_runtime::spawn(async {
        auto_check_and_patch().await;
    });
}

async fn auto_check_and_patch() {
    match get_antigravity_rtl_status().await {
        Ok(status) => {
            // Antigravity Desktop Platform (resources/app.asar) is sealed with Electron v44 block integrity.
            // Only Antigravity IDE (unpacked web assets & product.json) is auto-patched.
            let ide_needs_patch = status.ide_css_path.is_some() && !status.ide_is_patched;

            if ide_needs_patch {
                info!(
                    "[RTL Sentinel] Detected unpatched Antigravity IDE installation/update. Auto-patching...",
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
