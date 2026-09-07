// 上游客户端实现
// 基于高性能通讯接口封装

use dashmap::DashMap;
use rquest::{header, Client, Response, StatusCode};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::Duration;

/// 端点降级尝试的记录信息
#[derive(Debug, Clone)]
pub struct FallbackAttemptLog {
    /// 尝试的端点 URL
    pub endpoint_url: String,
    /// HTTP 状态码 (网络错误时为 None)
    pub status: Option<u16>,
    /// 错误描述
    pub error: String,
}

/// 上游调用结果，包含响应和降级尝试记录
pub struct UpstreamCallResult {
    /// 最终的 HTTP 响应
    pub response: Response,
    /// 降级过程中失败的端点尝试记录 (成功时为空)
    pub fallback_attempts: Vec<FallbackAttemptLog>,
}

/// 邮箱脱敏：只显示前3位 + *** + @域名前2位 + ***
/// 例: "userexample@gmail.com" → "use***@gm***"
pub fn mask_email(email: &str) -> String {
    if let Some(at_pos) = email.find('@') {
        let local = &email[..at_pos];
        let domain = &email[at_pos + 1..];
        let local_prefix: String = local.chars().take(3).collect();
        let domain_prefix: String = domain.chars().take(2).collect();
        format!("{}***@{}***", local_prefix, domain_prefix)
    } else {
        // 不是合法邮箱格式，直接截取前5位
        let prefix: String = email.chars().take(5).collect();
        format!("{}***", prefix)
    }
}

/// [NEW] 错误日志脱敏：抹除报错信息中的 access_token, proxy_url 等敏感凭证
pub fn sanitize_error_for_log(error_text: &str) -> String {
    // 抹除常见敏感 key 的值
    let re = regex::Regex::new(r#"(?i)(access_token|refresh_token|id_token|authorization|api_key|secret|password|proxy_url|http_proxy|https_proxy)\s*[:=]\s*[^"'\\\s,}\]]+"#).unwrap();
    let redacted = re.replace_all(error_text, "$1=<redacted>");

    // 抹除 Bearer token
    let re_bearer = regex::Regex::new(r#"(?i)(bearer\s+)[^"'\\\s,}\]]+"#).unwrap();
    let redacted = re_bearer.replace_all(&redacted, "$1<redacted>");

    // 限制长度防止日志炸弹
    if redacted.len() > 1000 {
        format!("{}... (truncated)", &redacted[..1000])
    } else {
        redacted.into_owned()
    }
}

// Cloud Code v1internal endpoints
// [HARDENED] Only route to official Production endpoint.
// Hitting Sandbox/Daily staging endpoints triggers Google SOC intrusion filters and causes 403 account suspensions (Ref: Issue #2261).
pub const V1_INTERNAL_BASE_URL_PROD: &str = "https://cloudcode-pa.googleapis.com/v1internal";
pub const V1_INTERNAL_ALLOWED_HOST: &str = "cloudcode-pa.googleapis.com";
pub const V1_INTERNAL_ALLOWED_PATH_PREFIX: &str = "/v1internal";

pub const V1_INTERNAL_BASE_URL_FALLBACKS: [&str; 1] = [
    V1_INTERNAL_BASE_URL_PROD,
];

/// Validates whether a given URL string is an authorized, official Google production endpoint.
pub fn is_whitelisted_production_url(raw_url: &str) -> bool {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return false;
    }

    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("sandbox")
        || lower.contains("daily")
        || lower.contains("autopush")
        || lower.contains("staging")
        || lower.contains("test")
    {
        return false;
    }

    if let Ok(parsed) = url::Url::parse(trimmed) {
        parsed.scheme() == "https"
            && parsed.host_str() == Some(V1_INTERNAL_ALLOWED_HOST)
            && parsed.path().starts_with(V1_INTERNAL_ALLOWED_PATH_PREFIX)
    } else {
        false
    }
}

/// Sanitizes any given base URL to enforce strict production whitelisting.
/// Non-whitelisted or dev/staging/sandbox URLs are neutralized and redirected to the official production endpoint.
pub fn sanitize_v1_internal_base_url(raw_url: &str) -> &'static str {
    if is_whitelisted_production_url(raw_url) {
        V1_INTERNAL_BASE_URL_PROD
    } else {
        tracing::warn!(
            "Sanitizing unauthorized/non-production upstream URL '{}' -> enforcing official production endpoint: {}",
            raw_url,
            V1_INTERNAL_BASE_URL_PROD
        );
        V1_INTERNAL_BASE_URL_PROD
    }
}

