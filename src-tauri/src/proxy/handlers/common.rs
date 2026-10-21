// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use crate::proxy::server::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashSet;
use tokio::time::{sleep, Duration};
use tracing::{debug, info};

// ===== 统一retry与退避策略 =====

/// retry策略枚举
#[derive(Debug, Clone)]
pub enum RetryStrategy {
    /// 不retry，直接returnerror
    NoRetry,
    /// 固定延迟
    FixedDelay(Duration),
    /// 线性退避：base_ms * (attempt + 1)
    LinearBackoff { base_ms: u64 },
    /// 指数退避：base_ms * 2^attempt，上限 max_ms
    ExponentialBackoff { base_ms: u64, max_ms: u64 },
    /// [NEW] 原地retry (Grace Retry)：在currentaccount上小窗口等待后直接retry，不计入常规切换
    GraceRetry(Duration),
    /// [NEW M4] 代理故障转移与节点轮换
    ProxyFailover,
}

#[derive(Debug, Default)]
pub struct RequestRetryState {
    grace_retried_accounts: HashSet<String>,
}

impl RequestRetryState {
    pub fn determine_strategy(
        &mut self,
        account_id: &str,
        status_code: u16,
        error_text: &str,
        retry_after: Option<&str>,
        retried_without_thinking: bool,
    ) -> RetryStrategy {
        let allow_grace_retry = !self.grace_retried_accounts.contains(account_id);
        let strategy = determine_retry_strategy_inner(
            status_code,
            error_text,
            retry_after,
            retried_without_thinking,
            allow_grace_retry,
        );
        if matches!(strategy, RetryStrategy::GraceRetry(_)) {
            self.grace_retried_accounts.insert(account_id.to_string());
        }
        strategy
    }
}

pub fn next_rotation_attempt(
    used_attempts: &mut usize,
    max_attempts: usize,
    retry_same_account: bool,
) -> Option<usize> {
    if retry_same_account {
        return used_attempts.checked_sub(1);
    }
    if *used_attempts >= max_attempts {
        return None;
    }

    let attempt = *used_attempts;
    *used_attempts += 1;
    Some(attempt)
}

#[derive(Debug, Default)]
pub struct FailureStatusTracker {
    saw_failure: bool,
    last_non_rate_limit: Option<StatusCode>,
}

impl FailureStatusTracker {
    pub fn record(&mut self, status: StatusCode) {
        self.saw_failure = true;
        if status != StatusCode::TOO_MANY_REQUESTS {
            self.last_non_rate_limit = Some(status);
        }
    }

    pub fn final_status(&self) -> StatusCode {
        self.last_non_rate_limit.unwrap_or_else(|| {
            if self.saw_failure {
                StatusCode::TOO_MANY_REQUESTS
            } else {
                StatusCode::BAD_GATEWAY
            }
        })
    }
}

/// 根据errorstatus码和errorinfo确定retry策略
pub fn determine_retry_strategy(
    status_code: u16,
    error_text: &str,
    retried_without_thinking: bool,
) -> RetryStrategy {
    if status_code == 429 {
        return match crate::proxy::upstream::retry::parse_legacy_retry_delay(error_text) {
            Some(delay_ms) if delay_ms > 0 && delay_ms <= 2000 => {
                let actual_delay = delay_ms.saturating_add(100);
                tracing::info!(
                    "Grace Retry Triggered: Delay {}ms is within window, using same account",
                    actual_delay
                );
                RetryStrategy::GraceRetry(Duration::from_millis(actual_delay))
            }
            _ => RetryStrategy::FixedDelay(Duration::ZERO),
        };
    }

    determine_retry_strategy_inner(
        status_code,
        error_text,
        None,
        retried_without_thinking,
        true,
    )
}

