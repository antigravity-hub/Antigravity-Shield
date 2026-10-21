// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use crate::modules::security_db;
use serde::{Deserialize, Serialize};
use tauri::State;

// ==================== request/response结构 ====================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpAccessLogQuery {
    pub page: usize,
    pub page_size: usize,
    pub search: Option<String>,
    pub blocked_only: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IpAccessLogResponse {
    pub logs: Vec<security_db::IpAccessLog>,
    pub total: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddBlacklistRequest {
    pub ip_pattern: String,
    pub reason: Option<String>,
    pub expires_at: Option<i64>, // Unix timestamp
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWhitelistRequest {
    pub ip_pattern: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IpStatsResponse {
    pub total_requests: usize,
    pub unique_ips: usize,
    pub blocked_requests: usize,
    pub top_ips: Vec<security_db::IpRanking>,
}

// ==================== IP 访问日志命令 ====================

/// Get:  IP 访问日志列表
#[tauri::command]
pub async fn get_ip_access_logs(query: IpAccessLogQuery) -> Result<IpAccessLogResponse, String> {
    let offset = (query.page.max(1) - 1) * query.page_size;

    let logs = security_db::get_ip_access_logs(
        query.page_size,
        offset,
        query.search.as_deref(),
        query.blocked_only,
    )?;

    // 简单计算总数 (如果需要精确分页,可以add count 函数)
    let total = logs.len();

    Ok(IpAccessLogResponse { logs, total })
}

/// Get:  IP 统计info
#[tauri::command]
pub async fn get_ip_stats() -> Result<IpStatsResponse, String> {
    let stats = security_db::get_ip_stats()?;
    let top_ips = security_db::get_top_ips(10, 24)?; // Top 10 IPs in last 24 hours

    Ok(IpStatsResponse {
        total_requests: stats.total_requests as usize,
        unique_ips: stats.unique_ips as usize,
        blocked_requests: stats.blocked_count as usize,
        top_ips,
    })
}

/// 清empty IP 访问日志
#[tauri::command]
pub async fn clear_ip_access_logs() -> Result<(), String> {
    security_db::clear_ip_access_logs()
}

// ==================== IP 黑名单命令 ====================

/// Get:  IP 黑名单列表
#[tauri::command]
pub async fn get_ip_blacklist() -> Result<Vec<security_db::IpBlacklistEntry>, String> {
    security_db::get_blacklist()
}

/// Add IP to blacklist
#[tauri::command]
pub async fn add_ip_to_blacklist(request: AddBlacklistRequest) -> Result<(), String> {
    // Verify IP 格式
    if !is_valid_ip_pattern(&request.ip_pattern) {
        return Err(
            "Invalid IP pattern. Use IP address or CIDR notation (e.g., 192.168.1.0/24)"
                .to_string(),
        );
    }

    security_db::add_to_blacklist(
        &request.ip_pattern,
        request.reason.as_deref(),
        request.expires_at,
        "manual",
    )?;
    Ok(())
}

/// Remove IP from blacklist
#[tauri::command]
pub async fn remove_ip_from_blacklist(ip_pattern: String) -> Result<(), String> {
    // 先get黑名单列表，找到对应的id
    let entries = security_db::get_blacklist()?;
    let entry = entries.iter().find(|e| e.ip_pattern == ip_pattern);

    if let Some(entry) = entry {
        security_db::remove_from_blacklist(&entry.id)
    } else {
        Err(format!("IP pattern {} not found in blacklist", ip_pattern))
    }
}

/// 清empty黑名单
#[tauri::command]
pub async fn clear_ip_blacklist() -> Result<(), String> {
    // Get: 所有黑名单条目并逐个delete
    let entries = security_db::get_blacklist()?;
    for entry in entries {
        security_db::remove_from_blacklist(&entry.ip_pattern)?;
    }
    Ok(())
}

/// Check:  IP 是否在黑名单中
#[tauri::command]
pub async fn check_ip_in_blacklist(ip: String) -> Result<bool, String> {
    security_db::is_ip_in_blacklist(&ip)
}

// ==================== IP 白名单命令 ====================

/// Get:  IP 白名单列表
#[tauri::command]
pub async fn get_ip_whitelist() -> Result<Vec<security_db::IpWhitelistEntry>, String> {
    security_db::get_whitelist()
}

/// Add IP to whitelist
#[tauri::command]
pub async fn add_ip_to_whitelist(request: AddWhitelistRequest) -> Result<(), String> {
    // Verify IP 格式
    if !is_valid_ip_pattern(&request.ip_pattern) {
        return Err(
            "Invalid IP pattern. Use IP address or CIDR notation (e.g., 192.168.1.0/24)"
                .to_string(),
        );
    }

    security_db::add_to_whitelist(&request.ip_pattern, request.description.as_deref())?;
    Ok(())
}

/// Remove IP from whitelist
#[tauri::command]
pub async fn remove_ip_from_whitelist(ip_pattern: String) -> Result<(), String> {
    // 先get白名单列表，找到对应的id
    let entries = security_db::get_whitelist()?;
    let entry = entries.iter().find(|e| e.ip_pattern == ip_pattern);

    if let Some(entry) = entry {
        security_db::remove_from_whitelist(&entry.id)
    } else {
        Err(format!("IP pattern {} not found in whitelist", ip_pattern))
    }
}

/// 清empty白名单
#[tauri::command]
pub async fn clear_ip_whitelist() -> Result<(), String> {
    // Get: 所有白名单条目并逐个delete
    let entries = security_db::get_whitelist()?;
    for entry in entries {
        security_db::remove_from_whitelist(&entry.ip_pattern)?;
    }
    Ok(())
}

/// Check:  IP 是否在白名单中
#[tauri::command]
pub async fn check_ip_in_whitelist(ip: String) -> Result<bool, String> {
    security_db::is_ip_in_whitelist(&ip)
}

// ==================== 安全config命令 ====================

/// Get: 安全监控config
#[tauri::command]
pub async fn get_security_config(
    app_state: State<'_, crate::commands::proxy::ProxyServiceState>,
) -> Result<crate::proxy::config::SecurityMonitorConfig, String> {
    // 1. 尝试从运行中的实例get (内存中可能由最新的config)
    let instance_lock = app_state.instance.read().await;
    if let Some(instance) = instance_lock.as_ref() {
        return Ok(instance.config.security_monitor.clone());
    }

    // 2. 如果service未运行，从磁盘加载
    let app_config = crate::modules::config::load_app_config()
        .map_err(|e| format!("Failed to load config: {}", e))?;
    Ok(app_config.proxy.security_monitor)
}

/// Update: 安全监控config
#[tauri::command]
pub async fn update_security_config(
    config: crate::proxy::config::SecurityMonitorConfig,
    app_state: State<'_, crate::commands::proxy::ProxyServiceState>,
) -> Result<(), String> {
    // 1. 同步save到config文件
    let mut app_config = crate::modules::config::load_app_config()
        .map_err(|e| format!("Failed to load config: {}", e))?;
    app_config.proxy.security_monitor = config.clone();
    crate::modules::config::save_app_config(&app_config)
        .map_err(|e| format!("Failed to save config: {}", e))?;

    // 2. update内存中的config (如果service正在运行)
    {
        let mut instance_lock = app_state.instance.write().await;
        if let Some(instance) = instance_lock.as_mut() {
            instance.config.security_monitor = config.clone();
            // [FIX] 调用 update_security 热update运行中的中间件config
            // 这是关键步骤！中间件读取的是 AppState.security (Arc<RwLock<ProxySecurityConfig>>)
            // 必须调用 update_security() 才能使黑白名单config实时生效
            instance.axum_server.update_security(&instance.config).await;
            tracing::info!("[Security] Runtime security config hot-reloaded");
        }
    }

    tracing::info!("[Security] Security monitor config updated and saved");
    Ok(())
}

// ==================== 统计分析命令 ====================

/// Get:  IP Token 消耗统计
#[tauri::command]
pub async fn get_ip_token_stats(
    limit: Option<usize>,
    hours: Option<i64>,
) -> Result<Vec<crate::modules::proxy_db::IpTokenStats>, String> {
    crate::modules::proxy_db::get_token_usage_by_ip(limit.unwrap_or(100), hours.unwrap_or(720))
}

// ==================== Helper functions ====================

/// Verify IP 模式格式 (支持单个 IP 和 CIDR)
fn is_valid_ip_pattern(pattern: &str) -> bool {
    // Check: 是否为 CIDR 格式
    if pattern.contains('/') {
        let parts: Vec<&str> = pattern.split('/').collect();
        if parts.len() != 2 {
            return false;
        }

        // Verify IP 部分
        if !is_valid_ip(parts[0]) {
            return false;
        }

        // Verify掩码部分
        if let Ok(mask) = parts[1].parse::<u8>() {
            return mask <= 32;
        }
        return false;
    }

    // 单个 IP 地址
    is_valid_ip(pattern)
}

/// Verify IP 地址格式
fn is_valid_ip(ip: &str) -> bool {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return false;
    }

    for part in parts {
        if part.parse::<u8>().is_err() {
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_ip_patterns() {
        assert!(is_valid_ip_pattern("192.168.1.1"));
        assert!(is_valid_ip_pattern("10.0.0.0/8"));
        assert!(is_valid_ip_pattern("172.16.0.0/16"));
        assert!(is_valid_ip_pattern("192.168.1.0/24"));
        assert!(is_valid_ip_pattern("8.8.8.8/32"));
    }

    #[test]
    fn test_invalid_ip_patterns() {
        assert!(!is_valid_ip_pattern("256.1.1.1"));
        assert!(!is_valid_ip_pattern("192.168.1"));
        assert!(!is_valid_ip_pattern("192.168.1.1/33"));
        assert!(!is_valid_ip_pattern("192.168.1.1/"));
        assert!(!is_valid_ip_pattern("invalid"));
    }
}