pub struct UpstreamClient {
    default_client: RwLock<Client>,
    proxy_pool: Option<Arc<crate::proxy::proxy_pool::ProxyPoolManager>>,
    client_cache: DashMap<String, Client>, // proxy_id -> Client
    user_agent_override: RwLock<Option<String>>,
    // [NEW M1] In-memory cache for fast-path account device profile resolution
    device_profiles: DashMap<String, crate::models::DeviceProfile>,
}

impl UpstreamClient {
    pub fn new(
        proxy_config: Option<crate::proxy::config::UpstreamProxyConfig>,
        proxy_pool: Option<Arc<crate::proxy::proxy_pool::ProxyPoolManager>>,
    ) -> Self {
        let default_client = match Self::build_client_internal(proxy_config.clone()) {
            Ok(client) => client,
            Err(err_with_proxy) => {
                tracing::error!(
                    error = %err_with_proxy,
                    "Failed to create default HTTP client with configured upstream proxy; retrying without proxy"
                );
                match Self::build_client_internal(None) {
                    Ok(client) => client,
                    Err(err_without_proxy) => {
                        tracing::error!(
                            error = %err_without_proxy,
                            "Failed to create default HTTP client without proxy; falling back to bare client"
                        );
                        Client::new()
                    }
                }
            }
        };

        Self {
            default_client: RwLock::new(default_client),
            proxy_pool,
            client_cache: DashMap::new(),
            user_agent_override: RwLock::new(None),
            device_profiles: DashMap::new(),
        }
    }

    /// Update or register an in-memory device profile for an account
    pub fn set_account_profile(&self, account_id: &str, profile: crate::models::DeviceProfile) {
        self.device_profiles.insert(account_id.to_string(), profile);
    }

    /// Clear cached device profiles
    pub fn clear_device_profile_cache(&self) {
        self.device_profiles.clear();
    }

    /// Retrieve isolated headers for a given account ID
    pub fn resolve_device_headers(&self, account_id: Option<&str>) -> header::HeaderMap {
        let mut headers = header::HeaderMap::new();

        let (client_name, machine_id, session_id) = match account_id {
            Some(id) => {
                // 1. Resolve Profile: memory cache -> disk load -> fallback
                let profile = if let Some(cached) = self.device_profiles.get(id) {
                    Some(cached.clone())
                } else if let Ok(acc) = crate::modules::account::load_account(id) {
                    if let Some(ref p) = acc.device_profile {
                        self.device_profiles.insert(id.to_string(), p.clone());
                        Some(p.clone())
                    } else {
                        None
                    }
                } else {
                    None
                };

                let mid = crate::modules::device::get_account_machine_id(Some(id), profile.as_ref());
                let sess = crate::modules::device::derive_account_session_id(id);

                // Detect enterprise domain for client name
                let is_enterprise = if let Ok(acc) = crate::modules::account::load_account(id) {
                    !acc.email.ends_with("@gmail.com") && !acc.email.ends_with("@googlemail.com")
                } else {
                    false
                };
                let cname = if is_enterprise { "jetski" } else { "antigravity" };

                (cname, mid, sess)
            }
            None => {
                (
                    "antigravity",
                    crate::modules::device::derive_account_machine_id("anonymous"),
                    uuid::Uuid::new_v4().to_string(),
                )
            }
        };

        if let Ok(cname_val) = header::HeaderValue::from_str(client_name) {
            headers.insert("x-client-name", cname_val);
        }
        if let Ok(ver) = header::HeaderValue::from_str(&crate::constants::CURRENT_VERSION) {
            headers.insert("x-client-version", ver);
        }
        if let Ok(mid_val) = header::HeaderValue::from_str(&machine_id) {
            headers.insert("x-machine-id", mid_val);
        }
        if let Ok(sess_val) = header::HeaderValue::from_str(&session_id) {
            headers.insert("x-vscode-sessionid", sess_val);
        }

        headers
    }

