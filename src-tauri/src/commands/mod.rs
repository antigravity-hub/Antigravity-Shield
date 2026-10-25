// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use crate::models::{Account, AppConfig, QuotaData};
use crate::modules;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

// 导出 proxy 命令
pub mod proxy;
// 导出 autostart 命令
pub mod autostart;
// 导出 cloudflared 命令
pub mod cloudflared;
// 导出 security 命令 (IP 监控)
pub mod security;
// 导出 proxy_pool 命令
pub mod proxy_pool;
// 导出 user_token 命令
pub mod user_token;
// 导出 patch 命令
pub mod patch;
pub use patch::*;
// 导出 skills 命令
pub mod skills;

/// 列出所有account
#[tauri::command]
pub async fn list_accounts(
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
) -> Result<Vec<Account>, String> {
    let mut accounts = tokio::task::spawn_blocking(move || modules::list_accounts())
        .await
        .unwrap_or_else(|_| Err("Task panicked".to_string()))?;

    // [FIX] Blend in-memory TokenManager rate limit status into the UI quota display
    let instance_lock = proxy_state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        for account in &mut accounts {
            if let Some(reset_secs) = instance
                .token_manager
                .get_rate_limit_reset_seconds(&account.id)
            {
                if reset_secs > 0 {
                    if let Some(ref mut quota_data) = account.quota {
                        for model in &mut quota_data.models {
                            model.percentage = 0;
                            model.reset_time =
                                (chrono::Utc::now().timestamp() + reset_secs as i64).to_string();
                        }
                        // Optionally, add a UI flag if we want it to look completely blocked
                        // quota_data.is_forbidden = true;
                        // quota_data.forbidden_reason = Some(format!("Quota exhausted or rate limited (resets in {}s)", reset_secs));
                    }
                }
            }
        }
    }

    Ok(accounts)
}

/// Add account
#[tauri::command]
pub async fn add_account(
    app: tauri::AppHandle,
    _email: String,
    refresh_token: String,
) -> Result<Account, String> {
    let service = modules::account_service::AccountService::new(
        crate::modules::integration::SystemManager::Desktop(app.clone()),
    );

    let mut account = service.add_account(&refresh_token).await?;

    // 自动Refresh quota
    let _ = internal_refresh_account_quota(Some(&app), &mut account).await;

    // Check: 并自动预热（若处于100%恢复status）
    let account_for_warmup = account.clone();
    tokio::spawn(async move {
        crate::modules::scheduler::trigger_warmup_for_account(&account_for_warmup).await;
    });

    // 重载account池
    let _ = crate::commands::proxy::reload_proxy_accounts(
        app.state::<crate::commands::proxy::ProxyServiceState>(),
    )
    .await;

    Ok(account)
}

/// Delete: account
/// Delete: account
#[tauri::command]
pub async fn delete_account(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    account_id: String,
) -> Result<(), String> {
    let service = modules::account_service::AccountService::new(
        crate::modules::integration::SystemManager::Desktop(app.clone()),
    );
    service.delete_account(&account_id)?;

    // Reload token pool
    let _ = crate::commands::proxy::reload_proxy_accounts(proxy_state).await;

    Ok(())
}

/// 批量Delete account
#[tauri::command]
pub async fn delete_accounts(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    account_ids: Vec<String>,
) -> Result<(), String> {
    modules::logger::log_info(&format!(
        "收到批量deleterequest，共 {} 个account",
        account_ids.len()
    ));
    modules::account::delete_accounts(&account_ids).map_err(|e| {
        modules::logger::log_error(&format!("批量deletefailed: {}", e));
        e
    })?;

    // Force sync system tray
    crate::modules::tray::update_tray_menus(&app);

    // Reload token pool
    let _ = crate::commands::proxy::reload_proxy_accounts(proxy_state).await;

    Ok(())
}

/// Reorder account list
/// Reorders accounts according to the provided account ID array
#[tauri::command]
pub async fn reorder_accounts(
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    account_ids: Vec<String>,
) -> Result<(), String> {
    modules::logger::log_info(&format!(
        "收到account重排序request，共 {} 个account",
        account_ids.len()
    ));
    modules::account::reorder_accounts(&account_ids).map_err(|e| {
        modules::logger::log_error(&format!("account重排序failed: {}", e));
        e
    })?;

    // Reload pool to reflect new order if running
    let _ = crate::commands::proxy::reload_proxy_accounts(proxy_state).await;
    Ok(())
}

/// Switch account
#[tauri::command]
pub async fn switch_account(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    account_id: String,
    target_ide: Option<String>,
) -> Result<(), String> {
    let service = modules::account_service::AccountService::new(
        crate::modules::integration::SystemManager::Desktop(app.clone()),
    );

    service
        .switch_account(&account_id, target_ide.as_deref())
        .await?;

    // Sync system tray
    crate::modules::tray::update_tray_menus(&app);

    // [FIX #820] Notify proxy to clear stale session bindings and reload accounts
    let _ = crate::commands::proxy::reload_proxy_accounts(proxy_state).await;

    Ok(())
}

/// Get: currentaccount
#[tauri::command]
pub async fn get_current_account() -> Result<Option<Account>, String> {
    // println!("🚀 Backend Command: get_current_account called"); // Commented out to reduce noise for frequent calls, relies on frontend log for frequency
    // Actually user WANTS to see it.
    modules::logger::log_info("Backend Command: get_current_account called");

    let account_id = modules::get_current_account_id()?;

    if let Some(id) = account_id {
        // modules::logger::log_info(&format!("   Found current account ID: {}", id));
        modules::load_account(&id).map(Some)
    } else {
        modules::logger::log_info("   No current account set");
        Ok(None)
    }
}

