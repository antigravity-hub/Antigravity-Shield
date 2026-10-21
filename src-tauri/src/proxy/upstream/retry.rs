// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

// 429 retry策略
// Duration 解析

use once_cell::sync::Lazy;
use regex::Regex;

static DURATION_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)([\d.]+)\s*(milliseconds?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)")
        .unwrap()
});

static RE_TEXT_DELAY_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"(?i)resets in ([^.,;\]\n>]+)").unwrap(),
        Regex::new(r"(?i)reset in ([^.,;\]\n>]+)").unwrap(),
        Regex::new(r"(?i)quota will reset after ([^.,;\]\n]+)").unwrap(),
        Regex::new(r"(?i)quota will reset in ([^.,;\]\n]+)").unwrap(),
        Regex::new(r"(?i)retry after ([^.,;\]\n]+)").unwrap(),
        Regex::new(r"(?i)reset after ([^.,;\]\n]+)").unwrap(),
        Regex::new(r"(?i)try again in ([^.,;\]\n]+)").unwrap(),
        Regex::new(r"(?i)backoff for ([^.,;\]\n]+)").unwrap(),
        Regex::new(r"(?i)(?:^|[\s(])wait\s+([^,;\]\n)]+)").unwrap(),
    ]
});

static RE_LEGACY_DELAY_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"(?i)quota will reset after ([^.,;\]\n]+)").unwrap(),
        Regex::new(r"(?i)retry after ([^.,;\]\n]+)").unwrap(),
        Regex::new(r#"(?i)quotaResetDelay["'=:\s]+([^\s,"}\]]+)"#).unwrap(),
    ]
});

static RETRY_HINT_KEYS: Lazy<std::collections::HashSet<&'static str>> = Lazy::new(|| {
    [
        "retryafter",
        "retry_after",
        "retrydelay",
        "retry_delay",
        "quotaresetdelay",
        "quota_reset_delay",
        "backofflimit",
        "backoff_limit",
    ]
    .iter()
    .cloned()
    .collect()
});