fn determine_retry_strategy_inner(
    status_code: u16,
    error_text: &str,
    retry_after: Option<&str>,
    retried_without_thinking: bool,
    allow_grace_retry: bool,
) -> RetryStrategy {
    // 400 signature errors must be case-insensitive and cover all Google variants.
    let lower = error_text.to_lowercase();
    match status_code {
        // 400 error：仅在特定 Thinking 签名failed时retry一次
        400 if !retried_without_thinking
            && (lower.contains("invalid thought signature")
                || lower.contains("invalid `signature`")
                || lower.contains("invalid signature")
                || lower.contains("thought_signature")
                || lower.contains("thoughtsignature")
                || lower.contains("thinking.signature")
                || lower.contains("thinking.thinking")
                || lower.contains("corrupted thought signature")) =>
        {
            RetryStrategy::FixedDelay(Duration::from_millis(200))
        }

        // [HARDENED M4 / Issue #3301, #3377] 400 地理位置不支持error，触发代理故障转移与节点轮换
        400 if lower.contains("user location is not supported")
            || lower.contains("location is not supported")
            || lower.contains("geofenced")
            || lower.contains("region restricted")
            || lower.contains("country not supported")
            || (lower.contains("failed_precondition") && lower.contains("location")) =>
        {
            tracing::warn!("🛡️ [Geo-Fallback] 400 User location is not supported detected. Triggering ProxyFailover.");
            tokio::spawn(async {
                crate::proxy::proxy_pool::report_global_proxy_failure("active_node", "User location is not supported").await;
            });
            RetryStrategy::ProxyFailover
        }

        // 429 限流error
        429 => {
            // 优先使用service端return的 Retry-After / quotaResetDelay
            if let Some(parsed_delay) = crate::proxy::upstream::retry::parse_retry_delay_with_source(
                error_text,
                retry_after,
            ) {
                let delay_ms = parsed_delay.raw_ms;
                // 短期原accountretry已使用时，立即回到现有换号逻辑
                if crate::proxy::upstream::retry::should_grace_retry(delay_ms) {
                    if allow_grace_retry {
                        let actual_delay = parsed_delay.actual_wait_ms();
                        tracing::info!(
                            "Grace Retry Triggered: Delay {}ms is within window, using same account",
                            actual_delay
                        );
                        RetryStrategy::GraceRetry(Duration::from_millis(actual_delay))
                    } else {
                        RetryStrategy::FixedDelay(Duration::ZERO)
                    }
                } else {
                    // [MODERNIZED M2] Fast Failover on 429: Eliminate blocking client-facing sleep (was 30s)
                    // Failover immediately to next candidate Pro account in < 50ms without stalling client connection
                    RetryStrategy::FixedDelay(Duration::ZERO)
                }
            } else {
                // [MODERNIZED M2] Fast Failover on 429: Eliminate linear backoff on client connection
                RetryStrategy::FixedDelay(Duration::ZERO)
            }
        }

        // [HARDENED M4] 代理网关/连接error
        407 | 502 | 504 => {
            tracing::warn!("🛡️ [Proxy-Fallback] Gateway/Transport error {} detected. Triggering ProxyFailover.", status_code);
            tokio::spawn(async move {
                crate::proxy::proxy_pool::report_global_proxy_failure("active_node", "Gateway or transport failure").await;
            });
            RetryStrategy::ProxyFailover
        }

        // 503 service不可用 / 529 service器过载
        503 | 529 => {
            // 指数退避：起始 10s，上限 60s (针对 Google 边缘节点过载)
            RetryStrategy::ExponentialBackoff {
                base_ms: 10000,
                max_ms: 60000,
            }
        }

        // 500 service器内部error
        500 => {
            // 线性退避：起始 3s
            RetryStrategy::LinearBackoff { base_ms: 3000 }
        }

        // 401/403 认证/权限error：Switch account前给予极短缓冲
        401 | 403 => RetryStrategy::FixedDelay(Duration::from_millis(200)),

        // 404 资源未找到：Google Cloud Code API 的 404 通常是account级别的间歇性问题
        // (灰度发布、account权限不同步等)，轮换account往往能解决
        404 => RetryStrategy::FixedDelay(Duration::from_millis(300)),

        // 其他error：不retry
        _ => RetryStrategy::NoRetry,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_short_429_preserves_rotation_budget_and_structured_status() {
        let body = r#"{"error":{"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"1s"}]}}"#;

        let drive_failures = |account_count| {
            let mut state = RequestRetryState::default();
            let mut used_attempts = 0;
            let mut retry_same_account = false;
            let mut sends = Vec::new();

            while let Some(attempt) = next_rotation_attempt(
                &mut used_attempts,
                account_count,
                retry_same_account,
            ) {
                retry_same_account = false;
                sends.push(attempt);
                let account_id = format!("account-{}", attempt);
                let strategy =
                    state.determine_strategy(&account_id, 429, body, None, false);
                if matches!(strategy, RetryStrategy::GraceRetry(_)) {
                    assert!(!should_rotate_account(429, Some(&strategy)));
                    retry_same_account = true;
                } else {
                    assert!(should_rotate_account(429, Some(&strategy)));
                }
            }
            sends
        };

        assert_eq!(drive_failures(1), vec![0, 0]);
        assert_eq!(drive_failures(2), vec![0, 0, 1, 1]);

        let mut all_429 = FailureStatusTracker::default();
        all_429.record(StatusCode::TOO_MANY_REQUESTS);
        all_429.record(StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(all_429.final_status(), StatusCode::TOO_MANY_REQUESTS);

        for non_429 in [StatusCode::FORBIDDEN, StatusCode::SERVICE_UNAVAILABLE] {
            let mut mixed = FailureStatusTracker::default();
            mixed.record(non_429);
            mixed.record(StatusCode::TOO_MANY_REQUESTS);
            assert_eq!(mixed.final_status(), non_429);
        }

        let mut all_503 = FailureStatusTracker::default();
        all_503.record(StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(all_503.final_status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[test]
    fn test_geo_400_reclassified_to_proxy_failover() {
        let body = r#"{"error":{"code":400,"message":"User location is not supported for the requested model.","status":"FAILED_PRECONDITION"}}"#;
        let strategy = determine_retry_strategy(400, body, false);
        assert!(matches!(strategy, RetryStrategy::ProxyFailover));
        assert!(!should_rotate_account(400, Some(&strategy)));
    }
}

/// 执行退避策略并return是否应该继续retry
pub async fn apply_retry_strategy(
    strategy: RetryStrategy,
    attempt: usize,
    max_attempts: usize,
    status_code: u16,
    trace_id: &str,
) -> bool {
    match strategy {
        RetryStrategy::NoRetry => {
            debug!(
                "[{}] Non-retryable error {}, stopping",
                trace_id, status_code
            );
            false
        }

        RetryStrategy::FixedDelay(duration) => {
            let base_ms = duration.as_millis() as u64;
            if base_ms > 0 {
                info!(
                    "[{}] ⏱️ Retry with fixed delay: status={}, attempt={}/{}, delay={}ms",
                    trace_id,
                    status_code,
                    attempt + 1,
                    max_attempts,
                    base_ms
                );
                sleep(duration).await;
            } else {
                debug!(
                    "[{}] ⚡ Fast failover (<50ms): status={}, attempt={}/{}, rotating to next candidate Pro account immediately",
                    trace_id,
                    status_code,
                    attempt + 1,
                    max_attempts
                );
            }
            true
        }

        RetryStrategy::LinearBackoff { base_ms } => {
            let calculated_ms = base_ms * (attempt as u64 + 1);
            info!(
                "[{}] ⏱️ Retry with linear backoff: status={}, attempt={}/{}, delay={}ms",
                trace_id,
                status_code,
                attempt + 1,
                max_attempts,
                calculated_ms
            );
            sleep(Duration::from_millis(calculated_ms)).await;
            true
        }

        RetryStrategy::ExponentialBackoff { base_ms, max_ms } => {
            let calculated_ms = (base_ms * 2_u64.pow(attempt as u32)).min(max_ms);
            info!(
                "[{}] ⏱️ Retry with exponential backoff: status={}, attempt={}/{}, delay={}ms",
                trace_id,
                status_code,
                attempt + 1,
                max_attempts,
                calculated_ms
            );
            sleep(Duration::from_millis(calculated_ms)).await;
            true
        }

        RetryStrategy::GraceRetry(duration) => {
            info!(
                "[{}] ⚡ Grace Retry: Performing micro-wait ({}ms) on current account...",
                trace_id,
                duration.as_millis()
            );
            sleep(duration).await;
            true // 原地retry在 handlers 层面通过 should_rotate_account 判断是否切换
        }

        RetryStrategy::ProxyFailover => {
            info!(
                "[{}] 🌐 ProxyFailover: Performing dynamic proxy rotation (150ms backoff)...",
                trace_id
            );
            sleep(Duration::from_millis(150)).await;
            true
        }
    }
}

/// 判断是否应该轮换account
pub fn should_rotate_account(status_code: u16, strategy: Option<&RetryStrategy>) -> bool {
    // [NEW] 如果识别为 Grace Retry，则显式要求不轮换account
    if let Some(RetryStrategy::GraceRetry(_)) = strategy {
        return false;
    }

    // [NEW M4] if is ProxyFailover，在同一account下尝试代理节点切换，不强制丢弃或轮换account
    if let Some(RetryStrategy::ProxyFailover) = strategy {
        return false;
    }

    match status_code {
        // 这些error是account级别或特定节点quota的，需要轮换
        429 | 401 | 403 | 404 | 500 => true,
        // 503/529 通常是后端过载，切号效果有限，暂不轮换
        503 | 529 => false,
        _ => false,
    }
}

/// Detects model capabilities and configuration
/// POST /v1/models/detect
pub async fn handle_detect_model(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> Response {
    let model_name = body.get("model").and_then(|v| v.as_str()).unwrap_or("");

    if model_name.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing 'model' field").into_response();
    }

    // 1. Resolve mapping
    let mapped_model = crate::proxy::common::model_mapping::resolve_model_route(
        model_name,
        &*state.custom_mapping.read().await,
    );

    // 2. Resolve capabilities
    let config = crate::proxy::mappers::common_utils::resolve_request_config(
        model_name,
        &mapped_model,
        &None, // We don't check tools for static capability detection
        None,  // size
        None,  // quality
        None,  // image_size
        None,  // body (not needed for static detection)
    );

    // 3. Construct response
    let mut response = json!({
        "model": model_name,
        "mapped_model": mapped_model,
        "type": config.request_type,
        "features": {
            "has_web_search": config.inject_google_search,
            "is_image_gen": config.request_type == "image_gen"
        }
    });

    if let Some(img_conf) = config.image_config {
        if let Some(obj) = response.as_object_mut() {
            obj.insert("config".to_string(), img_conf);
        }
    }

    Json(response).into_response()
}

/// Toolchain Props (llama.cpp server compatibility for Hermes Agent, llama.cpp, vLLM)
/// GET /props or /v1/props?model=<optional>
pub async fn handle_toolchain_props(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let model = params.get("model").map(|s| s.as_str()).unwrap_or("gemini-2.5-flash");
    let max_output = crate::proxy::model_specs::get_max_output_tokens(model, None);
    let ctx_len: u64 = if model.contains("120b") {
        32768
    } else if model.contains("claude") {
        200000
    } else {
        1048576
    };

    Json(json!({
        "default_generation_settings": {
            "n_ctx": ctx_len,
            "n_predict": max_output,
            "model": model,
            "system_prompt": "",
            "chat_template": ""
        },
        "total_slots": 1,
        "model": model,
        "engine": "antigravity-shield"
    }))
}

/// Toolchain Version (vLLM / llama.cpp / client probing compatibility)
/// GET /version or /v1/version
pub async fn handle_toolchain_version() -> impl IntoResponse {
    Json(json!({
        "version": crate::constants::CURRENT_VERSION.as_str(),
        "app": "antigravity-shield",
        "engine": "shield-gateway"
    }))
}

/// Shield Proprietary Introspection & Context Telemetry Endpoint
/// GET /shield/context or /v1/shield/context
pub async fn handle_shield_context() -> impl IntoResponse {
    Json(json!({
        "app": "Antigravity-Shield",
        "version": crate::constants::CURRENT_VERSION.as_str(),
        "status": "operational",
        "protocols": ["openai", "claude", "gemini", "llama.cpp", "hermes"],
        "default_context_length": 1048576,
        "max_completion_tokens": 65536,
        "argon_support": true,
        "elastic_503_healing": true
    }))
}