/// Gets active account mapping across environments
#[tauri::command]
pub async fn get_active_target_accounts() -> Result<crate::models::ActiveTargetAccounts, String> {
    modules::account::get_active_target_accounts()
}

/// Exports accounts (including refresh_token)
use crate::models::AccountExportResponse;

#[tauri::command]
pub async fn export_accounts(account_ids: Vec<String>) -> Result<AccountExportResponse, String> {
    tokio::task::spawn_blocking(move || modules::account::export_accounts_by_ids(&account_ids))
        .await
        .unwrap_or_else(|_| Err("Task panicked".to_string()))
}

/// Internal helper: automatically triggers quota refresh after account addition or import
pub async fn internal_refresh_account_quota(
    app: Option<&tauri::AppHandle>,
    account: &mut Account,
) -> Result<QuotaData, String> {
    modules::logger::log_info(&format!("自动触发Refresh quota: {}", account.email));

    // Use retry-enabled query (shared logic)
    match modules::account::fetch_quota_with_retry(account).await {
        Ok(quota) => {
            // Update: accountquota
            let _ = modules::update_account_quota(&account.id, quota.clone());
            // Update system tray menu
            if let Some(h) = app {
                crate::modules::tray::update_tray_menus(h);
                use tauri::Emitter;
                let _ = h.emit("accounts://refreshed", ());
            }
            Ok(quota)
        }
        Err(e) => {
            modules::logger::log_warn(&format!("自动Refresh quotafailed ({}): {}", account.email, e));
            Err(e.to_string())
        }
    }
}

/// Queries quota for a specified account
#[tauri::command]
pub async fn fetch_account_quota(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    account_id: String,
) -> crate::error::AppResult<QuotaData> {
    modules::logger::log_info(&format!("手动Refresh quotarequest: {}", account_id));
    let mut account =
        modules::load_account(&account_id).map_err(crate::error::AppError::Account)?;

    // Use retry-enabled query (shared logic)
    let mut quota = modules::account::fetch_quota_with_retry(&mut account).await?;

    // 4. Update accountquota
    modules::update_account_quota(&account_id, quota.clone())
        .map_err(crate::error::AppError::Account)?;

    crate::modules::tray::update_tray_menus(&app);

    // 5. 同步到运行中的反代service（如果已启动）
    let instance_lock = proxy_state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        if quota.models.iter().any(|model| model.percentage > 0) {
            instance.token_manager.clear_rate_limit_memory(&account_id);
        }
        let _ = instance.token_manager.reload_account(&account_id).await;

        // Blend TokenManager lockout state only for models that are still 0%
        if let Some(reset_secs) = instance
            .token_manager
            .get_rate_limit_reset_seconds(&account_id)
        {
            if reset_secs > 0 {
                for model in &mut quota.models {
                    if model.percentage == 0 {
                        model.reset_time =
                            (chrono::Utc::now().timestamp() + reset_secs as i64).to_string();
                    }
                }
            }
        }
    }

    // 6. check并自动预热（若处于100%恢复status）
    let account_for_warmup = account.clone();
    tokio::spawn(async move {
        crate::modules::scheduler::trigger_warmup_for_account(&account_for_warmup).await;
    });

    Ok(quota)
}

pub use modules::account::RefreshStats;

/// Refreshes quotas for all accounts (internal implementation)
pub async fn refresh_all_quotas_internal(
    proxy_state: &crate::commands::proxy::ProxyServiceState,
    app_handle: Option<tauri::AppHandle>,
) -> Result<RefreshStats, String> {
    let stats = modules::account::refresh_all_quotas_logic().await?;

    // Synchronize到运行中的反代service（如果已启动）
    let instance_lock = proxy_state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        let _ = instance.token_manager.reload_all_accounts().await;
    }

    // Emit global refresh event to frontend UI
    if let Some(handle) = app_handle {
        use tauri::Emitter;
        let _ = handle.emit("accounts://refreshed", ());
    }

    Ok(stats)
}

/// Refreshes quotas for all accounts (Tauri Command)
#[tauri::command]
pub async fn refresh_all_quotas(
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    app_handle: tauri::AppHandle,
) -> Result<RefreshStats, String> {
    refresh_all_quotas_internal(&proxy_state, Some(app_handle)).await
}
/// Gets device fingerprint (current storage.json + account bindings)
#[tauri::command]
pub async fn get_device_profiles(
    account_id: String,
) -> Result<modules::account::DeviceProfiles, String> {
    modules::get_device_profiles(&account_id)
}

/// Binds device fingerprint (capture: current; generate: new) and writes to storage.json
#[tauri::command]
pub async fn bind_device_profile(
    account_id: String,
    mode: String,
) -> Result<crate::models::DeviceProfile, String> {
    modules::bind_device_profile(&account_id, &mode)
}

/// Previews a newly generated fingerprint without disk write
#[tauri::command]
pub async fn preview_generate_profile() -> Result<crate::models::DeviceProfile, String> {
    Ok(crate::modules::device::generate_profile())
}

/// Binds directly using a provided fingerprint
#[tauri::command]
pub async fn bind_device_profile_with_profile(
    account_id: String,
    profile: crate::models::DeviceProfile,
) -> Result<crate::models::DeviceProfile, String> {
    modules::bind_device_profile_with_profile(&account_id, profile, Some("generated".to_string()))
}

