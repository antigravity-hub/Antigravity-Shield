// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use crate::proxy::monitor::{ProxyMonitor, ProxyRequestLog, ProxyStats};
use crate::proxy::{ProxyConfig, ProxyPoolConfig, TokenManager};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use tokio::time::Duration;

/// 反代servicestatus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
    pub base_url: String,
    pub active_accounts: usize,
}

/// 反代service全局status
#[derive(Clone)]
pub struct ProxyServiceState {
    pub instance: Arc<RwLock<Option<ProxyServiceInstance>>>,
    pub monitor: Arc<RwLock<Option<Arc<ProxyMonitor>>>>,
    pub admin_server: Arc<RwLock<Option<AdminServerInstance>>>, // [NEW] 常驻管理service器
    pub starting: Arc<AtomicBool>, // [NEW] 标识是否正在启动中，防止死锁
}

pub struct AdminServerInstance {
    pub axum_server: crate::proxy::AxumServer,
    #[allow(dead_code)] // 保留句柄以便未来支持显式停服/诊断
    pub server_handle: tokio::task::JoinHandle<()>,
}

/// 反代service实例
pub struct ProxyServiceInstance {
    pub config: ProxyConfig,
    pub token_manager: Arc<TokenManager>,
    pub axum_server: crate::proxy::AxumServer,
}

