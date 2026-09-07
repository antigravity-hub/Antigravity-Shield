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
    let mut history = WARMUP_HISTORY.lock().unwrap();
    history.insert(key.to_string(), timestamp);
    save_warmup_history(&history);
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

/// Start smart weekly scheduler
pub fn start_scheduler(
    app_handle: Option<tauri::AppHandle>,
    proxy_state: crate::commands::proxy::ProxyServiceState,
) {
    tauri::async_runtime::spawn(async move {
        logger::log_info("[Scheduler] Weekly Reset Warmup Scheduler started. Monitoring 7-day quota windows...");

        // [HARDENED] Scan with randomized jitter to eliminate mechanical bot timing signatures
        loop {
            let jitter_secs = 270 + (chrono::Utc::now().timestamp() as u64 % 90);
            time::sleep(Duration::from_secs(jitter_secs)).await;

            // Load configuration
            let Ok(app_config) = config::load_app_config() else {
                continue;
            };

            // Must be enabled by user in Settings
            if !app_config.scheduled_warmup.enabled {
                continue;
            }

            let Ok(accounts) = account::list_accounts() else {
                continue;
            };

            if accounts.is_empty() {
                continue;
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

                // Check quota_groups for WEEKLY buckets
                if let Some(groups) = &fresh_quota.quota_groups {
                    for group in groups {
                        for bucket in &group.buckets {
                            let is_weekly = bucket.window.to_lowercase().contains("week")
                                || bucket.bucket_id.to_lowercase().contains("week");
                            if !is_weekly {
                                continue;
                            }

                            // If fraction is 1.0 (100% full)
                            if bucket.remaining_fraction >= 0.999 {
                                if let Some(reset_ts) = parse_reset_time_ts(&bucket.reset_time) {
                                    // Check if current time has passed reset_time (with 1 minute buffer)
                                    if now_ts >= reset_ts - 60 {
                                        let history_key = format!(
                                            "{}:{}:weekly:{}",
                                            acc.email, bucket.bucket_id, reset_ts
                                        );
                                        // 6-day cooldown for the same weekly cycle
                                        if !check_cooldown(&history_key, 6 * 86400) {
                                            // Pick representative model for this group
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

            // Execute weekly warmup tasks
            if !tasks_to_run.is_empty() {
                logger::log_info(&format!(
                    "[Scheduler] 🎯 Reached weekly reset for {} account targets. Triggering warmup...",
                    tasks_to_run.len()
                ));

                let handle_for_warmup = app_handle.clone();
                let state_for_warmup = proxy_state.clone();

                tokio::spawn(async move {
                    for (acc_id, email, model, token, pid, history_key) in tasks_to_run {
                        logger::log_info(&format!(
                            "[WeeklyWarmup] 🚀 Triggering weekly warmup for {} @ {}",
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
                            record_warmup_history(&history_key, now);
                            logger::log_info(&format!(
                                "[WeeklyWarmup] ✅ Successfully started weekly timer for {} @ {}",
                                model, email
                            ));
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(3000 + ((now as u64) % 2500))).await;
                    }

                    // Refresh UI
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    let _ = crate::commands::refresh_all_quotas_internal(
                        &state_for_warmup,
                        handle_for_warmup,
                    )
                    .await;
                });
            }

            // Regularly clean up history (keep last 30 days)
            {
                let now_ts = Utc::now().timestamp();
                let mut history = WARMUP_HISTORY.lock().unwrap();
                let cutoff = now_ts - 30 * 86400;
                history.retain(|_, &mut ts| ts > cutoff);
            }
        }
    });
}

/// Trigger immediate smart warmup check for a single account (e.g. on manual trigger / recovered event)
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
    if let Some(groups) = fresh_quota.quota_groups {
        for group in groups {
            for bucket in group.buckets {
                let is_weekly = bucket.window.to_lowercase().contains("week")
                    || bucket.bucket_id.to_lowercase().contains("week");
                if !is_weekly {
                    continue;
                }

                if bucket.remaining_fraction >= 0.999 {
                    if let Some(reset_ts) = parse_reset_time_ts(&bucket.reset_time) {
                        if now_ts >= reset_ts - 60 {
                            let history_key = format!(
                                "{}:{}:weekly:{}",
                                account.email, bucket.bucket_id, reset_ts
                            );
                            if !check_cooldown(&history_key, 6 * 86400) {
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
                                    record_warmup_history(&history_key, now_ts);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
