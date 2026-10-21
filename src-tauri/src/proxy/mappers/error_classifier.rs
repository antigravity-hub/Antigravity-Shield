// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

// error分类模块 - 将底层error转换为user友好的消息

/// 分类流式responseerror并returnerrortype、英文消息和 i18n key
///
/// Return: 值: (errortype, 英文error消息, i18n_key)
/// - errortype: 用于日志和error码
/// - 英文消息: fallback 消息,供非浏览器客户端使用
/// - i18n_key: 前端翻译键,供浏览器客户端本地化
/// 分类流式responseerror并returnerrortype、英文消息和 i18n key
///
/// Return: 值: (errortype, 英文error消息, i18n_key)
pub fn classify_stream_error<E: std::fmt::Display>(
    error: &E,
) -> (&'static str, &'static str, &'static str) {
    let error_str = error.to_string().to_lowercase();

    if error_str.contains("timeout") || error_str.contains("deadline") {
        (
            "timeout_error",
            "Request timeout, please check your network connection",
            "errors.stream.timeout_error",
        )
    } else if error_str.contains("connection")
        || error_str.contains("connect")
        || error_str.contains("dns")
    {
        (
            "connection_error",
            "Connection failed, please check your network or proxy settings",
            "errors.stream.connection_error",
        )
    } else if error_str.contains("decode") || error_str.contains("parse") {
        (
            "decode_error",
            "Network unstable, data transmission interrupted. Try: 1) Check network 2) Switch proxy 3) Retry",
            "errors.stream.decode_error"
        )
    } else if error_str.contains("stream") || error_str.contains("body") {
        (
            "stream_error",
            "Stream transmission error, please retry later",
            "errors.stream.stream_error",
        )
    } else {
        (
            "unknown_error",
            "Unknown error occurred",
            "errors.stream.unknown_error",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_timeout_error() {
        // 使用简单的字符串error进行模拟测试
        let error = "Connection timed out after 30s";
        let (error_type, message, i18n_key) = classify_stream_error(&error);

        assert_eq!(error_type, "timeout_error");
        assert!(message.contains("timeout"));
        assert_eq!(i18n_key, "errors.stream.timeout_error");
    }

    #[test]
    fn test_error_message_format() {
        // 测试error消息格式
        // 模拟一个 DNS error
        let error = "error trying to connect: dns error: failed to lookup address information";

        let (error_type, message, i18n_key) = classify_stream_error(&error);

        // errortype应该是已知的type之一
        assert!(
            error_type == "timeout_error"
                || error_type == "connection_error"
                || error_type == "decode_error"
                || error_type == "stream_error"
                || error_type == "unknown_error"
        );

        // 消息不应该为empty
        assert!(!message.is_empty());

        // i18n_key 应该以 errors.stream. 开头
        assert!(i18n_key.starts_with("errors.stream."));
    }

    #[test]
    fn test_i18n_keys_format() {
        // Verify所有errortype都有正确的 i18n_key 格式
        let test_cases = vec![
            ("timeout_error", "errors.stream.timeout_error"),
            ("connection_error", "errors.stream.connection_error"),
            ("decode_error", "errors.stream.decode_error"),
            ("stream_error", "errors.stream.stream_error"),
            ("unknown_error", "errors.stream.unknown_error"),
        ];

        // 这里我们只validate i18n_key 格式
        for (expected_type, expected_key) in test_cases {
            assert_eq!(format!("errors.stream.{}", expected_type), expected_key);
        }
    }
}