impl ProxyServiceState {
    pub fn new() -> Self {
        Self {
            instance: Arc::new(RwLock::new(None)),
            monitor: Arc::new(RwLock::new(None)),
            admin_server: Arc::new(RwLock::new(None)),
            starting: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// 启动反代service (Tauri 命令)
#[tauri::command]
pub async fn start_proxy_service(
    config: ProxyConfig,
    state: State<'_, ProxyServiceState>,
    cf_state: State<'_, crate::commands::cloudflared::CloudflaredState>,
    app_handle: tauri::AppHandle,
) -> Result<ProxyStatus, String> {
    internal_start_proxy_service(
        config,
        &state,
        crate::modules::integration::SystemManager::Desktop(app_handle),
        Arc::new(cf_state.inner().clone()),
    )
    .await
}

/// 启动反代service简写别名 (start_proxy)
#[tauri::command]
pub async fn start_proxy(
    config: ProxyConfig,
    state: State<'_, ProxyServiceState>,
    cf_state: State<'_, crate::commands::cloudflared::CloudflaredState>,
    app_handle: tauri::AppHandle,
) -> Result<ProxyStatus, String> {
    start_proxy_service(config, state, cf_state, app_handle).await
}

struct StartingGuard(Arc<AtomicBool>);
impl Drop for StartingGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// 内部启动反代service逻辑 (解耦版本)
pub async fn internal_start_proxy_service(
    config: ProxyConfig,
    state: &ProxyServiceState,
    integration: crate::modules::integration::SystemManager,
    cloudflared_state: Arc<crate::commands::cloudflared::CloudflaredState>,
) -> Result<ProxyStatus, String> {
    // 1. checkstatus并加锁
    {
        let instance_lock = state.instance.read().await;
        if instance_lock.is_some() {
            return Err("service已在运行中".to_string());
        }
    }

    // 2. check是否正在启动中 (防止死锁 & 并发启动)
    if state
        .starting
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("service正在启动中，请稍候...".to_string());
    }

    // 使用自定义 Drop guard 确保none论successfailed都会reset starting status
    let _starting_guard = StartingGuard(state.starting.clone());

    // Ensure monitor exists
    {
        let mut monitor_lock = state.monitor.write().await;
        if monitor_lock.is_none() {
            let app_handle =
                if let crate::modules::integration::SystemManager::Desktop(ref h) = integration {
                    Some(h.clone())
                } else {
                    None
                };
            *monitor_lock = Some(Arc::new(ProxyMonitor::new(1000, app_handle)));
        }
        // Sync enabled state from config
        if let Some(monitor) = monitor_lock.as_ref() {
            monitor.set_enabled(config.enable_logging);
        }
    }

    let _monitor = state.monitor.read().await.as_ref().unwrap().clone();

    // 檢查並啟動管理服務器（如果尚未運行）
    ensure_admin_server(
        config.clone(),
        state,
        integration.clone(),
        cloudflared_state.clone(),
    )
    .await?;

    // 2. [FIX] 复用管理service器的 Token 管理器 (单实例，解决热update同步问题)
    let token_manager = {
        let admin_lock = state.admin_server.read().await;
        admin_lock
            .as_ref()
            .unwrap()
            .axum_server
            .token_manager
            .clone()
    };

    // Synchronizeconfig到运行中的 TokenManager
    token_manager.start_auto_cleanup().await;
    token_manager
        .update_sticky_config(config.scheduling.clone())
        .await;

    // [NEW] 加载熔断config (从主config加载)
    let app_config = crate::modules::config::load_app_config()
        .unwrap_or_else(|_| crate::models::AppConfig::new());
    token_manager
        .update_circuit_breaker_config(app_config.circuit_breaker)
        .await;

    // 🆕 [FIX #820] 恢复固定account模式set
    if let Some(ref account_id) = config.preferred_account_id {
        token_manager
            .set_preferred_account(Some(account_id.clone()))
            .await;
        tracing::info!("🔒 [FIX #820] Fixed account mode restored: {}", account_id);
    }

    // 3. 加載賬號
    let active_accounts = token_manager.load_accounts().await.unwrap_or(0);

    if active_accounts == 0 {
        let zai_enabled = config.zai.enabled
            && !matches!(config.zai.dispatch_mode, crate::proxy::ZaiDispatchMode::Off);
        if !zai_enabled {
            tracing::warn!("沒有可用賬號，反代邏輯將暫停，請通過管理界面add。");
            return Ok(ProxyStatus {
                running: false,
                port: config.port,
                base_url: format!("http://127.0.0.1:{}", config.port),
                active_accounts: 0,
            });
        }
    }

    let mut instance_lock = state.instance.write().await;
    let admin_lock = state.admin_server.read().await;
    let axum_server = admin_lock
        .as_ref()
        .expect("admin server must exist after ensure_admin_server")
        .axum_server
        .clone();

    // 创建service实例（逻辑启动）。不再save假的 server_handle：
    // 监听任务的真实句柄已由 AdminServerInstance 持有（见 ensure_admin_server）。
    let instance = ProxyServiceInstance {
        config: config.clone(),
        token_manager: token_manager.clone(),
        axum_server: axum_server.clone(),
    };

    // [FIX] Ensure the server is logically running
    axum_server.set_running(true).await;

    *instance_lock = Some(instance);

    // Success启动后，guard 在这里结束并reset starting 是 OK 的
    // 但其实我们可以直接手动掉，或者相信 guard
    Ok(ProxyStatus {
        running: true,
        port: config.port,
        base_url: format!("http://127.0.0.1:{}", config.port),
        active_accounts,
    })
}

/// 确保管理service器正在运行
pub async fn ensure_admin_server(
    config: ProxyConfig,
    state: &ProxyServiceState,
    integration: crate::modules::integration::SystemManager,
    cloudflared_state: Arc<crate::commands::cloudflared::CloudflaredState>,
) -> Result<(), String> {
    let mut admin_lock = state.admin_server.write().await;
    if admin_lock.is_some() {
        return Ok(());
    }

    // Ensure monitor exists
    let monitor = {
        let mut monitor_lock = state.monitor.write().await;
        if monitor_lock.is_none() {
            let app_handle =
                if let crate::modules::integration::SystemManager::Desktop(ref h) = integration {
                    Some(h.clone())
                } else {
                    None
                };
            *monitor_lock = Some(Arc::new(ProxyMonitor::new(1000, app_handle)));
        }
        monitor_lock.as_ref().unwrap().clone()
    };

    // defaultempty TokenManager 用于管理界面
    let app_data_dir = crate::modules::account::get_data_dir()?;
    let token_manager = Arc::new(TokenManager::new(app_data_dir));
    // [NEW] 加载accountdata，otherwise管理界面统计为 0
    let _ = token_manager.load_accounts().await;

    let (axum_server, server_handle) = match crate::proxy::AxumServer::start(
        config.get_bind_address().to_string(),
        config.port,
        token_manager,
        config.custom_mapping.clone(),
        config.request_timeout,
        config.upstream_proxy.clone(),
        config.user_agent_override.clone(),
        crate::proxy::ProxySecurityConfig::from_proxy_config(&config),
        config.zai.clone(),
        monitor,
        config.experimental.clone(),
        config.debug_logging.clone(),
        integration.clone(),
        cloudflared_state,
        config.proxy_pool.clone(),
        config.only_raw_quota_models,
        config.image_scheduler.clone(),
    )
    .await
    {
        Ok((server, handle)) => (server, handle),
        Err(e) => return Err(format!("启动管理service器failed: {}", e)),
    };

    *admin_lock = Some(AdminServerInstance {
        axum_server,
        server_handle,
    });

    // [NEW] init全局 Thinking Budget configuration
    crate::proxy::update_thinking_budget_config(config.thinking_budget.clone());
    // [NEW] initGlobal system prompt configuration
    crate::proxy::update_global_system_prompt_config(config.global_system_prompt.clone());
    // [NEW] init全局图像思维模式config
    crate::proxy::update_image_thinking_mode(config.image_thinking_mode.clone());
    // [NEW] init全局压缩等级config
    crate::proxy::config::update_global_compression_level(
        config.experimental.compression_level.clone(),
        config.experimental.enable_usage_scaling,
    );
    // [NEW] init IDE Argon Override config
    crate::proxy::config::update_argon_override_config(config.ide_argon_override.clone());

    Ok(())
}

/// 停止反代service
#[tauri::command]
pub async fn stop_proxy_service(state: State<'_, ProxyServiceState>) -> Result<(), String> {
    let mut instance_lock = state.instance.write().await;

    if instance_lock.is_none() {
        return Err("service未运行".to_string());
    }

    // 停止 Axum service器 (仅逻辑停止，不杀死进程)
    if let Some(instance) = instance_lock.take() {
        instance.token_manager.abort_background_tasks().await;
        instance.axum_server.set_running(false).await;
        // 已移除 instance.axum_server.stop() 调用，防止杀死 Admin Server
    }

    Ok(())
}

/// 停止反代service简写别名 (stop_proxy)
#[tauri::command]
pub async fn stop_proxy(state: State<'_, ProxyServiceState>) -> Result<(), String> {
    stop_proxy_service(state).await
}

/// Get: 反代servicestatus
#[tauri::command]
pub async fn get_proxy_status(state: State<'_, ProxyServiceState>) -> Result<ProxyStatus, String> {
    // 优先check启动标志，避免被写锁阻塞
    if state.starting.load(Ordering::SeqCst) {
        return Ok(ProxyStatus {
            running: false, // 逻辑上还没运行
            port: 0,
            base_url: "starting".to_string(), // 给前端标识
            active_accounts: 0,
        });
    }

    // 使用 try_read 避免在该命令中产生产生排队延迟
    let lock_res = state.instance.try_read();

    match lock_res {
        Ok(instance_lock) => match instance_lock.as_ref() {
            Some(instance) => Ok(ProxyStatus {
                running: true,
                port: instance.config.port,
                base_url: format!("http://127.0.0.1:{}", instance.config.port),
                active_accounts: instance.token_manager.len(),
            }),
            None => Ok(ProxyStatus {
                running: false,
                port: 0,
                base_url: String::new(),
                active_accounts: 0,
            }),
        },
        Err(_) => {
            // If 拿不到锁，说明正在进行写操作（可能是正在启动或停止中）
            Ok(ProxyStatus {
                running: false,
                port: 0,
                base_url: "busy".to_string(),
                active_accounts: 0,
            })
        }
    }
}

/// Get: 反代service统计
#[tauri::command]
pub async fn get_proxy_stats(state: State<'_, ProxyServiceState>) -> Result<ProxyStats, String> {
    let monitor_lock = state.monitor.read().await;
    if let Some(monitor) = monitor_lock.as_ref() {
        Ok(monitor.get_stats().await)
    } else {
        Ok(ProxyStats::default())
    }
}

/// Get: 反代request日志
#[tauri::command]
pub async fn get_proxy_logs(
    state: State<'_, ProxyServiceState>,
    limit: Option<usize>,
) -> Result<Vec<ProxyRequestLog>, String> {
    let monitor_lock = state.monitor.read().await;
    if let Some(monitor) = monitor_lock.as_ref() {
        Ok(monitor.get_logs(limit.unwrap_or(100)).await)
    } else {
        Ok(Vec::new())
    }
}

/// Set监控开启status
#[tauri::command]
pub async fn set_proxy_monitor_enabled(
    state: State<'_, ProxyServiceState>,
    enabled: bool,
) -> Result<(), String> {
    let monitor_lock = state.monitor.read().await;
    if let Some(monitor) = monitor_lock.as_ref() {
        monitor.set_enabled(enabled);
    }
    Ok(())
}

/// 清除反代request日志
#[tauri::command]
pub async fn clear_proxy_logs(state: State<'_, ProxyServiceState>) -> Result<(), String> {
    let monitor_lock = state.monitor.read().await;
    if let Some(monitor) = monitor_lock.as_ref() {
        monitor.clear().await;
    }
    Ok(())
}

/// Get: 反代request日志 (分页)
#[tauri::command]
pub async fn get_proxy_logs_paginated(
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<ProxyRequestLog>, String> {
    crate::modules::proxy_db::get_logs_summary(limit.unwrap_or(20), offset.unwrap_or(0))
}

/// Get: 单条日志的完整详情
#[tauri::command]
pub async fn get_proxy_log_detail(log_id: String) -> Result<ProxyRequestLog, String> {
    crate::modules::proxy_db::get_log_detail(&log_id)
}

/// Get: 日志总数
#[tauri::command]
pub async fn get_proxy_logs_count() -> Result<u64, String> {
    crate::modules::proxy_db::get_logs_count()
}

/// 导出所有日志到指定文件
#[tauri::command]
pub async fn export_proxy_logs(file_path: String) -> Result<usize, String> {
    let logs = crate::modules::proxy_db::get_all_logs_for_export()?;
    let count = logs.len();

    let json = serde_json::to_string_pretty(&logs)
        .map_err(|e| format!("Failed to serialize logs: {}", e))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(count)
}

/// 导出指定的日志JSON到文件
#[tauri::command]
pub async fn export_proxy_logs_json(file_path: String, json_data: String) -> Result<usize, String> {
    // Parse to count items
    let logs: Vec<serde_json::Value> =
        serde_json::from_str(&json_data).map_err(|e| format!("Failed to parse JSON: {}", e))?;
    let count = logs.len();

    // Pretty print
    let pretty_json =
        serde_json::to_string_pretty(&logs).map_err(|e| format!("Failed to serialize: {}", e))?;

    std::fs::write(&file_path, pretty_json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(count)
}

/// Get: 带搜索条件的日志数量
#[tauri::command]
pub async fn get_proxy_logs_count_filtered(
    filter: String,
    errors_only: bool,
) -> Result<u64, String> {
    crate::modules::proxy_db::get_logs_count_filtered(&filter, errors_only)
}

/// Get: 带搜索条件的分页日志
#[tauri::command]
pub async fn get_proxy_logs_filtered(
    filter: String,
    errors_only: bool,
    limit: usize,
    offset: usize,
) -> Result<Vec<crate::proxy::monitor::ProxyRequestLog>, String> {
    crate::modules::proxy_db::get_logs_filtered(&filter, errors_only, limit, offset)
}

/// 生成 API Key
#[tauri::command]
pub fn generate_api_key() -> String {
    format!("sk-{}", uuid::Uuid::new_v4().simple())
}

/// 重新加载account逻辑（接受 &ProxyServiceState 引用）
pub async fn reload_proxy_accounts_state(state: &ProxyServiceState) -> Result<usize, String> {
    let instance_lock = state.instance.read().await;

    if let Some(instance) = instance_lock.as_ref() {
        // [FIX #820] Clear stale session bindings before reloading accounts
        // This ensures that after switching accounts in the UI, API requests
        // won't be routed to the previously bound (wrong) account
        instance.token_manager.clear_all_sessions();

        // 重新加载account
        let count = instance
            .token_manager
            .load_accounts()
            .await
            .map_err(|e| format!("重新加载accountfailed: {}", e))?;
        Ok(count)
    } else {
        Err("service未运行".to_string())
    }
}

/// 重新加载account（当主应用add/Delete account时调用）
#[tauri::command]
pub async fn reload_proxy_accounts(state: State<'_, ProxyServiceState>) -> Result<usize, String> {
    reload_proxy_accounts_state(&state).await
}

/// Update: model映射表 (热update)
#[tauri::command]
pub async fn update_model_mapping(
    config: ProxyConfig,
    state: State<'_, ProxyServiceState>,
) -> Result<(), String> {
    let instance_lock = state.instance.read().await;

    // 1. 如果service正在运行，立即update内存中的映射 (这里目前只update了 anthropic_mapping 的 RwLock,
    // 后续可以根据需要让 resolve_model_route 直接读取全量 config)
    if let Some(instance) = instance_lock.as_ref() {
        instance.axum_server.update_mapping(&config).await;
        tracing::debug!("后端service已接收全量model映射config");
    }

    // 2. none论是否运行，都save到全局config持久化
    let mut app_config = crate::modules::config::load_app_config().map_err(|e| e)?;
    app_config.proxy.custom_mapping = config.custom_mapping;
    crate::modules::config::save_app_config(&app_config).map_err(|e| e)?;

    Ok(())
}

fn join_base_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    let path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };
    format!("{}{}", base, path)
}

fn extract_model_ids(value: &serde_json::Value) -> Vec<String> {
    let mut out = Vec::new();

    fn push_from_item(out: &mut Vec<String>, item: &serde_json::Value) {
        match item {
            serde_json::Value::String(s) => out.push(s.to_string()),
            serde_json::Value::Object(map) => {
                if let Some(id) = map.get("id").and_then(|v| v.as_str()) {
                    out.push(id.to_string());
                } else if let Some(name) = map.get("name").and_then(|v| v.as_str()) {
                    out.push(name.to_string());
                }
            }
            _ => {}
        }
    }

    match value {
        serde_json::Value::Array(arr) => {
            for item in arr {
                push_from_item(&mut out, item);
            }
        }
        serde_json::Value::Object(map) => {
            if let Some(data) = map.get("data") {
                if let serde_json::Value::Array(arr) = data {
                    for item in arr {
                        push_from_item(&mut out, item);
                    }
                }
            }
            if let Some(models) = map.get("models") {
                match models {
                    serde_json::Value::Array(arr) => {
                        for item in arr {
                            push_from_item(&mut out, item);
                        }
                    }
                    other => push_from_item(&mut out, other),
                }
            }
        }
        _ => {}
    }

    out
}

/// Fetch available models from the configured z.ai Anthropic-compatible API (`/v1/models`).
#[tauri::command]
pub async fn fetch_zai_models(
    zai: crate::proxy::ZaiConfig,
    upstream_proxy: crate::proxy::config::UpstreamProxyConfig,
    request_timeout: u64,
) -> Result<Vec<String>, String> {
    if zai.base_url.trim().is_empty() {
        return Err("z.ai base_url is empty".to_string());
    }
    if zai.api_key.trim().is_empty() {
        return Err("z.ai api_key is not set".to_string());
    }

    let url = join_base_url(&zai.base_url, "/v1/models");

    let mut builder =
        reqwest::Client::builder().timeout(Duration::from_secs(request_timeout.max(5)));
    if upstream_proxy.enabled && !upstream_proxy.url.is_empty() {
        let proxy = reqwest::Proxy::all(&upstream_proxy.url)
            .map_err(|e| format!("Invalid upstream proxy url: {}", e))?;
        builder = builder.proxy(proxy);
    }
    let client = builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", zai.api_key))
        .header("x-api-key", zai.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Upstream request failed: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        let preview = if text.len() > 4000 {
            &text[..4000]
        } else {
            &text
        };
        return Err(format!("Upstream returned {}: {}", status, preview));
    }

    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Invalid JSON response: {}", e))?;
    let mut models = extract_model_ids(&json);
    models.retain(|s| !s.trim().is_empty());
    models.sort();
    models.dedup();
    Ok(models)
}

/// Get: currentRouting & scheduling configuration
#[tauri::command]
pub async fn get_proxy_scheduling_config(
    state: State<'_, ProxyServiceState>,
) -> Result<crate::proxy::sticky_config::StickySessionConfig, String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        Ok(instance.token_manager.get_sticky_config().await)
    } else {
        Ok(crate::proxy::sticky_config::StickySessionConfig::default())
    }
}