/// Applies account's bound fingerprint to storage.json
#[tauri::command]
pub async fn apply_device_profile(
    account_id: String,
) -> Result<crate::models::DeviceProfile, String> {
    modules::apply_device_profile(&account_id)
}

/// Restores earliest storage.json backup (pristine state)
#[tauri::command]
pub async fn restore_original_device() -> Result<String, String> {
    modules::restore_original_device()
}

/// Lists stored fingerprint versions
#[tauri::command]
pub async fn list_device_versions(
    account_id: String,
) -> Result<modules::account::DeviceProfiles, String> {
    modules::list_device_versions(&account_id)
}

/// Restores fingerprint by version identifier
#[tauri::command]
pub async fn restore_device_version(
    account_id: String,
    version_id: String,
) -> Result<crate::models::DeviceProfile, String> {
    modules::restore_device_version(&account_id, &version_id)
}

/// Deletes historical fingerprint (baseline is protected)
#[tauri::command]
pub async fn delete_device_version(account_id: String, version_id: String) -> Result<(), String> {
    modules::delete_device_version(&account_id, &version_id)
}

/// Opens device storage directory in system file manager
#[tauri::command]
pub async fn open_device_folder(app: tauri::AppHandle) -> Result<(), String> {
    let dir = modules::device::get_storage_dir()?;
    let dir_str = dir
        .to_str()
        .ok_or("Cannot resolve storage directory path as string")?
        .to_string();
    app.opener()
        .open_path(dir_str, None::<&str>)
        .map_err(|e| format!("Failed to open directory: {}", e))
}

/// Loads application configuration
#[tauri::command]
pub async fn load_config() -> Result<AppConfig, String> {
    modules::load_app_config()
}

/// Save: config
#[tauri::command]
pub async fn save_config(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    config: AppConfig,
) -> Result<(), String> {
    modules::save_app_config(&config)?;

    // Notify tray menu of config update
    let _ = app.emit("config://updated", ());

    // Hot-reload running proxy service
    let instance_lock = proxy_state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        // Update model routing mappings
        instance.axum_server.update_mapping(&config.proxy).await;
        // Update raw quota models exposure toggle
        instance
            .axum_server
            .update_only_raw_quota_models(config.proxy.only_raw_quota_models)
            .await;
        // Update upstream proxy configuration
        instance
            .axum_server
            .update_proxy(config.proxy.upstream_proxy.clone())
            .await;
        // Update security and authentication policy
        instance.axum_server.update_security(&config.proxy).await;
        // Update:  z.ai config
        instance.axum_server.update_zai(&config.proxy).await;
        // Update experimental configuration
        instance
            .axum_server
            .update_experimental(&config.proxy)
            .await;
        // Update debug logging configuration
        instance
            .axum_server
            .update_debug_logging(&config.proxy)
            .await;
        // [NEW] update User-Agent config
        instance.axum_server.update_user_agent(&config.proxy).await;
        // Update:  Thinking Budget configuration
        crate::proxy::update_thinking_budget_config(config.proxy.thinking_budget.clone());
        // [NEW] updateGlobal system prompt configuration
        crate::proxy::update_global_system_prompt_config(config.proxy.global_system_prompt.clone());
        // [NEW] Update global image thinking mode config
        crate::proxy::update_image_thinking_mode(config.proxy.image_thinking_mode.clone());
        // [NEW] update IDE Argon Override config
        crate::proxy::config::update_argon_override_config(config.proxy.ide_argon_override.clone());
        // [NEW] Update global tool result compression level
        crate::proxy::config::update_global_compression_level(
            config.proxy.experimental.compression_level.clone(),
            config.proxy.experimental.enable_usage_scaling,
        );
        crate::proxy::config::update_global_thresholds(
            config.proxy.experimental.context_compression_threshold_l1,
            config.proxy.experimental.context_compression_threshold_l2,
            config.proxy.experimental.context_compression_threshold_l3,
        );
        // Update proxy pool configuration
        instance
            .axum_server
            .update_proxy_pool(config.proxy.proxy_pool.clone())
            .await;
        // Update circuit breaker configuration
        instance
            .token_manager
            .update_circuit_breaker_config(config.circuit_breaker.clone())
            .await;
        tracing::debug!("已同步热update反代serviceconfig");
    }

    // Synchronize system auto-start status
    if let Ok(current_enabled) = autostart::is_auto_launch_enabled(app.clone()).await {
        if current_enabled != config.auto_launch {
            let _ = autostart::set_system_autostart(&app, config.auto_launch);
        }
    }

    Ok(())
}

// --- OAuth Commands ---

#[tauri::command]
pub async fn start_oauth_login(
    app_handle: tauri::AppHandle,
    oauth_client_key: Option<String>,
) -> Result<Account, String> {
    modules::logger::log_info("开始 OAuth 授权流程...");
    let service = modules::account_service::AccountService::new(
        crate::modules::integration::SystemManager::Desktop(app_handle.clone()),
    );

    let mut account = service.start_oauth_login(oauth_client_key).await?;

    // 自动触发刷新额度 (异步后台执行，避免阻塞前端UI或导致网络超时)
    let app_handle_quota = app_handle.clone();
    let mut account_quota = account.clone();
    tokio::spawn(async move {
        let _ = internal_refresh_account_quota(Some(&app_handle_quota), &mut account_quota).await;
    });

    // Reload token pool
    let _ = crate::commands::proxy::reload_proxy_accounts(
        app_handle.state::<crate::commands::proxy::ProxyServiceState>(),
    )
    .await;

    Ok(account)
}