/// 解析 Duration 字符串 (e.g., "1.5s", "200ms", "1h16m0.667s")
pub fn parse_duration_ms(duration_str: &str) -> Option<u64> {
    let mut total_ms: f64 = 0.0;
    let mut matched = false;

    for cap in DURATION_RE.captures_iter(duration_str) {
        matched = true;
        let value: f64 = cap[1].parse().ok()?;
        let unit = cap[2].to_ascii_lowercase();

        match unit.as_str() {
            unit if unit == "ms" || unit.starts_with("millisecond") => total_ms += value,
            unit if unit == "s" || unit.starts_with("sec") || unit.starts_with("second") => {
                total_ms += value * 1000.0
            }
            unit if unit == "m" || unit.starts_with("min") || unit.starts_with("minute") => {
                total_ms += value * 60.0 * 1000.0
            }
            unit if unit == "h" || unit.starts_with("hr") || unit.starts_with("hour") => {
                total_ms += value * 60.0 * 60.0 * 1000.0
            }
            _ => {}
        }
    }

    if !matched {
        return None;
    }

    Some(total_ms.round() as u64)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetryDelaySource {
    Structured,
    ResponseText,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParsedRetryDelay {
    pub raw_ms: u64,
    pub source: RetryDelaySource,
}

impl ParsedRetryDelay {
    pub fn actual_wait_ms(self) -> u64 {
        let buffer_ms = match self.source {
            RetryDelaySource::Structured => 200,
            RetryDelaySource::ResponseText => 1000,
        };
        self.raw_ms.saturating_add(buffer_ms)
    }
}

/// 从 Retry-After 或 429 error中提取原始 retry delay (深度递归解析)
pub fn parse_retry_delay(error_text: &str, retry_after: Option<&str>) -> Option<u64> {
    parse_retry_delay_with_source(error_text, retry_after).map(|delay| delay.raw_ms)
}

pub fn parse_retry_delay_with_source(
    error_text: &str,
    retry_after: Option<&str>,
) -> Option<ParsedRetryDelay> {
    // 1. Retry-After delta-seconds，也兼容已有的 duration 字符串来源
    if let Some(value) = retry_after.map(str::trim).filter(|value| !value.is_empty()) {
        if let Ok(seconds) = value.parse::<u64>() {
            return seconds.checked_mul(1000).map(|raw_ms| ParsedRetryDelay {
                raw_ms,
                source: RetryDelaySource::Structured,
            });
        }
        if let Some(delay) = parse_duration_ms(value) {
            return Some(ParsedRetryDelay {
                raw_ms: delay,
                source: RetryDelaySource::Structured,
            });
        }
    }

    // 2. 结构化 JSON 字段优先，避免把 JSON 中的 retryDelay 当作response文字。
    if let Ok(json) = serde_json::from_str(error_text) {
        if let Some(raw_ms) = extract_structured_delay_recursive(&json, 0, false) {
            return Some(ParsedRetryDelay {
                raw_ms,
                source: RetryDelaySource::Structured,
            });
        }
    }

    // 3. 仅从response文字中提取自然语言时长。
    for re in RE_TEXT_DELAY_PATTERNS.iter() {
        if let Some(cap) = re.captures(error_text) {
            if let Some(delay) = parse_duration_ms(&cap[1]) {
                return Some(ParsedRetryDelay {
                    raw_ms: delay,
                    source: RetryDelaySource::ResponseText,
                });
            }
        }
    }
    None
}

/// Preserve the pre-state-machine delay parsing used by the Claude handler.
pub(crate) fn parse_legacy_retry_delay(error_text: &str) -> Option<u64> {
    for re in RE_LEGACY_DELAY_PATTERNS.iter() {
        if let Some(cap) = re.captures(error_text) {
            if let Some(delay) = parse_duration_ms(&cap[1]) {
                return Some(delay);
            }
        }
    }

    let delay = if let Ok(json) = serde_json::from_str(error_text) {
        extract_structured_delay_recursive(&json, 0, true)
    } else {
        None
    };

    delay.map(|delay_ms| delay_ms.saturating_add(1500))
}

/// 递归提取结构化延迟
fn extract_structured_delay_recursive(
    value: &serde_json::Value,
    depth: usize,
    parse_unkeyed_strings: bool,
) -> Option<u64> {
    if depth > 8 {
        return None;
    }

    match value {
        serde_json::Value::Object(map) => {
            // Check: current对象是否本身就是一个 Duration 对象 (seconds/nanos)
            if let Some(d) = parse_structured_duration_object(value) {
                return Some(d);
            }

            // 递归扫描子字段
            for (key, val) in map {
                // 模糊 Key 匹配 (转小写, 去除分隔符)
                let normalized_key = key.to_lowercase().replace('-', "").replace('_', "");
                if RETRY_HINT_KEYS.contains(normalized_key.as_str()) {
                    // If 命中了 Hint Key，直接尝试解析其内容
                    if let Some(d) = parse_structured_duration_value(val) {
                        return Some(d);
                    }
                }
                // 继续深度搜索
                if let Some(d) =
                    extract_structured_delay_recursive(val, depth + 1, parse_unkeyed_strings)
                {
                    return Some(d);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for val in arr {
                if let Some(d) =
                    extract_structured_delay_recursive(val, depth + 1, parse_unkeyed_strings)
                {
                    return Some(d);
                }
            }
        }
        serde_json::Value::String(s) if parse_unkeyed_strings => return parse_duration_ms(s),
        serde_json::Value::String(_) => {}
        _ => {}
    }
    None
}

/// 解析强type的 Duration 对象 (Google 格式: {seconds: 1, nanos: 0})
fn parse_structured_duration_object(value: &serde_json::Value) -> Option<u64> {
    let obj = value.as_object()?;
    let seconds = obj
        .get("seconds")
        .or_else(|| obj.get("Seconds"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let nanos = obj
        .get("nanos")
        .or_else(|| obj.get("Nanos"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    if seconds > 0.0 || nanos > 0.0 {
        let total_ms = (seconds * 1000.0) + (nanos / 1_000_000.0);
        return Some(total_ms.round() as u64);
    }
    None
}

/// 解析各种可能包含时长info的 Value
fn parse_structured_duration_value(value: &serde_json::Value) -> Option<u64> {
    match value {
        serde_json::Value::String(s) => parse_duration_ms(s),
        serde_json::Value::Number(n) => n.as_f64().map(|f| (f * 1000.0).round() as u64),
        serde_json::Value::Object(_) => parse_structured_duration_object(value),
        _ => None,
    }
}

/// [NEW] 判断是否应当执行 Grace Retry (原地retry)
/// 当 429 报错hint的reset时间在 5s 内，则原地retry比Switch account更有利。
pub fn should_grace_retry(duration_ms: u64) -> bool {
    duration_ms > 0 && duration_ms <= 5000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_duration_ms() {
        assert_eq!(parse_duration_ms("1.5s"), Some(1500));
        assert_eq!(parse_duration_ms("200ms"), Some(200));
        assert_eq!(parse_duration_ms("1h16m0.667s"), Some(4560667));
        assert_eq!(parse_duration_ms("58h24m53s"), Some(210_293_000));
        assert_eq!(parse_duration_ms("72h"), Some(259_200_000));
        assert_eq!(parse_duration_ms("invalid"), None);
    }

    #[test]
    fn task_parses_google_retry_info_and_retry_after() {
        let retry_info_1s = r#"{
            "error": {
                "details": [{
                    "@type": "type.googleapis.com/google.rpc.RetryInfo",
                    "retryDelay": "1s"
                }]
            }
        }"#;
        let retry_info_3s = r#"{
            "error": {
                "details": [{
                    "@type": "type.googleapis.com/google.rpc.RetryInfo",
                    "retryDelay": "3s"
                }]
            }
        }"#;

        let structured_1s = parse_retry_delay_with_source(retry_info_1s, None).unwrap();
        assert_eq!(structured_1s.raw_ms, 1000);
        assert_eq!(structured_1s.source, RetryDelaySource::Structured);
        assert_eq!(structured_1s.actual_wait_ms(), 1200);

        let structured_3s = parse_retry_delay_with_source(retry_info_3s, None).unwrap();
        assert_eq!(structured_3s.actual_wait_ms(), 3200);

        let quota_reset = parse_retry_delay_with_source(
            r#"{"error":{"details":[{"metadata":{"quotaResetDelay":"5s"}}]}}"#,
            None,
        )
        .unwrap();
        assert_eq!(quota_reset.actual_wait_ms(), 5200);
        assert!(should_grace_retry(quota_reset.raw_ms));

        let retry_after = parse_retry_delay_with_source("", Some("3")).unwrap();
        assert_eq!(retry_after.actual_wait_ms(), 3200);

        let response_text = parse_retry_delay_with_source("quota reset after 3s", None).unwrap();
        assert_eq!(response_text.source, RetryDelaySource::ResponseText);
        assert_eq!(response_text.actual_wait_ms(), 4000);
    }

    #[test]
    fn test_is_server_overloaded() {
        assert!(is_server_overloaded(503, "Service Unavailable"));
        assert!(is_server_overloaded(529, "Site overloaded"));
        assert!(is_server_overloaded(500, "The model is overloaded. Please try again."));
        assert!(!is_server_overloaded(429, "RESOURCE_EXHAUSTED: quota exceeded"));
        assert!(!is_server_overloaded(404, "Not Found"));
    }

    #[test]
    fn test_try_degrade_thinking_budget() {
        let mut b1 = serde_json::json!({
            "generationConfig": {
                "thinkingConfig": {
                    "thinkingBudget": 24576
                }
            }
        });
        assert!(try_degrade_thinking_budget(&mut b1));
        assert_eq!(b1["generationConfig"]["thinkingConfig"]["thinkingBudget"], 4000);

        let mut b2 = serde_json::json!({
            "request": {
                "generationConfig": {
                    "thinkingConfig": {
                        "thinkingBudget": -1
                    }
                }
            }
        });
        assert!(try_degrade_thinking_budget(&mut b2));
        assert_eq!(b2["request"]["generationConfig"]["thinkingConfig"]["thinkingBudget"], 4000);

        let mut b3 = serde_json::json!({
            "generationConfig": {
                "thinkingConfig": {
                    "thinkingBudget": 2048
                }
            }
        });
        assert!(!try_degrade_thinking_budget(&mut b3));
        assert_eq!(b3["generationConfig"]["thinkingConfig"]["thinkingBudget"], 2048);
    }
}

/// Check if the upstream server is reporting an overload condition (503 / 529 / model overloaded)
pub fn is_server_overloaded(status_code: u16, error_text: &str) -> bool {
    if status_code == 503 || status_code == 529 {
        return true;
    }
    let lower = error_text.to_lowercase();
    lower.contains("model is overloaded")
        || lower.contains("server is overloaded")
        || lower.contains("the model is overloaded")
        || lower.contains("resource_exhausted: model is overloaded")
}

/// Attempt to degrade thinking budget in-place to 4000 (Medium tier) to resolve 503/529 overload
/// without triggering cross-account failover which discards the upstream Prefix Cache.
/// Returns true if thinking budget was degraded; false if it was already <= 4000 or absent.
pub fn try_degrade_thinking_budget(body: &mut serde_json::Value) -> bool {
    let mut modified = false;

    // Helper to inspect and degrade thinkingBudget in a JSON object
    let mut check_and_degrade = |target: &mut serde_json::Value| -> bool {
        if let Some(tb) = target.get_mut("thinkingBudget") {
            if let Some(v) = tb.as_i64() {
                if v == -1 || v > 4000 {
                    *tb = serde_json::json!(4000);
                    return true;
                }
            }
        }
        false
    };

    // Case 1: body["generationConfig"]["thinkingConfig"]
    if let Some(tc) = body.pointer_mut("/generationConfig/thinkingConfig") {
        if check_and_degrade(tc) {
            modified = true;
        }
    }

    // Case 2: body["request"]["generationConfig"]["thinkingConfig"] (wrapped)
    if let Some(tc) = body.pointer_mut("/request/generationConfig/thinkingConfig") {
        if check_and_degrade(tc) {
            modified = true;
        }
    }

    if modified {
        tracing::info!(
            "[Elastic-Self-Healing] Degraded thinking budget to 4000 in-place to recover from 503 Overload while preserving Prefix Cache"
        );
    }

    modified
}