/// Update: Routing & scheduling configuration
#[tauri::command]
pub async fn update_proxy_scheduling_config(
    state: State<'_, ProxyServiceState>,
    config: crate::proxy::sticky_config::StickySessionConfig,
) -> Result<(), String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        instance.token_manager.update_sticky_config(config).await;
        Ok(())
    } else {
        Err("service未运行，none法update实时config".to_string())
    }
}

/// 清除所有会话粘性绑定
#[tauri::command]
pub async fn clear_proxy_session_bindings(
    state: State<'_, ProxyServiceState>,
) -> Result<(), String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        instance.token_manager.clear_all_sessions();
        Ok(())
    } else {
        Err("service未运行".to_string())
    }
}

/// 清除会话绑定简写别名 (clear_session_bindings)
#[tauri::command]
pub async fn clear_session_bindings(
    state: State<'_, ProxyServiceState>,
) -> Result<(), String> {
    clear_proxy_session_bindings(state).await
}

// ===== [FIX #820] 固定account模式命令 =====

/// Set优先使用的account（固定account模式）
/// 传入 account_id enabled固定模式，传入 null/empty字符串恢复轮询模式
#[tauri::command]
pub async fn set_preferred_account(
    state: State<'_, ProxyServiceState>,
    account_id: Option<String>,
) -> Result<(), String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        // Filterempty字符串为 None
        let cleaned_id = account_id.filter(|s| !s.trim().is_empty());

        // 1. update内存status
        instance
            .token_manager
            .set_preferred_account(cleaned_id.clone())
            .await;

        // 2. 持久化到config文件 (修复 Issue #820 自动关闭问题)
        let mut app_config = crate::modules::config::load_app_config()
            .map_err(|e| format!("加载configfailed: {}", e))?;
        app_config.proxy.preferred_account_id = cleaned_id.clone();
        crate::modules::config::save_app_config(&app_config)
            .map_err(|e| format!("saveconfigfailed: {}", e))?;

        if let Some(ref id) = cleaned_id {
            tracing::info!(
                "🔒 [FIX #820] Fixed account mode enabled and persisted: {}",
                id
            );
        } else {
            tracing::info!("🔄 [FIX #820] Round-robin mode enabled and persisted");
        }

        Ok(())
    } else {
        Err("service未运行".to_string())
    }
}

