use serde_json::Value;

/// 使用 Antigravity 的 loadCodeAssist API 获取 project_id
/// 这是获取 cloudaicompanionProject 的正确方式
pub async fn fetch_project_id(access_token: &str) -> Result<String, String> {
    const ENDPOINTS: [&str; 2] = [
        "https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
        "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
    ];

    let request_body = serde_json::json!({
        "metadata": {
            "ideType": "ANTIGRAVITY"
        }
    });

    let client = crate::utils::http::get_client();
    let mut last_error = String::new();

    for url in ENDPOINTS {
        let response = match client
            .post(url)
            .bearer_auth(access_token)
            .header("User-Agent", crate::constants::USER_AGENT.as_str())
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
        {
            Ok(res) => res,
            Err(e) => {
                last_error = format!("loadCodeAssist 请求失败 ({}): {}", url, e);
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            last_error = format!("loadCodeAssist 返回错误 {} ({}): {}", status, url, body);
            continue;
        }

        let data: Value = match response.json().await {
            Ok(d) => d,
            Err(e) => {
                last_error = format!("解析响应失败 ({}): {}", url, e);
                continue;
            }
        };

        // 提取 cloudaicompanionProject
        if let Some(project_id) = data.get("cloudaicompanionProject").and_then(|v| v.as_str()) {
            return Ok(project_id.to_string());
        }
    }

    if !last_error.is_empty() {
        return Err(last_error);
    }

    // If 没有返回 project_id，说明账号无资格，返回错误以触发 token_manager 的稳定兜底逻辑
    Err("账号无资格获取官方 cloudaicompanionProject".to_string())
}