/// Completes OAuth authorization (manual, without opening browser)
#[tauri::command]
pub async fn complete_oauth_login(app_handle: tauri::AppHandle) -> Result<Account, String> {
    modules::logger::log_info("完成 OAuth 授权流程 (manual)...");
    let service = modules::account_service::AccountService::new(
        crate::modules::integration::SystemManager::Desktop(app_handle.clone()),
    );

    let mut account = service.complete_oauth_login().await?;

    // 自动触发刷新额度 (异步后台执行，避免阻塞前端UI或导致网络超时)
    let app_handle_quota = app_handle.clone();
    let mut account_quota = account.clone();
    tokio::spawn(async move {
        let _ = internal_refresh_account_quota(Some(&app_handle_quota), &mut account_quota).await;
        crate::modules::scheduler::trigger_warmup_for_account(&account_quota).await;
    });

    // Reload token pool
    let _ = crate::commands::proxy::reload_proxy_accounts(
        app_handle.state::<crate::commands::proxy::ProxyServiceState>(),
    )
    .await;

    Ok(account)
}

/// Pre-generates OAuth authorization URL (without opening browser)
#[tauri::command]
pub async fn prepare_oauth_url(
    app_handle: tauri::AppHandle,
    oauth_client_key: Option<String>,
) -> Result<String, String> {
    let service = modules::account_service::AccountService::new(
        crate::modules::integration::SystemManager::Desktop(app_handle.clone()),
    );
    service.prepare_oauth_url(oauth_client_key).await
}

#[tauri::command]
pub async fn cancel_oauth_login() -> Result<(), String> {
    modules::oauth_server::cancel_oauth_flow();
    Ok(())
}

/// Manually submits OAuth Code (for Docker / headless environments)
#[tauri::command]
pub async fn submit_oauth_code(code: String, state: Option<String>) -> Result<(), String> {
    modules::logger::log_info("收到手动提交 OAuth Code request");
    modules::oauth_server::submit_oauth_code(code, state).await
}

#[tauri::command]
pub async fn list_oauth_clients(
) -> Result<Vec<crate::modules::oauth::OAuthClientDescriptor>, String> {
    crate::modules::oauth::list_oauth_clients()
}

#[tauri::command]
pub async fn get_active_oauth_client() -> Result<String, String> {
    crate::modules::oauth::get_active_oauth_client_key()
}

#[tauri::command]
pub async fn set_active_oauth_client(client_key: String) -> Result<(), String> {
    crate::modules::oauth::set_active_oauth_client_key(&client_key)
}

// --- Account Import Commands ---

#[tauri::command]
pub async fn import_v1_accounts(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
) -> Result<Vec<Account>, String> {
    let accounts = modules::migration::import_from_v1().await?;

    // 对导入的account尝试刷新一波
    for mut account in accounts.clone() {
        let _ = internal_refresh_account_quota(Some(&app), &mut account).await;
    }

    // Reload token pool
    let _ = crate::commands::proxy::reload_proxy_accounts(proxy_state).await;

    Ok(accounts)
}

#[tauri::command]
pub async fn import_from_db(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    target_ide: Option<String>,
) -> Result<Vec<Account>, String> {
    let imported_accounts =
        modules::migration::import_all_local_accounts(target_ide.as_deref()).await?;

    if let Some(first_acc) = imported_accounts.first() {
        let account_id = first_acc.id.clone();
        let _ = modules::account::set_current_account_id_with_target(
            &account_id,
            target_ide.as_deref(),
        );
    }

    for mut account in imported_accounts.clone() {
        let _ = internal_refresh_account_quota(Some(&app), &mut account).await;
    }

    crate::modules::tray::update_tray_menus(&app);
    let _ = crate::commands::proxy::reload_proxy_accounts(proxy_state).await;

    Ok(imported_accounts)
}

#[tauri::command]
#[allow(dead_code)]
pub async fn import_custom_db(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    path: String,
) -> Result<Account, String> {
    // 调用重构后的自定义导入函数
    let mut account = modules::migration::import_from_custom_db_path(path).await?;

    // 自动设为currentaccount
    let account_id = account.id.clone();
    modules::account::set_current_account_id(&account_id)?;

    // 自动触发刷新额度
    let _ = internal_refresh_account_quota(Some(&app), &mut account).await;

    // Refresh system tray icon display
    crate::modules::tray::update_tray_menus(&app);

    // Reload token pool
    let _ = crate::commands::proxy::reload_proxy_accounts(proxy_state).await;

    Ok(account)
}

/// Core synchronization logic (shared between Tauri command and Native Scheduler)
pub async fn sync_account_from_db_internal(
    app: Option<&tauri::AppHandle>,
    proxy_state: &crate::commands::proxy::ProxyServiceState,
) -> Result<Option<Account>, String> {
    // Check if the current target is one we should not sync (like agy CLI)
    let index = modules::account::load_account_index()?;
    let current_target = index.current_target_ide.as_deref();
    if current_target == Some("agy") {
        modules::logger::log_info("Auto-sync skipped: current target is agy CLI");
        return Ok(None);
    }

    // 1. Extract Refresh Token from DB
    let db_refresh_token = match modules::migration::get_refresh_token_from_db(current_target) {
        Ok(token) => token,
        Err(e) => {
            modules::logger::log_info(&format!("自动同步跳过: {}", e));
            return Ok(None);
        }
    };

    // 2. get Manager currentaccount
    let curr_account = modules::account::get_current_account()?;

    // 3. Compare: if Refresh Token matches, account is unchanged
    if let Some(acc) = curr_account {
        if acc.token.refresh_token == db_refresh_token {
            // account未变，直接return节省资源
            return Ok(None);
        }
        modules::logger::log_info(&format!(
            "检测到account切换 ({} -> DB新account)，正在同步...",
            acc.email
        ));
    } else {
        modules::logger::log_info("检测到新登录account，正在自动同步...");
    }

    // 4. Execute full account import
    let mut account = modules::migration::import_from_db(current_target).await?;

    // Auto-set imported account as current active account
    let account_id = account.id.clone();
    modules::account::set_current_account_id_with_target(&account_id, current_target)?;

    // Auto-refresh quota and notify UI
    let _ = internal_refresh_account_quota(app, &mut account).await;

    // Refresh system tray icon display
    if let Some(h) = app {
        crate::modules::tray::update_tray_menus(h);
    }

    // Reload token pool
    let _ = crate::commands::proxy::reload_proxy_accounts_state(proxy_state).await;

    Ok(Some(account))
}

