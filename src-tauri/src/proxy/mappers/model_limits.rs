// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

// model输出 Token 限额管理 (DEPRECATED: 逻辑已迁移至 crate::proxy::model_specs)
// 为了兼容性，保留此入口并重定向到 model_specs。

use crate::proxy::model_specs;

/// Get: model的输出 Token 限额
///
/// # 参数
/// - `model_name`: 映射后的model名
/// - `dynamic_limit`: 如果已知动态限额则传入（已废弃，建议直接传入 ProxyToken 到 model_specs）
#[allow(dead_code)]
pub fn get_model_output_limit(model_name: &str, dynamic_limit: Option<u64>) -> u64 {
    // Compatibility逻辑：如果没有 dynamic_limit，则调用 model_specs get（目前不传入 token）
    if let Some(limit) = dynamic_limit {
        limit
    } else {
        model_specs::get_max_output_tokens(model_name, None)
    }
}
