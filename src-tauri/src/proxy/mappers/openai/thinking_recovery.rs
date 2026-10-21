// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use serde_json::{json, Value};

/// 剥离所有标记为思维块的内容 (thought: true)
pub fn strip_all_thinking_blocks(contents: Vec<Value>) -> Vec<Value> {
    contents
        .into_iter()
        .map(|mut content| {
            if let Some(parts) = content.get_mut("parts").and_then(|v| v.as_array_mut()) {
                parts.retain(|part| {
                    !part
                        .get("thought")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
                });
            }
            content
        })
        .filter(|msg| {
            !msg["parts"]
                .as_array()
                .map(|a| a.is_empty())
                .unwrap_or(true)
        })
        .collect()
}

/// 针对思维model关闭工具循环
/// 先剥离思考块，然后注入合成的 Model 确认和 User 继续指令
#[allow(dead_code)]
pub fn close_tool_loop_for_thinking(contents: Vec<Value>) -> Vec<Value> {
    let mut stripped = strip_all_thinking_blocks(contents);

    // If 没有内容了，returnempty
    if stripped.is_empty() {
        return stripped;
    }

    // 合成model消息：工具执行完成
    stripped.push(json!({
        "role": "model",
        "parts": [{"text": "[Tool execution completed.]"}]
    }));

    // 合成user消息：hint继续
    stripped.push(json!({
        "role": "user",
        "parts": [{"text": "[Continue]"}]
    }));

    stripped
}
