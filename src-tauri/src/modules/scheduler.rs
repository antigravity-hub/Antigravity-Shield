use crate::models::Account;
use crate::modules::{account, config, logger, quota};
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::time::{self, Duration};

// Warmup history: key = "email:bucket_or_model:weekly:cycle_id", value = warmup timestamp
static WARMUP_HISTORY: Lazy<Mutex<HashMap<String, i64>>> =
    Lazy::new(|| Mutex::new(load_warmup_history()));

fn get_warmup_history_path() -> Result<PathBuf, String> {
    let data_dir = account::get_data_dir()?;
    Ok(data_dir.join("warmup_history.json"))
}

fn load_warmup_history() -> HashMap<String, i64> {
    match get_warmup_history_path() {
        Ok(path) if path.exists() => match std::fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => HashMap::new(),
        },
        _ => HashMap::new(),
    }
}

fn save_warmup_history(history: &HashMap<String, i64>) {
    if let Ok(path) = get_warmup_history_path() {
        if let Ok(content) = serde_json::to_string_pretty(history) {
            let _ = std::fs::write(&path, content);
        }
    }
}

pub fn record_warmup_history(key: &str, timestamp: i64) {
    let history_snapshot = {
        let mut history = WARMUP_HISTORY.lock().unwrap();
        history.insert(key.to_string(), timestamp);
        history.clone()
    };
    save_warmup_history(&history_snapshot);
}

pub fn check_cooldown(key: &str, cooldown_seconds: i64) -> bool {
    let history = WARMUP_HISTORY.lock().unwrap();
    if let Some(&last_ts) = history.get(key) {
        let now = chrono::Utc::now().timestamp();
        now - last_ts < cooldown_seconds
    } else {
        false
    }
}

/// Helper to parse ISO8601 / RFC3339 string to timestamp
fn parse_reset_time_ts(s: &str) -> Option<i64> {
    if s.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.timestamp());
    }
    if let Ok(dt) = DateTime::parse_from_str(s, "%Y/%m/%d %H:%M:%S") {
        return Some(dt.timestamp());
    }
    None
}

/// Google AI Docs URL to scan for latest models
const GOOGLE_AI_MODELS_DOC_URL: &str = "https://ai.google.dev/gemini-api/docs/models";

/// Path to store the scraped latest models catalog
fn get_models_catalog_path() -> Result<PathBuf, String> {
    let data_dir = account::get_data_dir()?;
    Ok(data_dir.join("latest_models_catalog.json"))
}

/// Scrapes https://ai.google.dev/gemini-api/docs/models to automatically discover latest Gemini models
pub async fn sync_latest_models_from_google_ai() {
    logger::log_info("[ModelSync] Scanning https://ai.google.dev/gemini-api/docs/models for latest models...");
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
        .timeout(Duration::from_secs(15))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(e) => {
            logger::log_warn(&format!("[ModelSync] Failed to build HTTP client: {}", e));
            return;
        }
    };

    match client.get(GOOGLE_AI_MODELS_DOC_URL).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(html) = resp.text().await {
                    let mut found_models = std::collections::BTreeSet::new();
                    // Regex match all gemini-X.Y-xxx or gemini-X-xxx identifiers
                    let re = regex::Regex::new(r"gemini-[0-9]+(?:\.[0-9]+)?-[a-z0-9-]+").unwrap();
                    for cap in re.find_iter(&html) {
                        let m = cap.as_str().to_lowercase();
                        // Filter out documentation anchor links / html fragments
                        if !m.ends_with("-models") && !m.ends_with("-stable") && !m.ends_with("-preview") {
                            found_models.insert(m);
                        }
                    }

                    if !found_models.is_empty() {
                        let models_list: Vec<String> = found_models.into_iter().collect();
                        logger::log_info(&format!(
                            "[ModelSync] Successfully discovered {} Gemini models from Google AI docs: {:?}",
                            models_list.len(),
                            models_list
                        ));

                        if let Ok(path) = get_models_catalog_path() {
                            let catalog_obj = serde_json::json!({
                                "last_scanned": Utc::now().timestamp(),
                                "url": GOOGLE_AI_MODELS_DOC_URL,
                                "models": models_list
                            });
                            if let Ok(json_str) = serde_json::to_string_pretty(&catalog_obj) {
                                let _ = std::fs::write(path, json_str);
                            }
                        }
                    }
                }
            } else {
                logger::log_warn(&format!("[ModelSync] HTTP {} fetching Google AI docs", resp.status()));
            }
        }
        Err(e) => {
            logger::log_warn(&format!("[ModelSync] Error fetching Google AI docs: {}", e));
        }
    }
}