#[tauri::command]
pub async fn sync_account_from_db(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
) -> Result<Option<Account>, String> {
    sync_account_from_db_internal(Some(&app), &proxy_state).await
}

fn resolve_existing_or_parent(path: &Path) -> Result<PathBuf, String> {
    if path.exists() {
        return path
            .canonicalize()
            .map_err(|e| format!("failed_to_resolve_path: {}", e));
    }

    let parent = path
        .parent()
        .ok_or_else(|| "invalid_path: missing parent directory".to_string())?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("failed_to_resolve_parent: {}", e))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "invalid_path: missing file name".to_string())?;
    Ok(canonical_parent.join(file_name))
}

fn is_sensitive_path(path: &Path) -> bool {
    let lower = path.to_string_lossy().to_ascii_lowercase();
    let sensitive_prefixes = [
        "/etc/",
        "/var/spool/cron",
        "/root/",
        "/proc/",
        "/sys/",
        "/dev/",
        "c:\\windows",
        "c:\\program files",
        "c:\\program files (x86)",
        "c:\\users\\administrator",
        "c:\\pagefile.sys",
    ];

    sensitive_prefixes
        .iter()
        .any(|prefix| lower == *prefix || lower.starts_with(prefix))
}

fn validate_user_json_path(path: &str, must_exist: bool) -> Result<PathBuf, String> {
    let requested = PathBuf::from(path);
    if requested.as_os_str().is_empty() {
        return Err("invalid_path: empty path".to_string());
    }
    if !requested.is_absolute() {
        return Err("invalid_path: absolute path is required".to_string());
    }

    let resolved = resolve_existing_or_parent(&requested)?;
    if is_sensitive_path(&resolved) {
        return Err("security_denied: sensitive system path is not allowed".to_string());
    }

    let is_json = resolved
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("json"))
        .unwrap_or(false);
    if !is_json {
        return Err("invalid_path: only .json files are allowed".to_string());
    }

    if must_exist {
        let metadata = std::fs::metadata(&resolved)
            .map_err(|e| format!("failed_to_read_file_metadata: {}", e))?;
        if !metadata.is_file() {
            return Err("invalid_path: expected a regular file".to_string());
        }
    }

    Ok(resolved)
}

/// Saves text file (bypassing frontend WebView scope restrictions)
#[tauri::command]
pub async fn save_text_file(path: String, content: String) -> Result<(), String> {
    let path = validate_user_json_path(&path, false)?;
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Reads text file (bypassing frontend WebView scope restrictions)
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let path = validate_user_json_path(&path, true)?;
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Clears application log cache
#[tauri::command]
pub async fn clear_log_cache() -> Result<(), String> {
    modules::logger::clear_logs()
}

/// Clears Antigravity application cache
/// Resolves authentication failures and version validation errors
#[tauri::command]
pub async fn clear_antigravity_cache() -> Result<modules::cache::ClearResult, String> {
    modules::cache::clear_antigravity_cache(None)
}

/// Gets list of Antigravity cache paths for preview
#[tauri::command]
pub async fn get_antigravity_cache_paths() -> Result<Vec<String>, String> {
    Ok(modules::cache::get_existing_cache_paths()
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

/// Opens application data directory
#[tauri::command]
pub async fn open_data_folder() -> Result<(), String> {
    let path = modules::account::get_data_dir()?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use crate::utils::command::CommandExtWrapper;
        std::process::Command::new("explorer")
            .creation_flags_windows()
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

/// Opens Antigravity Verification Guide PDF documentation
#[tauri::command]
pub async fn open_verification_guide_doc(app: tauri::AppHandle) -> Result<String, String> {
    const PDF_BYTES: &[u8] = include_bytes!("../../../public/guides/Antigravity_Verification_Guide.pdf");
    let temp_dir = std::env::temp_dir();
    let guide_path = temp_dir.join("Antigravity_Verification_Guide.pdf");

    let write_needed = match std::fs::metadata(&guide_path) {
        Ok(meta) => meta.len() != PDF_BYTES.len() as u64,
        Err(_) => true,
    };

    if write_needed {
        std::fs::write(&guide_path, PDF_BYTES)
            .map_err(|e| format!("Failed to extract guide PDF: {}", e))?;
    }

    let path_str = guide_path.to_string_lossy().to_string();

    // Prefer Tauri opener plugin to launch local PDF file
    if let Err(e) = app.opener().open_path(&path_str, None::<&str>) {
        tracing::warn!("Failed to open guide via tauri opener: {}, falling back to system command", e);

        #[cfg(target_os = "windows")]
        {
            use crate::utils::command::CommandExtWrapper;
            let _ = std::process::Command::new("cmd")
                .creation_flags_windows()
                .args(["/C", "start", "", &path_str])
                .spawn();
        }

        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open").arg(&path_str).spawn();
        }

        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open").arg(&path_str).spawn();
        }
    }

    Ok(path_str)
}

/// Gets absolute path to data directory
#[tauri::command]
pub async fn get_data_dir_path() -> Result<String, String> {
    let path = modules::account::get_data_dir()?;
    Ok(path.to_string_lossy().to_string())
}

/// Dispatches native system desktop notification
#[tauri::command]
pub async fn send_desktop_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    let config = crate::modules::config::load_app_config().unwrap_or_default();
    if config.overlay_notifications_enabled {
        let payload = crate::modules::overlay::OverlayNotificationPayload {
            notification_type: "toast".to_string(),
            title: title.clone(),
            message: body.clone(),
            model_name: None,
            current_email: None,
            target_email: None,
            target_quota_score: None,
            countdown_secs: None,
            target_account_id: None,
            target_env: None,
        };
        if let Err(e) = crate::modules::overlay::show_overlay_notification(&app, payload) {
            crate::modules::logger::log_warn(&format!(
                "[Notification] Overlay failed ({}), falling back to OS notification",
                e
            ));
            crate::modules::integration::show_os_notification(&title, &body);
        }
    } else {
        crate::modules::integration::show_os_notification(&title, &body);
    }
    Ok(())
}

/// Displays main application window
#[tauri::command]
pub async fn show_main_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())
}