    /// [HOT-RELOAD] Rebuild the default HTTP client using the supplied upstream
    /// proxy config. Called from `update_proxy` so changes to the upstream proxy
    /// take effect without restarting the app.
    pub async fn rebuild_default_client(
        &self,
        proxy_config: Option<crate::proxy::config::UpstreamProxyConfig>,
    ) {
        let new_client = match Self::build_client_internal(proxy_config.clone()) {
            Ok(c) => c,
            Err(err_with_proxy) => {
                tracing::error!(
                    error = %err_with_proxy,
                    "Hot-reload: failed to rebuild default HTTP client with configured upstream proxy; retrying without proxy"
                );
                match Self::build_client_internal(None) {
                    Ok(c) => c,
                    Err(err_without_proxy) => {
                        tracing::error!(
                            error = %err_without_proxy,
                            "Hot-reload: failed to rebuild default HTTP client without proxy; keeping previous client"
                        );
                        return;
                    }
                }
            }
        };
        let mut guard = self.default_client.write().await;
        *guard = new_client;
        tracing::info!("UpstreamClient default_client rebuilt (upstream proxy hot-reloaded)");
    }

    /// [HOT-RELOAD] Drop all per-proxy cached clients. Call after the pool
    /// configuration changes (proxy URL/credentials edited, proxy removed,
    /// bindings changed) so the next request rebuilds with fresh settings.
    pub fn clear_client_cache(&self) {
        let size = self.client_cache.len();
        self.client_cache.clear();
        if size > 0 {
            tracing::info!("UpstreamClient cleared {} cached per-proxy clients", size);
        }
    }

    /// Internal helper to build a client with optional upstream proxy config
    fn build_client_internal(
        proxy_config: Option<crate::proxy::config::UpstreamProxyConfig>,
    ) -> Result<Client, rquest::Error> {
        let mut builder = Client::builder()
            .emulation(rquest_util::Emulation::Chrome123)
            // Connection settings (优化连接复用，减少建立开销)
            .connect_timeout(Duration::from_secs(20))
            .pool_max_idle_per_host(20) // 每主机最多 20 个空闲连接 (对齐官方指纹)
            .pool_idle_timeout(Duration::from_secs(90)) // 空闲连接保持 90 秒
            .tcp_keepalive(Duration::from_secs(60)) // TCP 保活探测 60 秒
            // 强制开启 HTTP/2 协议，并支持在 SOCKS/HTTPS 代理下通过 ALPN 强制降级/协商
            .timeout(Duration::from_secs(600));

        builder = Self::apply_default_user_agent(builder);

        if let Some(config) = proxy_config {
            if config.enabled && !config.url.is_empty() {
                let url = crate::proxy::config::normalize_proxy_url(&config.url);
                if let Ok(proxy) = rquest::Proxy::all(&url) {
                    builder = builder.proxy(proxy);
                    tracing::info!("UpstreamClient enabled proxy: {}", url);
                }
            }
        }

        builder.build()
    }

    /// Build a client with a specific PoolProxyConfig (from ProxyPool)
    fn build_client_with_proxy(
        &self,
        proxy_config: crate::proxy::proxy_pool::PoolProxyConfig,
    ) -> Result<Client, rquest::Error> {
        // Reuse base settings similar to default client but with specific proxy
        let builder = Client::builder()
            .emulation(rquest_util::Emulation::Chrome123)
            .connect_timeout(Duration::from_secs(20))
            .pool_max_idle_per_host(20)
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(60))
            .timeout(Duration::from_secs(600))
            .proxy(proxy_config.proxy); // Apply the specific proxy

