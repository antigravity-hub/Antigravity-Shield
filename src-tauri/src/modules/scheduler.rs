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
        let mut last_db_sync = 0i64;

        loop {
            // Check every 15 seconds against configured intervals
            time::sleep(Duration::from_secs(15)).await;

            let Ok(cfg) = config::load_app_config() else {
                continue;
            };

            let now = chrono::Utc::now().timestamp();

            // A. Quota Auto-Refresh
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
                        app_handle_for_daemon.as_ref(),
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
                for bucket in &group.buckets {
                    let is_weekly = bucket.window.to_lowercase().contains("week")
                        || bucket.bucket_id.to_lowercase().contains("week");
                    let is_5h = bucket.window.to_lowercase().contains("5h")
                        || bucket.bucket_id.to_lowercase().contains("5h")
                        || bucket.window.to_lowercase().contains("rolling");

                    if !is_weekly && !is_5h {
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
                            // 5-hour rolling: recovered to 100%, trigger warm if 4.5h cooldown passed
                            let key = format!("{}:{}:5h", acc.email, bucket.bucket_id);
                            (!check_cooldown(&key, 16200), key)
                        };

                        if should_warm && !history_key.is_empty() {
                            let model_to_ping = if bucket
                                .bucket_id
                                .contains("3p")
                                || group.display_name.contains("Claude")
                            {
                                "claude-sonnet-4-6".to_string()
                            } else {
                                "gemini-3-flash".to_string()
                            };

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
            for bucket in &group.buckets {
                let is_weekly = bucket.window.to_lowercase().contains("week")
                    || bucket.bucket_id.to_lowercase().contains("week");
                let is_5h = bucket.window.to_lowercase().contains("5h")
                    || bucket.bucket_id.to_lowercase().contains("5h")
                    || bucket.window.to_lowercase().contains("rolling");

                if !is_weekly && !is_5h {
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
                        // 5-hour rolling bucket: recovered to 100%, trigger warm if 4.5h cooldown passed
                        let key = format!("{}:{}:5h", account.email, bucket.bucket_id);
                        (!check_cooldown(&key, 16200), key, "5h")
                    };

                    if should_warm && !history_key.is_empty() {
                        let model_to_ping = if bucket.bucket_id.contains("3p")
                            || group.display_name.contains("Claude")
                        {
                            "claude-sonnet-4-6".to_string()
                        } else {
                            "gemini-3-flash".to_string()
                        };

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