/// Get: current优先使用的accountID
#[tauri::command]
pub async fn get_preferred_account(
    state: State<'_, ProxyServiceState>,
) -> Result<Option<String>, String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        Ok(instance.token_manager.get_preferred_account().await)
    } else {
        Ok(None)
    }
}

/// 清除指定account的限流记录
#[tauri::command]
pub async fn clear_proxy_rate_limit(
    state: State<'_, ProxyServiceState>,
    account_id: String,
) -> Result<bool, String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        Ok(instance.token_manager.clear_rate_limit(&account_id))
    } else {
        Err("service未运行".to_string())
    }
}

/// 清除所有限流记录
#[tauri::command]
pub async fn clear_all_proxy_rate_limits(
    state: State<'_, ProxyServiceState>,
) -> Result<(), String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        instance.token_manager.clear_all_rate_limits();
        Ok(())
    } else {
        Err("service未运行".to_string())
    }
}

/// 清除限流记录简写别名 (clear_rate_limits)
#[tauri::command]
pub async fn clear_rate_limits(
    state: State<'_, ProxyServiceState>,
) -> Result<(), String> {
    clear_all_proxy_rate_limits(state).await
}

/// 触发所有代理的健康check，并returnupdate后的config
#[tauri::command]
pub async fn check_proxy_health(
    state: State<'_, ProxyServiceState>,
) -> Result<ProxyPoolConfig, String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        let pool_state = instance.axum_server.proxy_pool_state.clone();
        let manager = crate::proxy::proxy_pool::ProxyPoolManager::new(pool_state.clone());

        manager.health_check().await?;

        // Return the updated config from memory
        let config = pool_state.read().await;
        Ok(config.clone())
    } else {
        Err("service未运行".to_string())
    }
}