/// Sets window theme (synchronizes Windows title bar button colors)
#[tauri::command]
pub async fn set_window_theme(window: tauri::Window, theme: String) -> Result<(), String> {
    use tauri::Theme;

    let tauri_theme = match theme.as_str() {
        "dark" => Some(Theme::Dark),
        "light" => Some(Theme::Light),
        _ => None, // system default
    };

    window.set_theme(tauri_theme).map_err(|e| e.to_string())
}

/// Gets Antigravity executable file path
#[tauri::command]
pub async fn get_antigravity_path(bypass_config: Option<bool>) -> Result<String, String> {
    // 1. Query from config first unless bypass is requested
    if bypass_config != Some(true) {
        if let Ok(config) = crate::modules::config::load_app_config() {
            if let Some(path) = config.antigravity_executable {
                if std::path::Path::new(&path).exists() {
                    return Ok(path);
                }
            }
        }
    }

    // 2. Perform live runtime detection
    match crate::modules::process::get_antigravity_executable_path(None) {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("Antigravity installation path not found".to_string()),
    }
}

/// Gets Antigravity CLI (agy) executable path
#[tauri::command]
pub async fn get_antigravity_cli_path(bypass_config: Option<bool>) -> Result<String, String> {
    // 1. Query from config first unless bypass is requested
    if bypass_config != Some(true) {
        if let Ok(config) = crate::modules::config::load_app_config() {
            if let Some(path) = config.antigravity_cli_executable {
                if std::path::Path::new(&path).exists() {
                    return Ok(path);
                }
            }
        }
    }

    // 2. Perform live runtime detection
    match crate::modules::process::get_antigravity_cli_executable_path() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("Antigravity CLI (agy) installation path not found".to_string()),
    }
}

/// Gets Antigravity process launch parameters
#[tauri::command]
pub async fn get_antigravity_args() -> Result<Vec<String>, String> {
    match crate::modules::process::get_args_from_running_process(None) {
        Some(args) => Ok(args),
        None => Err("Running Antigravity process not found".to_string()),
    }
}

/// Detects update response structure
pub use crate::modules::update_checker::UpdateInfo;

/// Checks for updates via GitHub Releases
#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    modules::logger::log_info("收到前端触发的updatecheckrequest");
    crate::modules::update_checker::check_for_updates().await
}

#[tauri::command]
pub async fn should_check_updates() -> Result<bool, String> {
    let settings = crate::modules::update_checker::load_update_settings()?;
    Ok(crate::modules::update_checker::should_check_for_updates(
        &settings,
    ))
}

#[tauri::command]
pub async fn update_last_check_time() -> Result<(), String> {
    crate::modules::update_checker::update_last_check_time()
}

/// Checks if installed via Homebrew Cask
#[tauri::command]
pub async fn check_homebrew_installation() -> Result<bool, String> {
    Ok(crate::modules::update_checker::is_homebrew_installed())
}

/// Checks if running as AppImage (Linux only)
/// Tauri native updater on Linux only supports AppImage;
/// RPM/DEB package users should not trigger auto-update to avoid ENOEXEC errors.
#[tauri::command]
pub async fn check_appimage_installation() -> Result<bool, String> {
    Ok(crate::modules::update_checker::is_appimage_running())
}

/// Upgrades application via Homebrew Cask
#[tauri::command]
pub async fn brew_upgrade_cask() -> Result<String, String> {
    modules::logger::log_info("收到前端触发的 Homebrew 升级request");
    crate::modules::update_checker::brew_upgrade_cask().await
}

/// Downloads installer and executes upgrade directly (fallback for signature checks)
#[tauri::command]
pub async fn download_and_install_direct(
    app: tauri::AppHandle,
    download_url: String,
    version: String,
) -> Result<(), String> {
    modules::logger::log_info(&format!(
        "收到前端触发的直接安装request: {} (v{})",
        download_url, version
    ));
    crate::modules::update_checker::download_and_run_installer(app, download_url, version).await
}


/// Get: updateset
#[tauri::command]
pub async fn get_update_settings() -> Result<crate::modules::update_checker::UpdateSettings, String>
{
    crate::modules::update_checker::load_update_settings()
}