/// Start smart weekly scheduler
pub fn start_scheduler(
    app_handle: Option<tauri::AppHandle>,
    proxy_state: crate::commands::proxy::ProxyServiceState,
) {
    // 1. Spawn Google AI 6-hour model scraper loop
    tauri::async_runtime::spawn(async move {
        // Initial scan on startup (delayed by 10s to not block initial GUI launch)
        time::sleep(Duration::from_secs(10)).await;
        sync_latest_models_from_google_ai().await;

        // Recurring scan every 6 hours (6 * 3600 = 21600 seconds)
        loop {
            time::sleep(Duration::from_secs(6 * 3600)).await;
            sync_latest_models_from_google_ai().await;
        }
    });

    // 2. Spawn Weekly Reset Warmup Scheduler
    let app_handle_for_cycle = app_handle.clone();
    let proxy_state_for_cycle = proxy_state.clone();
    tauri::async_runtime::spawn(async move {
        logger::log_info("[Scheduler] Weekly Reset Warmup Scheduler started. Monitoring 7-day quota windows...");

        // Initial scan shortly after startup (15s delay to ensure proxy server is fully bound)
        time::sleep(Duration::from_secs(15)).await;
        run_warmup_cycle(app_handle_for_cycle.clone(), proxy_state_for_cycle.clone()).await;

        // [HARDENED] Scan with randomized jitter to eliminate mechanical bot timing signatures
        loop {
            let jitter_secs = 270 + (chrono::Utc::now().timestamp() as u64 % 90);
            time::sleep(Duration::from_secs(jitter_secs)).await;
            run_warmup_cycle(app_handle_for_cycle.clone(), proxy_state_for_cycle.clone()).await;
        }
    });

    // 3. Spawn Native Periodic Fleet Quota & Sync Daemon (Independent of WebView2 / Tray state)
    let app_handle_for_daemon = app_handle.clone();
    let proxy_state_for_daemon = proxy_state.clone();
    tauri::async_runtime::spawn(async move {
        logger::log_info("[Scheduler] Native Fleet Quota & Sync Daemon started (Independent of WebView2 window state).");

        // Stagger initial check slightly on launch (10s)
        time::sleep(Duration::from_secs(10)).await;

        let mut last_quota_refresh = 0i64;
        let mut last_active_fast_refresh = 0i64;
        let mut last_db_sync = 0i64;
        let mut last_observed_pct: Option<i32> = None;
        let mut last_observed_time: i64 = 0;
        let mut last_observed_acc_id: Option<String> = None;
        let mut stagnant_checks: u32 = 0;
        let mut estimated_runway_mins: Option<f64> = None;
        let mut last_auto_switch_time: i64 = 0;

        loop {
            // Check every 15 seconds against configured intervals
            time::sleep(Duration::from_secs(15)).await;

            let Ok(cfg) = config::load_app_config() else {
                continue;
            };

            let now = chrono::Utc::now().timestamp();

            // A1. Velocity & Runway-Aware Adaptive Polling (Targeted active IDE account)
            // Polling interval is calculated as a function of Projected Runway (Time-To-Depletion TTD),
            // NOT merely a blind static percentage.
            // Example: If 4% was burned over 10m (0.4%/m) and 16% remains, runway is ~40 minutes -> No urgent polling!
            // Rapid polling (35-45s) is strictly reserved for when runway drops below ~5 minutes.
            if cfg.auto_refresh {
                let mut active_target_account_id = None;
                // 1. Prioritize live heartbeat from connected IDE
                if let Some(live_email) = crate::modules::ide_scanner::get_active_ide_email() {
                    if let Ok(Some(live_acc)) = crate::modules::account::find_account_by_email(&live_email) {
                        active_target_account_id = Some(live_acc.id);
                    }
                }
                // 2. Fall back to active target accounts
                if active_target_account_id.is_none() {
                    if let Ok(targets) = crate::modules::account::get_active_target_accounts() {
                        active_target_account_id = targets.ide.or(targets.agy);
                    }
                }
                // 3. Fall back to current account
                if active_target_account_id.is_none() {
                    active_target_account_id = crate::modules::account::get_current_account_id().ok().flatten();
                }

                if let Some(ref acc_id) = active_target_account_id {
                    if let Ok(acc) = crate::modules::account::load_account(acc_id) {
                        if !acc.disabled && !acc.proxy_disabled && !acc.validation_blocked {
                            if let Some(ref q) = acc.quota {
                                if !q.is_forbidden {
                                    let min_pct = q.get_min_remaining_percentage();

                                    // Live token consumption & multi-chat concurrency telemetry from LiveBrainWatcher
                                    let live_act = crate::modules::brain_scanner::get_live_activity_snapshot();
                                    let is_heavy_burst = live_act.active_chats_count >= 2 || live_act.tokens_burned_last_60s >= 10_000;
                                    let has_live_tokens = (now - live_act.last_activity_timestamp) <= 90;

                                    if has_live_tokens {
                                        // Zero-out stagnation penalties as long as tokens are being consumed by IDE / AI
                                        stagnant_checks = 0;
                                    }

                                    // Reset stagnation & runway tracking if active account switched
                                    if last_observed_acc_id.as_deref() != Some(&acc.id) {
                                        last_observed_acc_id = Some(acc.id.clone());
                                        last_observed_pct = Some(min_pct);
                                        last_observed_time = now;
                                        stagnant_checks = 0;
                                        estimated_runway_mins = None;
                                    }

                                    // Calculate target interval based on Estimated Runway & Live Concurrency Telemetry
                                    let base_interval = if min_pct <= 0 {
                                        // Depleted account: fast poll (15-20s) to maintain rotation pressure until switched
                                        15 + (now % 6)
                                    } else if min_pct <= 5 {
                                        // Critical Danger Zone: Sub-5% remaining
                                        if is_heavy_burst {
                                            20 + (now % 6) // ~20-25s rapid check
                                        } else {
                                            30 + (now % 6) // ~30-35s check
                                        }
                                    } else if min_pct <= 25 {
                                        // High-Alert Zone: Floor set to 25%
                                        if is_heavy_burst {
                                            // Multi-chat or high token velocity detected from logs
                                            25 + (now % 8) // ~25-32s check
                                        } else if has_live_tokens {
                                            // Single active session burning tokens
                                            40 + (now % 10) // ~40-49s check
                                        } else {
                                            // No tokens detected in last 90s, check comfortably but safely
                                            55 + (now % 15) // ~55-69s check
                                        }
                                    } else if let Some(runway) = estimated_runway_mins {
                                        // Scale runway with active chat concurrency multiplier
                                        let concurrency_factor = (live_act.active_chats_count as f64).max(1.0);
                                        let effective_runway = runway / concurrency_factor;

                                        if effective_runway < 8.0 || is_heavy_burst {
                                            30 + (now % 8) // High burn
                                        } else if effective_runway < 18.0 {
                                            50 + (now % 10) // Moderate burn
                                        } else if effective_runway > 30.0 && !has_live_tokens {
                                            150 + (now % 25) // Safe fleet cycle (~2.5m)
                                        } else {
                                            90 + (now % 15) // Active steady burn (~1.5m)
                                        }
                                    } else {
                                        // Quota > 25% without established velocity:
                                        // NEVER set 0! We must poll periodically to establish velocity trajectory.
                                        if is_heavy_burst {
                                            45 + (now % 10) // Burst active (~45-55s)
                                        } else if has_live_tokens {
                                            60 + (now % 15) // Active IDE coding session (~60-75s)
                                        } else {
                                            150 + (now % 25) // Idle baseline heartbeat (~2.5m)
                                        }
                                    };

                                    if base_interval > 0 {
                                        // Stagnation backoff guard: Only back off if no tokens are being burned at all
                                        let effective_interval = if has_live_tokens {
                                            base_interval
                                        } else {
                                            match stagnant_checks {
                                                0 => base_interval,
                                                1 => base_interval.max(90) + (now % 15),
                                                2 => base_interval.max(150) + (now % 20),
                                                _ => base_interval.max(210) + (now % 30), // Max ~4m idle floor, NEVER 0!
                                            }
                                        };

                                        if effective_interval > 0 && now - last_active_fast_refresh >= effective_interval {
                                            let runway_str = estimated_runway_mins
                                                .map(|r| format!("{:.1}m runway", r))
                                                .unwrap_or_else(|| "calculating".to_string());

                                            let mode_str = if is_heavy_burst {
                                                format!("🔥 BURST ({} chats, {} tok/60s)", live_act.active_chats_count, live_act.tokens_burned_last_60s)
                                            } else if has_live_tokens {
                                                format!("⚡ ACTIVE ({} tok/60s)", live_act.tokens_burned_last_60s)
                                            } else {
                                                "IDLE".to_string()
                                            };

                                            logger::log_info(&format!(
                                                "[Scheduler] Concurrency-Aware Polling active for {} (Remaining: {}%, Est: {}, Mode: {}, Interval: {}s). Performing refresh...",
                                                acc.email, min_pct, runway_str, mode_str, effective_interval
                                            ));
                                            last_active_fast_refresh = now;
                                            let mut acc_to_refresh = acc;
                                            let _ = crate::commands::internal_refresh_account_quota(
                                                app_handle_for_daemon.as_ref(),
                                                &mut acc_to_refresh,
                                            )
                                            .await;

                                            // Re-evaluate quota & update consumption velocity
                                            if let Ok(refreshed_acc) = crate::modules::account::load_account(&acc_to_refresh.id) {
                                                if let Some(ref new_q) = refreshed_acc.quota {
                                                    let new_min = new_q.get_min_remaining_percentage();
                                                    if let Some(prev) = last_observed_pct {
                                                        let elapsed_secs = (now - last_observed_time).max(1);
                                                        if new_min < prev && elapsed_secs >= 20 {
                                                            let delta_pct = (prev - new_min) as f64;
                                                            let burn_per_min = delta_pct / (elapsed_secs as f64 / 60.0);
                                                            if burn_per_min > 0.001 {
                                                                let runway = (new_min as f64) / burn_per_min;
                                                                estimated_runway_mins = Some(runway);
                                                                logger::log_info(&format!(
                                                                    "[Scheduler] Velocity for {}: {:.2}%/min ({:.1}% burned in {}s). Estimated runway: {:.1} minutes.",
                                                                    acc_to_refresh.email, burn_per_min, delta_pct, elapsed_secs, runway
                                                                ));
                                                            }
                                                            stagnant_checks = 0;
                                                            last_observed_time = now;
                                                        } else if new_min == prev {
                                                            if !has_live_tokens {
                                                                stagnant_checks = stagnant_checks.saturating_add(1);
                                                                if let Some(r) = estimated_runway_mins.as_mut() {
                                                                    *r += (elapsed_secs as f64 / 60.0) * 1.5;
                                                                }
                                                            } else {
                                                                stagnant_checks = 0;
                                                            }
                                                        } else {
                                                            // Quota increased (window reset)
                                                            stagnant_checks = 0;
                                                            estimated_runway_mins = None;
                                                            last_observed_time = now;
                                                        }
                                                    }
                                                    last_observed_pct = Some(new_min);

                                                    // [PREEMPTIVE AUTO-SWITCH] Graceful handover based on Runway (Time-To-Depletion), Weekly Exhaustion & Safety Floor
                                                    if cfg.auto_switch_on_quota {
                                                        let switch_threshold = cfg.auto_switch_threshold_percentage.max(5) as i32;
                                                        let is_critical_runway = estimated_runway_mins.map_or(false, |r| r <= 2.5 && r > 0.0);
                                                        let is_weekly_exhausted = refreshed_acc.quota.as_ref().map_or(false, |q| q.has_weekly_limit_hit() || q.is_gemini_exhausted());
                                                        let is_hard_floor = new_min <= 5 || is_weekly_exhausted;
                                                        let is_burst_danger = new_min <= 10 && is_heavy_burst;

                                                        if (new_min <= switch_threshold || is_weekly_exhausted) && (is_critical_runway || is_hard_floor || is_burst_danger) {
                                                            if now - last_auto_switch_time >= 60 {
                                                                if let Ok(all_accs) = crate::modules::account::list_accounts() {
                                                                    let mut candidates: Vec<_> = all_accs
                                                                        .into_iter()
                                                                        .filter(|a| {
                                                                            a.id != refreshed_acc.id
                                                                                && !a.disabled
                                                                                && !a.proxy_disabled
                                                                                && !a.validation_blocked
                                                                                && a.quota.as_ref().map_or(false, |q| {
                                                                                    !q.is_forbidden && !q.has_weekly_limit_hit() && !q.is_gemini_exhausted()
                                                                                })
                                                                        })
                                                                        .collect();

                                                                    candidates.sort_by(|a, b| {
                                                                        let pct_b = b.quota.as_ref().map_or(0, |q| q.get_gemini_min_percentage());
                                                                        let pct_a = a.quota.as_ref().map_or(0, |q| q.get_gemini_min_percentage());
                                                                        pct_b.cmp(&pct_a)
                                                                    });

                                                                    if let Some(best_cand) = candidates.first() {
                                                                        let cand_pct = best_cand.quota.as_ref().map_or(0, |q| q.get_gemini_min_percentage());
                                                                        if cand_pct > new_min && cand_pct > 15 {
                                                                            logger::log_info(&format!(
                                                                                "[Scheduler] ⚡ PREEMPTIVE AUTO-SWITCH TRIGGERED: {} at {}% (runway: {:.1}m, weekly_exhausted: {}, heavy_burst: {}). Handing over to standby: {} at {}%.",
                                                                                refreshed_acc.email, new_min, estimated_runway_mins.unwrap_or(0.0), is_weekly_exhausted, is_heavy_burst, best_cand.email, cand_pct
                                                                            ));
                                                                            last_auto_switch_time = now;

                                                                            let sys_manager = match app_handle_for_daemon.as_ref() {
                                                                                Some(app) => crate::modules::integration::SystemManager::Desktop(app.clone()),
                                                                                None => crate::modules::integration::SystemManager::Headless,
                                                                            };
                                                                            let service = crate::modules::account_service::AccountService::new(sys_manager);

                                                                            if let Err(e) = service.switch_account(&best_cand.id, Some("ide")).await {
                                                                                logger::log_error(&format!("[Scheduler] Preemptive auto-switch execution failed: {}", e));
                                                                            } else {
                                                                                if let Some(ref app) = app_handle_for_daemon {
                                                                                    crate::modules::tray::update_tray_menus(app);
                                                                                }

                                                                                let inst_lock = proxy_state_for_daemon.instance.read().await;
                                                                                if let Some(instance) = inst_lock.as_ref() {
                                                                                    let _ = instance.token_manager.reload_account(&best_cand.id).await;
                                                                                }
                                                                                drop(inst_lock);

                                                                                if let Some(ref app) = app_handle_for_daemon {
                                                                                    use tauri::Emitter;
                                                                                    let _ = app.emit("auto-switch-executed", serde_json::json!({
                                                                                        "from_id": refreshed_acc.id,
                                                                                        "from_email": refreshed_acc.email,
                                                                                        "from_pct": new_min,
                                                                                        "to_id": best_cand.id,
                                                                                        "to_email": best_cand.email,
                                                                                        "to_pct": cand_pct,
                                                                                        "runway_mins": estimated_runway_mins.unwrap_or(0.0),
                                                                                        "reason": if is_weekly_exhausted {
                                                                                            "Google Gemini weekly limit reached (0% remaining)".to_string()
                                                                                        } else if is_critical_runway {
                                                                                            format!("Estimated runway exhausted ({:.1} min remaining)", estimated_runway_mins.unwrap_or(0.0))
                                                                                        } else if is_burst_danger {
                                                                                            "High-concurrency token burst nearing exhaustion (<10%)".to_string()
                                                                                        } else {
                                                                                            format!("Quota reached critical safety floor ({}%)", new_min)
                                                                                        }
                                                                                    }));
                                                                                }
                                                                            }
                                                                        } else {
                                                                            logger::log_warn(&format!(
                                                                                "[Scheduler] Preemptive auto-switch desired for {}, but best candidate {} only has {}% quota.",
                                                                                refreshed_acc.email, best_cand.email, cand_pct
                                                                            ));
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }

                                            let instance_lock = proxy_state_for_daemon.instance.read().await;
                                            if let Some(instance) = instance_lock.as_ref() {
                                                let _ = instance.token_manager.reload_account(&acc_to_refresh.id).await;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // A2. Standard Fleet Quota Auto-Refresh
            if cfg.auto_refresh && cfg.refresh_interval > 0 {
                let interval_secs = (cfg.refresh_interval as i64) * 60;
                // Add randomized human jitter (15 to 35 seconds) to eliminate bot timing signatures
                let jitter = 15 + (now % 21);
                let target_interval = interval_secs + jitter;

                if now - last_quota_refresh >= target_interval {
                    logger::log_info(&format!(
                        "[Scheduler] Native daemon executing scheduled quota refresh (interval: {}m + jitter: {}s)...",
                        cfg.refresh_interval, jitter
                    ));
                    last_quota_refresh = now;

                    let _ = crate::commands::refresh_all_quotas_internal(
                        &proxy_state_for_daemon,
                        app_handle_for_daemon.clone(),
                    )
                    .await;
                }
            }

            // B. Account DB Auto-Sync
            if cfg.auto_sync && cfg.sync_interval > 0 {
                let sync_interval_secs = (cfg.sync_interval as i64) * 60;
                if now - last_db_sync >= sync_interval_secs {
                    last_db_sync = now;
                    let _ = crate::commands::sync_account_from_db_internal(
                        app_handle_for_daemon.as_ref(),
                        &proxy_state_for_daemon,
                    )
                    .await;
                }
            }
        }
    });

    // 4. Spawn Active CLI Token Proactive Keep-Alive Daemon
    tauri::async_runtime::spawn(async move {
        logger::log_info("[Scheduler] Active CLI Session Keep-Alive Daemon started.");
        // Delay slightly on startup (12s) to allow proxy and network init
        time::sleep(Duration::from_secs(12)).await;

        loop {
            maintain_active_cli_session().await;
            // Check every 2 minutes (120 seconds)
            time::sleep(Duration::from_secs(120)).await;
        }
    });
}

/// Proactively monitors and refreshes the token of the currently active CLI account
/// to ensure the system keyring and credentials files never carry an expired access token.
/// This prevents Antigravity CLI (`agy`) from encountering network timeouts during internal token refreshes.
pub async fn maintain_active_cli_session() {
    let active_targets = match crate::modules::account::get_active_target_accounts() {
        Ok(t) => t,
        Err(e) => {
            logger::log_warn(&format!("[Scheduler] CLI Keep-Alive failed to resolve active targets: {}", e));
            return;
        }
    };

    let target_account_id = active_targets.agy.or_else(|| {
        crate::modules::account::get_current_account_id().ok().flatten()
    });

    let Some(account_id) = target_account_id else {
        return;
    };

    let mut account = match crate::modules::account::load_account(&account_id) {
        Ok(acc) => acc,
        Err(_) => return,
    };

    if account.validation_blocked {
        return;
    }

    let now = chrono::Utc::now().timestamp();
    // Google tokens expire in 3600s. If within 15 minutes (900s) of expiry or already expired:
    let needs_refresh = account.token.expiry_timestamp <= now + 900;

    if needs_refresh {
        let remaining_secs = account.token.expiry_timestamp - now;
        logger::log_info(&format!(
            "[Scheduler] Active CLI token for {} expiring soon (validity: {}s). Proactively refreshing...",
            account.email, remaining_secs
        ));

        match crate::modules::oauth::ensure_fresh_token(&account.token, Some(&account.id)).await {
            Ok(fresh_token) => {
                let updated = fresh_token.access_token != account.token.access_token
                    || fresh_token.expiry_timestamp != account.token.expiry_timestamp;

                if updated {
                    account.token = fresh_token;
                    if let Err(e) = crate::modules::account::save_account(&account) {
                        logger::log_warn(&format!(
                            "[Scheduler] Failed to save proactively refreshed account {}: {}",
                            account.email, e
                        ));
                    }

                    if let Err(e) = crate::modules::integration::write_to_system_keyring(&account) {
                        logger::log_warn(&format!(
                            "[Scheduler] Failed to sync refreshed token to system keyring for {}: {}",
                            account.email, e
                        ));
                    }

                    let _ = crate::modules::integration::write_to_file_credentials(&account);

                    logger::log_info(&format!(
                        "[Scheduler] Proactive CLI token refresh succeeded for {}. Keyring and credentials updated.",
                        account.email
                    ));
                }
            }
            Err(e) => {
                logger::log_warn(&format!(
                    "[Scheduler] Proactive CLI token refresh failed for {}: {}",
                    account.email, e
                ));
            }
        }
    }
}

/// Execute a single check-and-warmup cycle across all accounts
async fn run_warmup_cycle(
    app_handle: Option<tauri::AppHandle>,
    proxy_state: crate::commands::proxy::ProxyServiceState,
) {
    // Load configuration
    let Ok(app_config) = config::load_app_config() else {
        return;
    };

    // Must be enabled by user in Settings
    if !app_config.scheduled_warmup.enabled {
        return;
    }

    let Ok(accounts) = account::list_accounts() else {
        return;
    };

    if accounts.is_empty() {
        return;
    }

    let now_ts = Utc::now().timestamp();
    let mut tasks_to_run = Vec::new();

    for acc in &accounts {
        if acc.disabled || acc.proxy_disabled {
            continue;
        }

        let Ok((token, pid)) = quota::get_valid_token_for_warmup(acc).await else {
            continue;
        };

        let Ok((fresh_quota, _)) = quota::fetch_quota_with_cache(
            &token,
            &acc.email,
            Some(&pid),
            Some(&acc.id),
        )
        .await
        else {
            continue;
        };

        if fresh_quota.is_forbidden {
            continue;
        }

        // Check quota_groups for WEEKLY and 5H buckets
        if let Some(groups) = &fresh_quota.quota_groups {
            for group in groups {
                let g_name = group.display_name.to_lowercase();
                let is_claude = g_name.contains("claude") || g_name.contains("gpt");

                // Check if weekly quota for this group is exhausted (avoids HTTP 429 INSUFFICIENT_G1_CREDITS_BALANCE)
                let weekly_exhausted = group.buckets.iter().any(|b| {
                    let w = b.window.to_lowercase();
                    let id = b.bucket_id.to_lowercase();
                    let desc = b.description.to_lowercase();
                    ((w.contains("week") || id.contains("week")) && b.remaining_fraction <= 0.001)
                        || desc.contains("hit your weekly limit")
                        || desc.contains("weekly limit does not currently apply")
                });

                for bucket in &group.buckets {
                    let is_weekly = bucket.window.to_lowercase().contains("week")
                        || bucket.bucket_id.to_lowercase().contains("week");
                    let is_5h = bucket.window.to_lowercase().contains("5h")
                        || bucket.bucket_id.to_lowercase().contains("5h")
                        || bucket.window.to_lowercase().contains("rolling");

                    if !is_weekly && !is_5h {
                        continue;
                    }

                    // Guard: Never attempt 5h warmup if weekly quota is depleted (causes HTTP 429)
                    if is_5h && weekly_exhausted {
                        continue;
                    }

                    // If fraction is 1.0 (100% full)
                    if bucket.remaining_fraction >= 0.999 {
                        let (should_warm, history_key) = if is_weekly {
                            if let Some(reset_ts) = parse_reset_time_ts(&bucket.reset_time) {
                                // Weekly: check if reset_time reached (with 1 min buffer)
                                if now_ts >= reset_ts - 60 {
                                    let key = format!(
                                        "{}:{}:weekly:{}",
                                        acc.email, bucket.bucket_id, reset_ts
                                    );
                                    (!check_cooldown(&key, 6 * 86400), key)
                                } else {
                                    (false, String::new())
                                }
                            } else {
                                (false, String::new())
                            }
                        } else {
                            // 5-hour rolling:
                            // Check if rolling countdown is already active
                            let desc = bucket.description.to_lowercase();
                            let is_actively_rolling = desc.contains("you have used some of your 5-hour limit")
                                || desc.contains("will fully refresh in");

                            // If account is cold/unconsumed, use 600s (10m) retry backoff instead of locking out for 4.5h.
                            // If actively rolling, enforce 4.5h (16200s) cooldown.
                            let cooldown_duration = if is_actively_rolling { 16200 } else { 600 };
                            let key = format!("{}:{}:5h", acc.email, bucket.bucket_id);
                            (!check_cooldown(&key, cooldown_duration), key)
                        };

                        if should_warm && !history_key.is_empty() {
                            let model_to_ping = quota::resolve_warmup_model(&fresh_quota, is_claude);

                            tasks_to_run.push((
                                acc.id.clone(),
                                acc.email.clone(),
                                model_to_ping,
                                token.clone(),
                                pid.clone(),
                                history_key,
                            ));
                        }
                    }
                }
            }
        } else {
            // Fallback to models if quota_groups is not populated
            for model in &fresh_quota.models {
                if model.percentage == 100 {
                    if !app_config
                        .scheduled_warmup
                        .monitored_models
                        .contains(&model.name)
                    {
                        continue;
                    }
                    if let Some(reset_ts) = parse_reset_time_ts(&model.reset_time) {
                        if now_ts >= reset_ts - 60 {
                            let history_key = format!(
                                "{}:{}:weekly:{}",
                                acc.email, model.name, reset_ts
                            );
                            if !check_cooldown(&history_key, 6 * 86400) {
                                tasks_to_run.push((
                                    acc.id.clone(),
                                    acc.email.clone(),
                                    model.name.clone(),
                                    token.clone(),
                                    pid.clone(),
                                    history_key,
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    // Execute warmup tasks
    if !tasks_to_run.is_empty() {
        logger::log_info(&format!(
            "[Scheduler] 🎯 Reached reset threshold for {} account targets. Triggering warmup...",
            tasks_to_run.len()
        ));

        let handle_for_warmup = app_handle.clone();
        let state_for_warmup = proxy_state.clone();

        tokio::spawn(async move {
            let mut any_success = false;
            for (acc_id, email, model, token, pid, history_key) in tasks_to_run {
                logger::log_info(&format!(
                    "[WeeklyWarmup] 🚀 Triggering warmup for {} @ {}",
                    model, email
                ));

                let success = quota::warmup_model_directly(
                    &token,
                    &model,
                    &pid,
                    &email,
                    100,
                    Some(&acc_id),
                )
                .await;

                let now = Utc::now().timestamp();
                if success {
                    any_success = true;
                    record_warmup_history(&history_key, now);
                    logger::log_info(&format!(
                        "[WeeklyWarmup] ✅ Successfully warmed {} @ {}",
                        model, email
                    ));
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(3000 + ((now as u64) % 2500))).await;
            }

            if any_success {
                // Refresh UI and quotas
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                let _ = crate::commands::refresh_all_quotas_internal(
                    &state_for_warmup,
                    handle_for_warmup,
                )
                .await;
            }
        });
    }

    // Regularly clean up history (keep last 30 days)
    {
        let now_ts = Utc::now().timestamp();
        let cutoff = now_ts - 30 * 86400;
        let pruned_snapshot = {
            let mut history = WARMUP_HISTORY.lock().unwrap();
            history.retain(|_, &mut ts| ts > cutoff);
            history.clone()
        };
        save_warmup_history(&pruned_snapshot);
    }
}

/// Trigger immediate smart warmup check for a single account (e.g. on manual trigger / recovered event / after login)
pub async fn trigger_warmup_for_account(account: &Account) {
    let Ok((token, pid)) = quota::get_valid_token_for_warmup(account).await else {
        return;
    };

    let Ok((fresh_quota, _)) =
        quota::fetch_quota_with_cache(&token, &account.email, Some(&pid), Some(&account.id)).await
    else {
        return;
    };

    if fresh_quota.is_forbidden {
        return;
    }

    let Ok(app_config) = config::load_app_config() else {
        return;
    };

    if !app_config.scheduled_warmup.enabled {
        return;
    }

    let now_ts = Utc::now().timestamp();
    let mut any_warmed = false;

    if let Some(groups) = &fresh_quota.quota_groups {
        for group in groups {
            let g_name = group.display_name.to_lowercase();
            let is_claude = g_name.contains("claude") || g_name.contains("gpt");

            // Check if weekly quota for this group is exhausted (avoids HTTP 429 INSUFFICIENT_G1_CREDITS_BALANCE)
            let weekly_exhausted = group.buckets.iter().any(|b| {
                let w = b.window.to_lowercase();
                let id = b.bucket_id.to_lowercase();
                let desc = b.description.to_lowercase();
                ((w.contains("week") || id.contains("week")) && b.remaining_fraction <= 0.001)
                    || desc.contains("hit your weekly limit")
                    || desc.contains("weekly limit does not currently apply")
            });

            for bucket in &group.buckets {
                let is_weekly = bucket.window.to_lowercase().contains("week")
                    || bucket.bucket_id.to_lowercase().contains("week");
                let is_5h = bucket.window.to_lowercase().contains("5h")
                    || bucket.bucket_id.to_lowercase().contains("5h")
                    || bucket.window.to_lowercase().contains("rolling");

                if !is_weekly && !is_5h {
                    continue;
                }

                // Guard: Never attempt 5h warmup if weekly quota is depleted (causes HTTP 429)
                if is_5h && weekly_exhausted {
                    continue;
                }

                // If quota is recovered to 100% (fraction >= 0.999)
                if bucket.remaining_fraction >= 0.999 {
                    let (should_warm, history_key, cycle_type) = if is_weekly {
                        if let Some(reset_ts) = parse_reset_time_ts(&bucket.reset_time) {
                            if now_ts >= reset_ts - 60 {
                                let key = format!(
                                    "{}:{}:weekly:{}",
                                    account.email, bucket.bucket_id, reset_ts
                                );
                                (!check_cooldown(&key, 6 * 86400), key, "weekly")
                            } else {
                                (false, String::new(), "weekly")
                            }
                        } else {
                            (false, String::new(), "weekly")
                        }
                    } else {
                        // 5-hour rolling bucket:
                        let desc = bucket.description.to_lowercase();
                        let is_actively_rolling = desc.contains("you have used some of your 5-hour limit")
                            || desc.contains("will fully refresh in");
                        let cooldown_duration = if is_actively_rolling { 16200 } else { 600 };
                        let key = format!("{}:{}:5h", account.email, bucket.bucket_id);
                        (!check_cooldown(&key, cooldown_duration), key, "5h")
                    };

                    if should_warm && !history_key.is_empty() {
                        let model_to_ping = quota::resolve_warmup_model(&fresh_quota, is_claude);

                        let success = quota::warmup_model_directly(
                            &token,
                            &model_to_ping,
                            &pid,
                            &account.email,
                            100,
                            Some(&account.id),
                        )
                        .await;

                        if success {
                            any_warmed = true;
                            record_warmup_history(&history_key, now_ts);
                            logger::log_info(&format!(
                                "[AutoWarmup] ✅ Successfully auto-warmed {} ({} cycle) for {}",
                                model_to_ping, cycle_type, account.email
                            ));
                        }
                    }
                }
            }
        }
    } else {
        // Fallback to models list when quota_groups is not populated
        let target_models = quota::select_target_warmup_models(&fresh_quota.models);
        for m in target_models {
            let history_key = format!("{}:{}:100", account.email, m.name);
            if !check_cooldown(&history_key, 16200) {
                let success = quota::warmup_model_directly(
                    &token,
                    &m.name,
                    &pid,
                    &account.email,
                    100,
                    Some(&account.id),
                )
                .await;
                if success {
                    any_warmed = true;
                    record_warmup_history(&history_key, now_ts);
                    logger::log_info(&format!(
                        "[AutoWarmup] ✅ Successfully auto-warmed {} for {}",
                        m.name, account.email
                    ));
                }
            }
        }
    }

    if any_warmed {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        let mut acc_clone = account.clone();
        if let Ok(quota) = crate::modules::account::fetch_quota_with_retry(&mut acc_clone).await {
            let _ = crate::modules::account::update_account_quota(&account.id, quota);
            logger::log_info(&format!(
                "[AutoWarmup] 🔄 Quota refreshed after warmup for {}",
                account.email
            ));
        }
    }
}