/// Get: current内存中的代理池status
#[tauri::command]
pub async fn get_proxy_pool_config(
    state: State<'_, ProxyServiceState>,
) -> Result<ProxyPoolConfig, String> {
    let instance_lock = state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        let config = instance.axum_server.proxy_pool_state.read().await;
        Ok(config.clone())
    } else {
        Err("service未运行".to_string())
    }
}

// ============================================================================
// [NEW] No-TUN Smart Proxy Router & Auto-Detection Commands
// ============================================================================

/// اسکن خودکار پورت‌های محلی پروکسی (V2Ray, Xray, Clash, Sing-box, etc.) و تست اتصال به گوگل
#[tauri::command]
pub async fn scan_local_proxies() -> Result<Vec<crate::modules::proxy_scanner::DiscoveredProxy>, String> {
    Ok(crate::modules::proxy_scanner::scan_local_proxies().await)
}

/// تست ارتباط و محاسبه تأخیر پینگ یک پروکسی دلخواه
#[tauri::command]
pub async fn test_proxy_connection(url: String) -> Result<crate::modules::proxy_scanner::DiscoveredProxy, String> {
    let probe = crate::modules::proxy_scanner::probe_proxy_url(&url).await;
    let url_clone = url.clone();
    let protocol = if url.starts_with("socks5") { "socks5" } else { "http" };
    
    Ok(crate::modules::proxy_scanner::DiscoveredProxy {
        url: url_clone,
        protocol: protocol.to_string(),
        port: 0,
        client_hint: "Custom Proxy".to_string(),
        is_listening: true,
        is_working: probe.is_working,
        gemini_supported: probe.gemini_supported,
        latency_ms: probe.latency_ms,
        error: probe.error,
    })
}

/// بررسی وضعیت فعلی تنظیمات پروکسی در Antigravity IDE و پلتفرم
#[tauri::command]
pub fn get_antigravity_proxy_status() -> Result<crate::modules::antigravity_network_patcher::AntigravityProxyStatus, String> {
    Ok(crate::modules::antigravity_network_patcher::check_antigravity_proxy_status())
}