/// Save: updateset
#[tauri::command]
pub async fn save_update_settings(
    settings: crate::modules::update_checker::UpdateSettings,
) -> Result<(), String> {
    crate::modules::update_checker::save_update_settings(&settings)
}

/// Toggles proxy disabled status for account
#[tauri::command]
pub async fn toggle_proxy_status(
    app: tauri::AppHandle,
    proxy_state: tauri::State<'_, crate::commands::proxy::ProxyServiceState>,
    account_id: String,
    enable: bool,
    reason: Option<String>,
) -> Result<(), String> {
    modules::logger::log_info(&format!(
        "Switch account反代status: {} -> {}",
        account_id,
        if enable { "enabled" } else { "disabled" }
    ));

    // 1. Read account file from disk
    let data_dir = modules::account::get_data_dir()?;
    let account_path = data_dir
        .join("accounts")
        .join(format!("{}.json", account_id));

    if !account_path.exists() {
        return Err(format!("Account file not found: {}", account_id));
    }

    let content =
        std::fs::read_to_string(&account_path).map_err(|e| format!("Failed to read account file: {}", e))?;

    let mut account_json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse account file: {}", e))?;

    // 2. Update proxy_disabled field
    if enable {
        // enabled反代
        account_json["proxy_disabled"] = serde_json::Value::Bool(false);
        account_json["proxy_disabled_reason"] = serde_json::Value::Null;
        account_json["proxy_disabled_at"] = serde_json::Value::Null;
    } else {
        // disabled反代
        let now = chrono::Utc::now().timestamp();
        account_json["proxy_disabled"] = serde_json::Value::Bool(true);
        account_json["proxy_disabled_at"] = serde_json::Value::Number(now.into());
        account_json["proxy_disabled_reason"] =
            serde_json::Value::String(reason.unwrap_or_else(|| "user手动disabled".to_string()));
    }

    // 3. Persist updated account to disk
    let json_str = serde_json::to_string_pretty(&account_json)
        .map_err(|e| format!("Failed to serialize account data: {}", e))?;
    std::fs::write(&account_path, json_str).map_err(|e| format!("Failed to write account file: {}", e))?;

    modules::logger::log_info(&format!(
        "account反代status已update: {} ({})",
        account_id,
        if enable { "已enabled" } else { "已disabled" }
    ));

    // 4. 如果反代service正在运行,立刻同步到内存池（避免disabled后仍被选中）
    {
        let instance_lock = proxy_state.instance.read().await;
        if let Some(instance) = instance_lock.as_ref() {
            // If disabled的是current固定account，则自动关闭固定模式（内存 + config持久化）
            if !enable {
                let pref_id = instance.token_manager.get_preferred_account().await;
                if pref_id.as_deref() == Some(&account_id) {
                    instance.token_manager.set_preferred_account(None).await;

                    if let Ok(mut cfg) = crate::modules::config::load_app_config() {
                        if cfg.proxy.preferred_account_id.as_deref() == Some(&account_id) {
                            cfg.proxy.preferred_account_id = None;
                            let _ = crate::modules::config::save_app_config(&cfg);
                        }
                    }
                }
            }

            instance
                .token_manager
                .reload_account(&account_id)
                .await
                .map_err(|e| format!("同步accountfailed: {}", e))?;
        }
    }

    // 5. Update system tray menu
    crate::modules::tray::update_tray_menus(&app);

    Ok(())
}

/// Warms up all eligible accounts
#[tauri::command]
pub async fn warm_up_all_accounts() -> Result<String, String> {
    modules::quota::warm_up_all_accounts().await
}

/// Warms up a specific account
#[tauri::command]
pub async fn warm_up_account(account_id: String) -> Result<String, String> {
    modules::quota::warm_up_account(&account_id).await
}

/// Update: accountCustom label
#[tauri::command]
pub async fn update_account_label(account_id: String, label: String) -> Result<(), String> {
    // Verify标签长度（按字符数计算，支持中文）
    if label.chars().count() > 15 {
        return Err("标签长度不能超过15个字符".to_string());
    }

    modules::logger::log_info(&format!(
        "Update account标签: {} -> {:?}",
        account_id,
        if label.is_empty() { "none" } else { &label }
    ));

    // 1. Read account file from disk
    let data_dir = modules::account::get_data_dir()?;
    let account_path = data_dir
        .join("accounts")
        .join(format!("{}.json", account_id));

    if !account_path.exists() {
        return Err(format!("Account file not found: {}", account_id));
    }

    let content =
        std::fs::read_to_string(&account_path).map_err(|e| format!("Failed to read account file: {}", e))?;

    let mut account_json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse account file: {}", e))?;

    // 2. update custom_label 字段
    if label.is_empty() {
        account_json["custom_label"] = serde_json::Value::Null;
    } else {
        account_json["custom_label"] = serde_json::Value::String(label.clone());
    }

    // 3. Persist updated account to disk
    let json_str = serde_json::to_string_pretty(&account_json)
        .map_err(|e| format!("Failed to serialize account data: {}", e))?;
    std::fs::write(&account_path, json_str).map_err(|e| format!("Failed to write account file: {}", e))?;

    modules::logger::log_info(&format!(
        "account标签已update: {} ({})",
        account_id,
        if label.is_empty() {
            "已清除".to_string()
        } else {
            label
        }
    ));

    Ok(())
}

/// Clear account validation blocked status
#[tauri::command]
pub async fn clear_account_validation(account_id: String) -> Result<(), String> {
    modules::account::set_account_validation_blocked(&account_id, false, None, None)
}