        Self::apply_default_user_agent(builder).build()
    }

    fn apply_default_user_agent(builder: rquest::ClientBuilder) -> rquest::ClientBuilder {
        let ua = crate::constants::USER_AGENT.as_str();
        if header::HeaderValue::from_str(ua).is_ok() {
            builder.user_agent(ua)
        } else {
            tracing::warn!(
                user_agent = %ua,
                "Invalid default User-Agent value, using fallback"
            );
            builder.user_agent("antigravity")
        }
    }

    /// Set dynamic User-Agent override
    pub async fn set_user_agent_override(&self, ua: Option<String>) {
        let mut lock = self.user_agent_override.write().await;
        *lock = ua;
        tracing::debug!("UpstreamClient User-Agent override updated: {:?}", lock);
    }

    /// Get current User-Agent
    pub async fn get_user_agent(&self) -> String {
        let ua_override = self.user_agent_override.read().await;
        ua_override
            .as_ref()
            .cloned()
            .unwrap_or_else(|| crate::constants::USER_AGENT.clone())
    }

    /// Get client for a specific account (or default if no proxy bound)
    pub async fn get_client(&self, account_id: Option<&str>) -> Client {
        if let Some(pool) = &self.proxy_pool {
            if let Some(acc_id) = account_id {
                // Try to get per-account proxy
                match pool.get_proxy_for_account(acc_id).await {
                    Ok(Some(proxy_cfg)) => {
                        // Check cache
                        if let Some(client) = self.client_cache.get(&proxy_cfg.entry_id) {
                            return client.clone();
                        }
                        // Build new client and cache it
                        match self.build_client_with_proxy(proxy_cfg.clone()) {
                            Ok(client) => {
                                self.client_cache
                                    .insert(proxy_cfg.entry_id.clone(), client.clone());
                                tracing::info!(
                                    "Using ProxyPool proxy ID: {} for account: {}",
                                    proxy_cfg.entry_id,
                                    acc_id
                                );
                                return client;
                            }
                            Err(e) => {
                                tracing::error!("Failed to build client for proxy {}: {}, falling back to default", proxy_cfg.entry_id, e);
                            }
                        }
                    }
                    Ok(None) => {
                        // No proxy found or required for this account, use default
                    }
                    Err(e) => {
                        tracing::error!(
                            "Error getting proxy for account {}: {}, falling back to default",
                            acc_id,
                            e
                        );
                    }
                }
            }
        }
        // Fallback to default client
        self.default_client.read().await.clone()
    }

    /// Build v1internal URL, strictly sanitizing and enforcing production whitelisting
    pub fn build_url(base_url: &str, method: &str, query_string: Option<&str>) -> String {
        let safe_base = sanitize_v1_internal_base_url(base_url);
        if let Some(qs) = query_string {
            format!("{}:{}?{}", safe_base, method, qs)
        } else {
            format!("{}:{}", safe_base, method)
        }
    }

    /// Determine if we should try next endpoint (fallback logic)
    fn should_try_next_endpoint(status: StatusCode) -> bool {
        status == StatusCode::REQUEST_TIMEOUT
            || status == StatusCode::NOT_FOUND
            || status.is_server_error()
    }

    /// Call v1internal API (Basic Method)
    ///
    /// Initiates a basic network request, supporting multi-endpoint auto-fallback.
    /// [UPDATED] Takes optional account_id for per-account proxy selection.
    pub async fn call_v1_internal(
        &self,
        method: &str,
        access_token: &str,
        body: Value,
        query_string: Option<&str>,
        account_id: Option<&str>, // [NEW] Account ID for proxy selection
    ) -> Result<UpstreamCallResult, String> {
        self.call_v1_internal_with_headers(
            method,
            access_token,
            body,
            query_string,
            std::collections::HashMap::new(),
            account_id,
        )
        .await
    }

    /// [FIX #765] 调用 v1internal API，支持透传额外的 Headers
    /// [ENHANCED] 返回 UpstreamCallResult，包含降级尝试记录，用于 debug 日志
    pub async fn call_v1_internal_with_headers(
        &self,
        method: &str,
        access_token: &str,
        body: Value,
        query_string: Option<&str>,
        extra_headers: std::collections::HashMap<String, String>,
        account_id: Option<&str>, // [NEW] Account ID
    ) -> Result<UpstreamCallResult, String> {
        // [NEW] Get client based on account (cached in proxy pool manager)
        let client = self.get_client(account_id).await;

        // 构建 Headers (所有端点复用)
        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&format!("Bearer {}", access_token))
                .map_err(|e| e.to_string())?,
        );

        headers.insert(
            header::USER_AGENT,
            header::HeaderValue::from_str(&self.get_user_agent().await).unwrap_or_else(|e| {
                tracing::warn!("Invalid User-Agent header value, using fallback: {}", e);
                header::HeaderValue::from_static("antigravity")
            }),
        );

        // [ENHANCED M1] Per-Account DeviceProfile & Fingerprint Isolation
        // Replaces host machine_uid and global SESSION_ID with isolated per-account credentials.
        // Prevents Google SOC multi-account correlation bans (Issues #655, #1822, #1430, #3160).
        let device_headers = self.resolve_device_headers(account_id);
        for (k, v) in device_headers.iter() {
            headers.insert(k.clone(), v.clone());
        }

        // [REMOVED v4.1.24] x-goog-api-client (gl-node/fire/grpc) header has been removed.
        // This header belongs to the IDE's JS layer, not the official client's egress.
        // Sending it creates a contradictory "Electron + Node.js" fingerprint.

        // Keep body.project for content requests, but omit the quota-project header.
        let is_content_request = matches!(method, "generateContent" | "streamGenerateContent");
        if !is_content_request {
            if let Some(proj) = body.get("project").and_then(|v| v.as_str()) {
                if !proj.is_empty() && proj != "test-project" && proj != "project-id" {
                    if let Ok(hv) = header::HeaderValue::from_str(proj) {
                        headers.insert("x-goog-user-project", hv);
                    }
                }
            }
        }

        // 注入额外的 Headers (如 anthropic-beta)
        for (k, v) in extra_headers {
            if let Ok(hk) = header::HeaderName::from_bytes(k.as_bytes()) {
                if let Ok(hv) = header::HeaderValue::from_str(&v) {
                    headers.insert(hk, hv);
                }
            }
        }
        if is_content_request {
            headers.remove("x-goog-user-project");
        }

        // [DEBUG] Log headers for verification
        tracing::debug!(?headers, "Final Upstream Request Headers");

        let mut has_triggered_downgrade = false;

        // [TEMPORARY FIX #3074] 针对 403 SERVICE_DISABLED 的自动降级重试逻辑
        // 我们包装一层循环，以便在检测到特定错误时移除 Header 并重试
        loop {
            let mut last_err: Option<String> = None;
            let mut fallback_attempts: Vec<FallbackAttemptLog> = Vec::new();
            let mut should_retry_without_header = false;

            // 遍历所有端点，失败时自动切换
            for (idx, base_url) in V1_INTERNAL_BASE_URL_FALLBACKS.iter().enumerate() {
                let url = Self::build_url(base_url, method, query_string);
                let has_next = idx + 1 < V1_INTERNAL_BASE_URL_FALLBACKS.len();

                let body_bytes = serde_json::to_vec(&body).map_err(|e| e.to_string())?;

                let mut req_builder = client.post(&url).headers(headers.clone());

                // [FIX] 仅对流式接口 (streamGenerateContent) 使用分块传输仿真
                // 对其他接口 (如 generateContent, loadCodeAssist) 发送正常的固定长度 Body
                // 否则图像生成会因为缺少 Content-Length 而被 Google 服务端拒绝或限流 (429)
                if method == "streamGenerateContent" {
                    let stream_bytes = body_bytes.clone();
                    req_builder = req_builder.body(rquest::Body::wrap_stream(
                        futures::stream::once(async move { Ok::<_, std::io::Error>(stream_bytes) }),
                    ));
                } else {
                    req_builder = req_builder.body(body_bytes.clone());
                }

                let response = req_builder.send().await;

                match response {
                    Ok(resp) => {
                        let status = resp.status();
                        if status.is_success() {
                            if idx > 0 {
                                tracing::info!(
                                    "✓ Upstream fallback succeeded | Endpoint: {} | Status: {} | Next endpoints available: {}",
                                    base_url,
                                    status,
                                    V1_INTERNAL_BASE_URL_FALLBACKS.len() - idx - 1
                                );
                            } else {
                                tracing::debug!(
                                    "✓ Upstream request succeeded | Endpoint: {} | Status: {}",
                                    base_url,
                                    status
                                );
                            }
                            return Ok(UpstreamCallResult {
                                response: resp,
                                fallback_attempts,
                            });
                        }

                        // [NEW] 检测 403 错误 (Issue #3074)
                        // 只要带有项目 Header 且返回 403，我们就尝试降级重试一次
                        if status == StatusCode::FORBIDDEN
                            && !has_triggered_downgrade
                            && headers.contains_key("x-goog-user-project")
                        {
                            tracing::warn!(
                                "Detected 403 Forbidden with project header, retrying WITHOUT x-goog-user-project header (Account: {:?})",
                                account_id
                            );
                            should_retry_without_header = true;
                            break;
                        }

                        // 如果有下一个端点且当前错误可重试，则切换
                        if has_next && Self::should_try_next_endpoint(status) {
                            let err_msg = format!("Upstream {} returned {}", base_url, status);
                            tracing::warn!(
                                "Upstream endpoint returned {} at {} (method={}), trying next endpoint",
                                status,
                                base_url,
                                method
                            );
                            // [NEW] 记录降级尝试
                            fallback_attempts.push(FallbackAttemptLog {
                                endpoint_url: url.clone(),
                                status: Some(status.as_u16()),
                                error: err_msg.clone(),
                            });
                            last_err = Some(err_msg);
                            continue;
                        }

                        // 不可重试的错误或已是最后一个端点，直接返回
                        return Ok(UpstreamCallResult {
                            response: resp,
                            fallback_attempts,
                        });
                    }
                    Err(e) => {
                        let msg = format!("HTTP request failed at {}: {}", base_url, e);
                        tracing::debug!("{}", msg);
                        // [NEW] 记录网络错误的降级尝试
                        fallback_attempts.push(FallbackAttemptLog {
                            endpoint_url: url.clone(),
                            status: None,
                            error: msg.clone(),
                        });
                        last_err = Some(msg);

                        // 如果是最后一个端点，退出循环
                        if !has_next {
                            break;
                        }
                        continue;
                    }
                }
            }

            // 处理降级逻辑
            if should_retry_without_header {
                headers.remove("x-goog-user-project");
                has_triggered_downgrade = true;
                // 重启外层 loop，从第一个端点再次尝试
                continue;
            }

            // 如果没有触发降级且所有端点都尝试过，返回最后的错误
            return Err(last_err.unwrap_or_else(|| "All endpoints failed".to_string()));
        }
    }

    /// 调用 v1internal API（带 429 重试,支持闭包）
    ///
    /// 带容错和重试的核心请求逻辑
    ///
    /// # Arguments
    /// * `method` - API method (e.g., "generateContent")
    /// * `query_string` - Optional query string (e.g., "?alt=sse")
    /// * `get_credentials` - 闭包，获取凭证（支持账号轮换）
    /// * `build_body` - 闭包，接收 project_id 构建请求体
    /// * `max_attempts` - 最大重试次数
    ///
    /// # Returns
    /// HTTP Response
    // 已移除弃用的重试方法 (call_v1_internal_with_retry)

    // 已移除弃用的辅助方法 (parse_retry_delay)

    // 已移除弃用的辅助方法 (parse_duration_ms)

    /// 获取可用模型列表
    ///
    /// 获取远端模型列表，支持多端点自动 Fallback
    #[allow(dead_code)] // API ready for future model discovery feature
    pub async fn fetch_available_models(
        &self,
        access_token: &str,
        account_id: Option<&str>,
    ) -> Result<Value, String> {
        // 复用 call_v1_internal，然后解析 JSON
        let result = self
            .call_v1_internal(
                "fetchAvailableModels",
                access_token,
                serde_json::json!({}),
                None,
                account_id,
            )
            .await?;
        let json: Value = result
            .response
            .json()
            .await
            .map_err(|e| format!("Parse json failed: {}", e))?;
        Ok(json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_url() {
        let base_url = "https://cloudcode-pa.googleapis.com/v1internal";

        let url1 = UpstreamClient::build_url(base_url, "generateContent", None);
        assert_eq!(
            url1,
            "https://cloudcode-pa.googleapis.com/v1internal:generateContent"
        );

        let url2 = UpstreamClient::build_url(base_url, "streamGenerateContent", Some("alt=sse"));
        assert_eq!(
            url2,
            "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse"
        );
    }

    #[test]
    fn test_production_url_whitelisting_and_sanitization() {
        assert!(is_whitelisted_production_url("https://cloudcode-pa.googleapis.com/v1internal"));
        assert_eq!(
            sanitize_v1_internal_base_url("https://cloudcode-pa.googleapis.com/v1internal"),
            V1_INTERNAL_BASE_URL_PROD
        );

        let banned_urls = [
            "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal",
            "https://daily-cloudcode-pa.googleapis.com/v1internal",
            "https://autopush-cloudcode-pa.sandbox.googleapis.com/v1internal",
            "http://cloudcode-pa.googleapis.com/v1internal",
            "https://evil-phishing.com/v1internal",
            "https://cloudcode-pa.googleapis.com/staging",
            "https://sandbox.googleapis.com",
            "",
            "   ",
        ];

        for url in banned_urls {
            assert!(!is_whitelisted_production_url(url), "Should reject: {}", url);
            assert_eq!(
                sanitize_v1_internal_base_url(url),
                V1_INTERNAL_BASE_URL_PROD,
                "Should sanitize: {}",
                url
            );
        }
    }

    #[test]
    fn test_build_url_sanitizes_dev_staging() {
        let malicious_dev = "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal";
        let url = UpstreamClient::build_url(malicious_dev, "generateContent", None);
        assert_eq!(
            url,
            "https://cloudcode-pa.googleapis.com/v1internal:generateContent"
        );

        let url_with_query = UpstreamClient::build_url(malicious_dev, "streamGenerateContent", Some("alt=sse"));
        assert_eq!(
            url_with_query,
            "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse"
        );
    }
}