/// اعمال تنظیمات پروکسی به Antigravity (بدون نیاز به TUN) و همگام‌سازی با شیلد
#[tauri::command]
pub async fn apply_antigravity_proxy(
    url: String,
    sync_shield_upstream: Option<bool>,
    state: State<'_, ProxyServiceState>,
) -> Result<String, String> {
    let count = crate::modules::antigravity_network_patcher::apply_proxy_to_settings(&url)?;
    
    // در صورت تمایل کاربر، پروکسی را به عنوان upstream_proxy شیلد نیز تنظیم و ذخیره می‌کنیم
    if sync_shield_upstream.unwrap_or(true) {
        if let Ok(mut app_config) = crate::modules::config::load_app_config() {
            app_config.proxy.upstream_proxy.enabled = true;
            app_config.proxy.upstream_proxy.url = url.clone();
            let _ = crate::modules::config::save_app_config(&app_config);
        }

        // بروزرسانی داینامیک سرور در حال اجرا
        let instance_lock = state.instance.read().await;
        if let Some(instance) = instance_lock.as_ref() {
            instance.axum_server.update_proxy(crate::proxy::config::UpstreamProxyConfig {
                enabled: true,
                url: url.clone(),
            }).await;
        }
    }

    Ok(format!("Proxy configuration applied to {} Antigravity instance(s).", count))
}

/// حذف تنظیمات پروکسی از Antigravity و بازگردانی به حالت عادی
#[tauri::command]
pub async fn remove_antigravity_proxy(
    disable_shield_upstream: Option<bool>,
    state: State<'_, ProxyServiceState>,
) -> Result<String, String> {
    let count = crate::modules::antigravity_network_patcher::remove_proxy_from_settings()?;

    if disable_shield_upstream.unwrap_or(true) {
        if let Ok(mut app_config) = crate::modules::config::load_app_config() {
            app_config.proxy.upstream_proxy.enabled = false;
            let _ = crate::modules::config::save_app_config(&app_config);
        }

        let instance_lock = state.instance.read().await;
        if let Some(instance) = instance_lock.as_ref() {
            instance.axum_server.update_proxy(crate::proxy::config::UpstreamProxyConfig {
                enabled: false,
                url: String::new(),
            }).await;
        }
    }

    Ok(format!("Proxy settings removed from {} Antigravity instance(s).", count))
}

/// پروب پیشرفته سلامت اینترنت، گوگل و هوش مصنوعی جمینای
#[tauri::command]
pub async fn check_gemini_network_pulse(
    custom_proxy: Option<String>,
) -> Result<crate::modules::network_pulse::NetworkPulseResult, String> {
    Ok(crate::modules::network_pulse::probe_network_health(custom_proxy).await)
}

/// اسکن کلاینت‌های فیلترشکن نصب‌شده یا در حال اجرا روی ویندوز
#[tauri::command]
pub fn detect_installed_vpns() -> Result<Vec<crate::modules::network_pulse::InstalledVpnInfo>, String> {
    Ok(crate::modules::network_pulse::detect_installed_vpns())
}

/// اجرای مستقیم فایل یک فیلترشکن توسط کاربر
#[tauri::command]
pub fn launch_vpn_client(exe_path: String) -> Result<String, String> {
    crate::modules::network_pulse::launch_vpn_executable(&exe_path)
}

/// تشخیص خودکار بهترین پروکسی لوکال فعال و اعمال فوری به Antigravity IDE بدون نیاز به TUN
#[tauri::command]
pub async fn auto_detect_and_apply_proxy(
    state: State<'_, ProxyServiceState>,
) -> Result<crate::modules::proxy_scanner::DiscoveredProxy, String> {
    let proxies = crate::modules::proxy_scanner::scan_local_proxies().await;
    
    // اولویت ۱: پروکسی HTTP که گوگل و جمینای را باز می‌کند
    // اولویت ۲: هر پروکسی که گوگل و جمینای را باز می‌کند
    // اولویت ۳: هر پروکسی فعال لوکال
    let best = proxies
        .iter()
        .find(|p| p.is_working && p.gemini_supported && p.protocol == "http")
        .or_else(|| proxies.iter().find(|p| p.is_working && p.gemini_supported))
        .or_else(|| proxies.iter().find(|p| p.is_working))
        .cloned();

    match best {
        Some(proxy) => {
            apply_antigravity_proxy(proxy.url.clone(), Some(true), state).await?;
            Ok(proxy)
        }
        None => Err("No working local proxy detected. Please ensure your VPN or proxy client is running.".to_string()),
    }
}

/// استعلام وضعیت ماژول اختصاصی Cloudflare WARP در پس‌زمینه
#[tauri::command]
pub async fn get_warp_status() -> Result<crate::modules::warp_manager::WarpStatus, String> {
    Ok(crate::modules::warp_manager::WARP_MANAGER.get_status().await)
}

/// دانلود و نصب بی‌صدا و درونی Cloudflare WARP در پس‌زمینه سیستم
#[tauri::command]
pub async fn start_warp_download() -> Result<String, String> {
    tokio::spawn(async {
        let _ = crate::modules::warp_manager::WARP_MANAGER.download_and_install().await;
    });
    Ok("WARP background download initiated.".to_string())
}

/// اتصال تک‌کلیک وارپ در حالت Proxy Mode (پورت 40000) و اتصال به Antigravity
#[tauri::command]
pub async fn connect_warp_proxy() -> Result<String, String> {
    crate::modules::warp_manager::WARP_MANAGER.connect_proxy_mode().await
}