// ============================================================================
// HTTP API set命令
// ============================================================================

/// Get:  HTTP API set
#[tauri::command]
pub async fn get_http_api_settings() -> Result<crate::modules::http_api::HttpApiSettings, String> {
    crate::modules::http_api::load_settings()
}

/// Save:  HTTP API set
#[tauri::command]
pub async fn save_http_api_settings(
    settings: crate::modules::http_api::HttpApiSettings,
) -> Result<(), String> {
    crate::modules::http_api::save_settings(&settings)
}

// ============================================================================
// Token Statistics Commands
// ============================================================================

pub use crate::modules::token_stats::{AccountTokenStats, TokenStatsAggregated, TokenStatsSummary};

#[tauri::command]
pub async fn get_token_stats_hourly(hours: i64) -> Result<Vec<TokenStatsAggregated>, String> {
    crate::modules::token_stats::get_hourly_stats(hours)
}

#[tauri::command]
pub async fn get_token_stats_daily(days: i64) -> Result<Vec<TokenStatsAggregated>, String> {
    crate::modules::token_stats::get_daily_stats(days)
}

#[tauri::command]
pub async fn get_token_stats_weekly(weeks: i64) -> Result<Vec<TokenStatsAggregated>, String> {
    crate::modules::token_stats::get_weekly_stats(weeks)
}

#[tauri::command]
pub async fn get_token_stats_by_account(hours: i64) -> Result<Vec<AccountTokenStats>, String> {
    crate::modules::token_stats::get_account_stats(hours)
}

#[tauri::command]
pub async fn get_token_stats_summary(hours: i64) -> Result<TokenStatsSummary, String> {
    crate::modules::token_stats::get_summary_stats(hours)
}

#[tauri::command]
pub async fn get_token_stats_by_model(
    hours: i64,
) -> Result<Vec<crate::modules::token_stats::ModelTokenStats>, String> {
    crate::modules::token_stats::get_model_stats(hours)
}

#[tauri::command]
pub async fn get_token_stats_model_trend_hourly(
    hours: i64,
) -> Result<Vec<crate::modules::token_stats::ModelTrendPoint>, String> {
    crate::modules::token_stats::get_model_trend_hourly(hours)
}

#[tauri::command]
pub async fn get_token_stats_model_trend_daily(
    days: i64,
) -> Result<Vec<crate::modules::token_stats::ModelTrendPoint>, String> {
    crate::modules::token_stats::get_model_trend_daily(days)
}

#[tauri::command]
pub async fn get_token_stats_account_trend_hourly(
    hours: i64,
) -> Result<Vec<crate::modules::token_stats::AccountTrendPoint>, String> {
    crate::modules::token_stats::get_account_trend_hourly(hours)
}

#[tauri::command]
pub async fn get_token_stats_account_trend_daily(
    days: i64,
) -> Result<Vec<crate::modules::token_stats::AccountTrendPoint>, String> {
    crate::modules::token_stats::get_account_trend_daily(days)
}

#[tauri::command]
pub async fn get_token_horizon_metrics() -> Result<crate::modules::token_stats::TokenHorizonMetrics, String> {
    crate::modules::token_stats::get_token_horizon_metrics()
}

#[tauri::command]
pub async fn query_transit_info(url: String, key: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .bearer_auth(key)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;

    if status.is_success() {
        Ok(text)
    } else {
        Err(format!("HTTP {}: {}", status, text))
    }
}

#[tauri::command]
pub async fn scan_brain_conversations() -> Result<crate::modules::brain_scanner::BrainScanResult, String> {
    tokio::task::spawn_blocking(|| crate::modules::brain_scanner::scan_brain_conversations())
        .await
        .map_err(|e| e.to_string())?
}

// ============================================================================
// Antigravity Toolkit & IDE Integration Commands
// ============================================================================

#[tauri::command]
pub async fn get_toolkit_status() -> Result<crate::modules::ide_scanner::ToolkitConnectionStatus, String> {
    Ok(crate::modules::ide_scanner::get_connection_status())
}

#[tauri::command]
pub async fn detect_installed_ides() -> Result<Vec<crate::modules::ide_scanner::IdeInfo>, String> {
    tokio::task::spawn_blocking(crate::modules::ide_scanner::detect_all_ides)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_toolkit_to_ide(ide_id: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || crate::modules::ide_scanner::install_toolkit_to_ide(&ide_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn record_toolkit_heartbeat(
    payload: crate::modules::ide_scanner::ToolkitHeartbeatPayload,
) -> Result<(), String> {
    crate::modules::ide_scanner::record_heartbeat(payload);
    Ok(())
}

// ============================================================================
// Overlay Notification HUD Commands
// ============================================================================

#[tauri::command]
pub async fn show_overlay_notification(
    app: tauri::AppHandle,
    payload: crate::modules::overlay::OverlayNotificationPayload,
) -> Result<(), String> {
    crate::modules::overlay::show_overlay_notification(&app, payload)
}

#[tauri::command]
pub async fn hide_overlay_notification(app: tauri::AppHandle) -> Result<(), String> {
    crate::modules::overlay::hide_overlay_notification(&app)
}

#[tauri::command]
pub async fn get_overlay_payload() -> Option<crate::modules::overlay::OverlayNotificationPayload> {
    crate::modules::overlay::get_overlay_payload()
}

#[tauri::command]
pub async fn focus_target_app(target_ide: Option<String>) -> Result<(), String> {
    crate::modules::process::focus_antigravity(target_ide.as_deref())
}