/// قطع اتصال وارپ و بازگردانی تنظیمات
#[tauri::command]
pub async fn disconnect_warp_proxy() -> Result<String, String> {
    crate::modules::warp_manager::WARP_MANAGER.disconnect_warp().await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticProbeResult {
    pub success: bool,
    pub status_code: u16,
    pub latency_ms: u64,
    pub content: String,
    pub error: Option<String>,
}

/// 执行 API Proxy 诊断探测 (解决 WebView2 跨源/Loopback 隔离导致的 Failed to fetch)
#[tauri::command]
pub async fn proxy_execute_diagnostic_probe(
    protocol: String,
    model: Option<String>,
    prompt: Option<String>,
    state: State<'_, ProxyServiceState>,
) -> Result<DiagnosticProbeResult, String> {
    // 1. get运行中实例的端口 (Separated from any credential to prevent CodeQL TupleExpr taint)
    let port: u16 = {
        let instance_lock = state.instance.read().await;
        if let Some(instance) = instance_lock.as_ref() {
            instance.config.port
        } else {
            // If  instance 尚未启动，if is健康check允许尝试default端口，其它协议直接return未启动
            if protocol != "health" {
                return Ok(DiagnosticProbeResult {
                    success: false,
                    status_code: 0,
                    latency_ms: 0,
                    content: String::new(),
                    error: Some("Proxy service is not running. Please start the gateway first.".to_string()),
                });
            }
            if let Ok(app_cfg) = crate::modules::config::load_app_config() {
                app_cfg.proxy.port
            } else {
                8045
            }
        }
    };

    let start_time = std::time::Instant::now();
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    if protocol == "health" {
        let url = format!("http://127.0.0.1:{}/health", port);
        match client.get(&url).send().await {
            Ok(resp) => {
                let latency_ms = start_time.elapsed().as_millis() as u64;
                let status_code = resp.status().as_u16();
                let is_ok = resp.status().is_success();
                let text = resp.text().await.unwrap_or_default();
                return Ok(DiagnosticProbeResult {
                    success: is_ok,
                    status_code,
                    latency_ms,
                    content: text,
                    error: if is_ok { None } else { Some(format!("HTTP error {}", status_code)) },
                });
            }
            Err(e) => {
                let latency_ms = start_time.elapsed().as_millis() as u64;
                return Ok(DiagnosticProbeResult {
                    success: false,
                    status_code: 0,
                    latency_ms,
                    content: String::new(),
                    error: Some(format!("Health ping failed: {}", e)),
                });
            }
        }
    }

    let auth_token: String = {
        let instance_lock = state.instance.read().await;
        if let Some(instance) = instance_lock.as_ref() {
            instance.config.api_key.clone()
        } else if let Ok(app_cfg) = crate::modules::config::load_app_config() {
            app_cfg.proxy.api_key
        } else {
            String::new()
        }
    };

    let model_str = model.unwrap_or_else(|| "gemini-3.8-flash".to_string());
    let prompt_str = prompt.unwrap_or_else(|| "Ping! Please respond with: Antigravity Shield API Proxy is operational.".to_string());

    let is_openai = protocol == "openai";
    let url = if is_openai {
        format!("http://127.0.0.1:{}/v1/chat/completions", port)
    } else {
        format!("http://127.0.0.1:{}/v1/messages", port)
    };

    let body = if is_openai {
        serde_json::json!({
            "model": model_str,
            "messages": [
                { "role": "user", "content": prompt_str }
            ],
            "max_tokens": 800,
            "stream": false
        })
    } else {
        serde_json::json!({
            "model": model_str,
            "messages": [
                { "role": "user", "content": prompt_str }
            ],
            "max_tokens": 800
        })
    };

    let mut req = client.post(&url).json(&body);
    req = req.header("x-shield-probe", "true");
    if is_openai {
        if !auth_token.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", auth_token));
        }
    } else {
        req = req.header("anthropic-version", "2023-06-01");
        if !auth_token.is_empty() {
            req = req.header("x-api-key", &auth_token);
        }
    }

    match req.send().await {
        Ok(resp) => {
            let latency_ms = start_time.elapsed().as_millis() as u64;
            let status_code = resp.status().as_u16();
            let is_success = resp.status().is_success();
            let text = resp.text().await.unwrap_or_default();

            if is_success {
                let content = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    if is_openai {
                        let choice = json.get("choices").and_then(|c| c.get(0));
                        let msg = choice.and_then(|c0| c0.get("message"));

                        // 1. Text content (string or array)
                        let text_content = msg
                            .and_then(|m| m.get("content"))
                            .and_then(|ct| {
                                if let Some(s) = ct.as_str() {
                                    if !s.trim().is_empty() {
                                        return Some(s.to_string());
                                    }
                                } else if let Some(arr) = ct.as_array() {
                                    let mut joined = String::new();
                                    for b in arr {
                                        if let Some(t) = b.get("text").and_then(|v| v.as_str()) {
                                            joined.push_str(t);
                                        }
                                    }
                                    if !joined.trim().is_empty() {
                                        return Some(joined);
                                    }
                                }
                                None
                            });

                        // 2. Reasoning / Thinking content
                        let reasoning_content = msg
                            .and_then(|m| {
                                m.get("reasoning_content")
                                    .or_else(|| m.get("reasoning"))
                                    .or_else(|| m.get("thought"))
                            })
                            .and_then(|rc| rc.as_str())
                            .filter(|s| !s.trim().is_empty())
                            .map(|s| s.to_string());

                        // 3. Tool Calls
                        let tool_calls = msg
                            .and_then(|m| m.get("tool_calls"))
                            .and_then(|t| t.as_array())
                            .filter(|t| !t.is_empty())
                            .map(|tcs| {
                                let mut out = String::from("🛠️ [Tool Calls Generated by Model]:\n");
                                for (i, tc) in tcs.iter().enumerate() {
                                    let fn_name = tc.get("function").and_then(|f| f.get("name")).and_then(|n| n.as_str()).unwrap_or("unknown");
                                    let fn_args = tc.get("function").and_then(|f| f.get("arguments")).and_then(|a| a.as_str()).unwrap_or("{}");
                                    out.push_str(&format!("  {}. {}({})\n", i + 1, fn_name, fn_args));
                                }
                                out
                            });

                        if let Some(txt) = text_content {
                            if let Some(rc) = reasoning_content {
                                format!("💭 [Thinking Process]:\n{}\n\n📝 [Response]:\n{}", rc, txt)
                            } else {
                                txt
                            }
                        } else if let Some(tools) = tool_calls {
                            if let Some(rc) = reasoning_content {
                                format!("💭 [Thinking Process]:\n{}\n\n{}", rc, tools)
                            } else {
                                tools
                            }
                        } else if let Some(rc) = reasoning_content {
                            format!("💭 [Thinking Process]:\n{}", rc)
                        } else {
                            serde_json::to_string_pretty(&json).unwrap_or_else(|_| text.clone())
                        }
                    } else {
                        // Claude protocol: /v1/messages
                        let content_arr = json.get("content").and_then(|c| c.as_array());
                        let mut text_parts = Vec::new();
                        let mut thinking_parts = Vec::new();
                        let mut tool_parts = Vec::new();

                        if let Some(arr) = content_arr {
                            for block in arr {
                                let b_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                if b_type == "text" {
                                    if let Some(t) = block.get("text").and_then(|v| v.as_str()) {
                                        if !t.trim().is_empty() {
                                            text_parts.push(t.to_string());
                                        }
                                    }
                                } else if b_type == "thinking" {
                                    if let Some(th) = block.get("thinking").and_then(|v| v.as_str()) {
                                        if !th.trim().is_empty() {
                                            thinking_parts.push(th.to_string());
                                        }
                                    }
                                } else if b_type == "tool_use" {
                                    let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                                    let input = block.get("input").map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());
                                    tool_parts.push(format!("{}({})", name, input));
                                }
                            }
                        }

                        let txt = text_parts.join("\n");
                        let th = thinking_parts.join("\n");

                        if !txt.is_empty() {
                            if !th.is_empty() {
                                format!("💭 [Thinking Process]:\n{}\n\n📝 [Response]:\n{}", th, txt)
                            } else {
                                txt
                            }
                        } else if !tool_parts.is_empty() {
                            let tools_str = format!("🛠️ [Tool Calls Generated by Model]:\n  {}", tool_parts.join("\n  "));
                            if !th.is_empty() {
                                format!("💭 [Thinking Process]:\n{}\n\n{}", th, tools_str)
                            } else {
                                tools_str
                            }
                        } else if !th.is_empty() {
                            format!("💭 [Thinking Process]:\n{}", th)
                        } else {
                            serde_json::to_string_pretty(&json).unwrap_or_else(|_| text.clone())
                        }
                    }
                } else {
                    text
                };

                Ok(DiagnosticProbeResult {
                    success: true,
                    status_code,
                    latency_ms,
                    content,
                    error: None,
                })
            } else {
                let mut err_msg = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    json.get("error")
                        .and_then(|e| {
                            if let Some(s) = e.as_str() {
                                Some(s.to_string())
                            } else {
                                e.get("message").and_then(|m| m.as_str()).map(|s| s.to_string())
                            }
                        })
                        .unwrap_or_else(|| format!("HTTP error {}: {}", status_code, text))
                } else {
                    format!("HTTP error {}: {}", status_code, text)
                };

                if status_code == 429 || err_msg.to_lowercase().contains("resource_exhausted") || err_msg.to_lowercase().contains("quota") {
                    err_msg = format!("{} (Account quota exhausted or model tier entitlement not active on upstream account)", err_msg);
                }

                Ok(DiagnosticProbeResult {
                    success: false,
                    status_code,
                    latency_ms,
                    content: text,
                    error: Some(err_msg),
                })
            }
        }
        Err(e) => {
            let latency_ms = start_time.elapsed().as_millis() as u64;
            Ok(DiagnosticProbeResult {
                success: false,
                status_code: 0,
                latency_ms,
                content: String::new(),
                error: Some(format!("Diagnostic probe failed: {}", e)),
            })
        }
    }
}

/// Get: current IDE Argon Override config
#[tauri::command]
pub async fn get_argon_override() -> Result<crate::proxy::config::IdeArgonOverrideConfig, String> {
    Ok(crate::proxy::config::get_argon_override_config())
}

/// Update:  IDE Argon Override config并持久化
#[tauri::command]
pub async fn set_argon_override(
    enabled: bool,
    tier: String,
) -> Result<crate::proxy::config::IdeArgonOverrideConfig, String> {
    let tier = match tier.to_lowercase().as_str() {
        "low" => "low".to_string(),
        "medium" => "medium".to_string(),
        _ => "high".to_string(),
    };
    let new_cfg = crate::proxy::config::IdeArgonOverrideConfig {
        enabled,
        tier,
    };
    crate::proxy::config::update_argon_override_config(new_cfg.clone());

    if let Ok(mut app_cfg) = crate::modules::config::load_app_config() {
        app_cfg.proxy.ide_argon_override = new_cfg.clone();
        let _ = crate::modules::config::save_app_config(&app_cfg);
    }

    Ok(new_cfg)
}

