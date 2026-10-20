// 模型名称映射
use dashmap::DashMap;
use once_cell::sync::Lazy;
use std::collections::HashMap;

// 动态官方废弃模型转发表 (old_model_id -> new_model_id)
pub static DYNAMIC_MODEL_FORWARDING_RULES: Lazy<DashMap<String, String>> = Lazy::new(|| {
    let map = DashMap::new();
    // Deprecated by Google upstream (Google rejects 3.5 Flash) -> auto-forward to 3.8 Flash
    map.insert("gemini-3.5-flash".to_string(), "gemini-3.8-flash".to_string());
    map.insert("gemini-3.5-flash-low".to_string(), "gemini-3.8-flash-low".to_string());
    map.insert("gemini-3.5-flash-medium".to_string(), "gemini-3.8-flash-medium".to_string());
    map.insert("gemini-3.5-flash-high".to_string(), "gemini-3.8-flash-high".to_string());
    map.insert("gemini-3.5-flash-extra-low".to_string(), "gemini-3.8-flash-low".to_string());
    map.insert("gemini-3.5-flash-lite".to_string(), "gemini-3.1-flash-lite".to_string());
    // Gemini 4 Pro quota exhaustion fallback to working Gemini 4 Argon
    map.insert("gemini-4-pro".to_string(), "gemini-4-argon".to_string());
    map.insert("gemini-4.0-pro".to_string(), "gemini-4-argon".to_string());
    map
});

pub fn update_dynamic_forwarding_rules(old_model: String, new_model: String) {
    if !DYNAMIC_MODEL_FORWARDING_RULES.contains_key(&old_model) {
        crate::modules::logger::log_info(&format!(
            "[Mapping] Registered automatic forwarding rule: {} -> {}",
            old_model, new_model
        ));
    }
    DYNAMIC_MODEL_FORWARDING_RULES.insert(old_model, new_model);
}

use crate::proxy::common::model_registry::DynamicModelRegistry;

/// Map Claude and downstream model names dynamically using the 5-tier priority cascade of DynamicModelRegistry
pub fn map_claude_model_to_gemini(input: &str) -> String {
    // 1. Upstream Dynamic Retirement Rules
    if let Some(forwarded) = DYNAMIC_MODEL_FORWARDING_RULES.get(input) {
        return forwarded.value().clone();
    }

    // 2. Delegate to the global dynamic model registry
    DynamicModelRegistry::global().resolve_model(input, None)
}

/// 获取所有内置支持的模型列表关键字 (Forward to DynamicModelRegistry)
pub fn get_supported_models() -> Vec<String> {
    DynamicModelRegistry::global().get_available_models(None, false)
}

/// 动态获取可用模型列表 (支持全账号汇总或指定账号/固定账号作用域，Issue #3384)
pub async fn get_all_dynamic_models(
    custom_mapping: &tokio::sync::RwLock<std::collections::HashMap<String, String>>,
    token_manager: Option<&crate::proxy::token_manager::TokenManager>,
    only_raw_quota_models: bool,
) -> Vec<String> {
    get_dynamic_models_scoped(custom_mapping, token_manager, only_raw_quota_models, None).await
}

/// 动态获取可用模型列表，支持指定 account_id (Issue #3384)
pub async fn get_dynamic_models_scoped(
    custom_mapping: &tokio::sync::RwLock<std::collections::HashMap<String, String>>,
    token_manager: Option<&crate::proxy::token_manager::TokenManager>,
    only_raw_quota_models: bool,
    target_account_id: Option<&str>,
) -> Vec<String> {
    use std::collections::BTreeSet;
    let mut model_ids = BTreeSet::new();

    // 1. Resolve effective target account ID
    let scoped_account_id = match target_account_id {
        Some(id) if !id.is_empty() => Some(id.to_string()),
        _ => {
            if let Some(tm) = token_manager {
                tm.get_preferred_account_id().await
            } else {
                None
            }
        }
    };

    // 2. Fetch live discovered models from DynamicModelRegistry (Zero Disk I/O)
    for model_id in DynamicModelRegistry::global().get_available_models(scoped_account_id.as_deref(), only_raw_quota_models) {
        model_ids.insert(model_id);
    }

    // 3. Include user custom mappings when not restricted to strictly raw quota
    if !only_raw_quota_models {
        let mapping = custom_mapping.read().await;
        for key in mapping.keys() {
            model_ids.insert(key.clone());
        }
    }

    model_ids.into_iter().collect()
}

/// Wildcard matching - supports multiple wildcards
///
/// **Note**: Matching is **case-sensitive**. Pattern `GPT-4*` will NOT match `gpt-4-turbo`.
///
/// Examples:
/// - `gpt-4*` matches `gpt-4`, `gpt-4-turbo` ✓
/// - `claude-*-sonnet-*` matches `claude-3-5-sonnet-20241022` ✓
/// - `*-thinking` matches `claude-opus-4-5-thinking` ✓
/// - `a*b*c` matches `a123b456c` ✓
fn wildcard_match(pattern: &str, text: &str) -> bool {
    let parts: Vec<&str> = pattern.split('*').collect();

    // No wildcard - exact match
    if parts.len() == 1 {
        return pattern == text;
    }

    let mut text_pos = 0;

    for (i, part) in parts.iter().enumerate() {
        if part.is_empty() {
            continue; // Skip empty segments from consecutive wildcards
        }

        if i == 0 {
            // First segment must match start
            if !text[text_pos..].starts_with(part) {
                return false;
            }
            text_pos += part.len();
        } else if i == parts.len() - 1 {
            // Last segment must match end
            return text[text_pos..].ends_with(part);
        } else {
            // Middle segments - find next occurrence
            if let Some(pos) = text[text_pos..].find(part) {
                text_pos += pos + part.len();
            } else {
                return false;
            }
        }
    }

    true
}

/// 核心模型路由解析引擎
/// 优先级：精确匹配 > 通配符匹配 > 系统默认映射
///
/// # 参数
/// - `original_model`: 原始模型名称
/// - `custom_mapping`: 用户自定义映射表
///
/// # 返回
/// 映射后的目标模型名称
pub fn resolve_model_route(
    original_model: &str,
    custom_mapping: &std::collections::HashMap<String, String>,
) -> String {
    // 0. API 热更新废弃模型转发 (最高物理优先级，强制纠正)
    // 如果用户非要用已经被移除的模型，并且官方下发了 fallback path，我们在此拦截并纠正
    if let Some(forwarded) = DYNAMIC_MODEL_FORWARDING_RULES.get(original_model) {
        crate::modules::logger::log_info(&format!(
            "[Router] 官方淘汰重定向: {} -> {}",
            original_model,
            forwarded.value()
        ));
        return forwarded.value().clone();
    }

    // 0.5. IDE Gemini 4 Argon Brain Override
    // Automatically routes IDE Flash chat requests to Gemini 4 Argon with configurable thinking tier
    let argon_cfg = crate::proxy::config::get_argon_override_config();
    if argon_cfg.enabled {
        let lower = original_model.to_lowercase();
        let is_flash_or_ide = lower.contains("flash")
            || lower.contains("placeholder_m31")
            || (lower.starts_with("gemini-3") && !lower.contains("pro") && !lower.contains("image"))
            || lower.starts_with("gemini-2.5-flash");
        let is_image = lower.contains("image");

        if is_flash_or_ide && !is_image {
            let target_model = match argon_cfg.tier.to_lowercase().as_str() {
                "low" => "gemini-4-argon-low",
                "medium" => "gemini-4-argon-medium",
                _ => "gemini-4-argon-high",
            };
            crate::modules::logger::log_info(&format!(
                "[Argon-Brain-Hijack] Intercepted IDE chat model '{}' -> '{}' (Tier: {})",
                original_model, target_model, argon_cfg.tier
            ));
            return target_model.to_string();
        }
    }

    // 1. 精确匹配 (次高优先级)
    if let Some(target) = custom_mapping.get(original_model) {
        crate::modules::logger::log_info(&format!(
            "[Router] 精确映射: {} -> {}",
            original_model, target
        ));
        return target.clone();
    }

    // 2. Wildcard match - most specific (highest non-wildcard chars) wins
    // Note: When multiple patterns have the SAME specificity, HashMap iteration order
    // determines the result (non-deterministic). Users can avoid this by making patterns
    // more specific. Future improvement: use IndexMap + frontend sorting for full control.
    let mut best_match: Option<(&str, &str, usize)> = None;

    for (pattern, target) in custom_mapping.iter() {
        if pattern.contains('*') && wildcard_match(pattern, original_model) {
            let specificity = pattern.chars().count() - pattern.matches('*').count();
            if best_match.is_none() || specificity > best_match.unwrap().2 {
                best_match = Some((pattern.as_str(), target.as_str(), specificity));
            }
        }
    }

    if let Some((pattern, target, _)) = best_match {
        crate::modules::logger::log_info(&format!(
            "[Router] Wildcard match: {} -> {} (rule: {})",
            original_model, target, pattern
        ));
        return target.to_string();
    }

    // 3. 系统默认映射
    let result = map_claude_model_to_gemini(original_model);
    if result != original_model {
        crate::modules::logger::log_info(&format!(
            "[Router] 系统默认映射: {} -> {}",
            original_model, result
        ));
    }
    result
}

/// Normalize any physical model name to one of the 3 standard protection IDs.
/// This ensures quota protection works consistently regardless of API versioning or request variations.
///
/// Standard IDs:
/// - `gemini-3-flash`: All Flash variants (1.5-flash, 2.5-flash, 3-flash, etc.)
/// - `gemini-3.1-flash-image`: Flash image generation/edit quota.
/// - `gemini-3-pro-high`: All Pro variants (1.5-pro, 2.5-pro, etc.)
/// - `gemini-3-pro-image`: Pro image generation quota.
/// - `claude-sonnet-4-5`: All Claude Sonnet variants (3-5-sonnet, sonnet-4-5, etc.)
///
/// Returns `None` if the model doesn't match any of the 3 protected categories.
pub fn normalize_to_standard_id(model_name: &str) -> Option<String> {
    let lower = model_name.to_lowercase();

    // 1. Image resources must keep Flash image and Pro image in separate quota buckets.
    // The quota API exposes `gemini-3.1-flash-image` separately, so grouping it under
    // `gemini-3-pro-image` makes available Flash image quota look exhausted.
    if lower.contains("image") {
        if lower.contains("flash") {
            return Some("gemini-3.1-flash-image".to_string());
        }
        return Some("gemini-3-pro-image".to_string());
    }

    // 2. gemini-3-flash (包含所有 flash 变体)
    if lower.contains("flash") {
        return Some("gemini-3-flash".to_string());
    }

    // 3. gemini-3-pro-high (包含 pro 变体)
    if lower.contains("pro") && !lower.contains("image") {
        return Some("gemini-3-pro-high".to_string());
    }

    // 4. Claude 系列 (合并 Opus, Sonnet, Haiku 为统一保护组 'claude')
    if lower.contains("claude")
        || lower.contains("opus")
        || lower.contains("sonnet")
        || lower.contains("haiku")
    {
        return Some("claude".to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_mapping() {
        assert_eq!(
            map_claude_model_to_gemini("claude-3-5-sonnet-20241022"),
            "claude-sonnet-4-6"
        );
        // [Redirect] Sonnet 4.5 -> Sonnet 4.6
        assert_eq!(
            map_claude_model_to_gemini("claude-sonnet-4-5"),
            "claude-sonnet-4-6"
        );
        assert_eq!(
            map_claude_model_to_gemini("claude-sonnet-4-5-thinking"),
            "claude-sonnet-4-6-thinking"
        );
        assert_eq!(
            map_claude_model_to_gemini("claude-opus-4"),
            "claude-opus-4-6-thinking"
        );
        // Test gemini pass-through (should not be caught by "mini" rule)
        assert_eq!(
            map_claude_model_to_gemini("gemini-2.5-flash-mini-test"),
            "gemini-2.5-flash-mini-test"
        );
        assert_eq!(map_claude_model_to_gemini("unknown-model"), "unknown-model");
        // Gemini Pro concrete IDs should pass through unchanged.
        assert_eq!(
            map_claude_model_to_gemini("gemini-3-pro-high"),
            "gemini-pro-agent"
        );
        assert_eq!(
            map_claude_model_to_gemini("gemini-3-pro-low"),
            "gemini-3-pro-low"
        );
    }

    #[tokio::test]
    async fn test_get_all_dynamic_models_only_raw_quota_models() {
        let custom_mapping = tokio::sync::RwLock::new(
            [("gpt-4o".to_string(), "gemini-3.1-pro-high".to_string())]
                .into_iter()
                .collect(),
        );

        // When only_raw_quota_models is TRUE, custom_mapping & built-in aliases (like gpt-4o) should be filtered out
        let models_raw = get_all_dynamic_models(&custom_mapping, None, true).await;
        assert!(!models_raw.contains(&"gpt-4o".to_string()));

        // When only_raw_quota_models is FALSE, custom_mapping should be included
        let models_all = get_all_dynamic_models(&custom_mapping, None, false).await;
        assert!(models_all.contains(&"gpt-4o".to_string()));
    }

    #[test]
    fn test_mappings_continued() {
        assert_eq!(
            map_claude_model_to_gemini("gemini-3.1-pro-high"),
            "gemini-pro-agent"
        );
        assert_eq!(
            map_claude_model_to_gemini("gemini-3.1-pro-low"),
            "gemini-3.1-pro-low"
        );
        // Generic aliases still map to preview entrypoint.
        assert_eq!(
            map_claude_model_to_gemini("gemini-3-pro"),
            "gemini-3-pro-preview"
        );
        assert_eq!(
            map_claude_model_to_gemini("gemini-3.1-pro"),
            "gemini-3.1-pro-preview"
        );
        assert_eq!(
            map_claude_model_to_gemini("gemini-3.8-flash"),
            "gemini-3-flash"
        );
        assert_eq!(
            map_claude_model_to_gemini("gpt-4o-mini"),
            "gemini-3-flash"
        );

        // Test Normalization (Opus 4.6 now merged into "claude" group)
        assert_eq!(
            normalize_to_standard_id("claude-opus-4-6-thinking"),
            Some("claude".to_string())
        );
        assert_eq!(
            normalize_to_standard_id("claude-sonnet-4-5"),
            Some("claude".to_string())
        );

        // [Regression] gemini-3-pro-image must NOT be grouped with gemini-3-pro-high
        assert_eq!(
            normalize_to_standard_id("gemini-3-pro-image"),
            Some("gemini-3-pro-image".to_string())
        );
        assert_eq!(
            normalize_to_standard_id("gemini-3-pro-high"),
            Some("gemini-3-pro-high".to_string())
        );

        // [FIX #1955] Test normalization with image suffixes
        assert_eq!(
            normalize_to_standard_id("gemini-3-pro-image-4k"),
            Some("gemini-3-pro-image".to_string())
        );
        assert_eq!(
            normalize_to_standard_id("gemini-3-pro-image-16x9"),
            Some("gemini-3-pro-image".to_string())
        );
        assert_eq!(
            normalize_to_standard_id("gemini-3-pro-image-4k-16x9"),
            Some("gemini-3-pro-image".to_string())
        );
        assert_eq!(
            normalize_to_standard_id("gemini-3.1-flash-image"),
            Some("gemini-3.1-flash-image".to_string())
        );
        assert_eq!(
            normalize_to_standard_id("gemini-3.1-flash-image-4k"),
            Some("gemini-3.1-flash-image".to_string())
        );
    }

    #[test]
    fn test_wildcard_priority() {
        let mut custom = HashMap::new();
        custom.insert("gpt*".to_string(), "fallback".to_string());
        custom.insert("gpt-4*".to_string(), "specific".to_string());
        custom.insert("claude-opus-*".to_string(), "opus-default".to_string());
        custom.insert(
            "claude-opus*thinking".to_string(),
            "opus-thinking".to_string(),
        );

        // More specific pattern wins
        assert_eq!(resolve_model_route("gpt-4-turbo", &custom), "specific");
        assert_eq!(resolve_model_route("gpt-3.5", &custom), "fallback");
        // Suffix constraint is more specific than prefix-only
        assert_eq!(
            resolve_model_route("claude-opus-4-5-thinking", &custom),
            "opus-thinking"
        );
        assert_eq!(
            resolve_model_route("claude-opus-4", &custom),
            "opus-default"
        );
    }

    #[test]
    fn test_multi_wildcard_support() {
        let mut custom = HashMap::new();
        custom.insert(
            "claude-*-sonnet-*".to_string(),
            "sonnet-versioned".to_string(),
        );
        custom.insert("gpt-*-*".to_string(), "gpt-multi".to_string());
        custom.insert("*thinking*".to_string(), "has-thinking".to_string());

        // Multi-wildcard patterns should work
        assert_eq!(
            resolve_model_route("claude-3-5-sonnet-20241022", &custom),
            "sonnet-versioned"
        );
        assert_eq!(
            resolve_model_route("gpt-4-turbo-preview", &custom),
            "gpt-multi"
        );
        assert_eq!(
            resolve_model_route("claude-thinking-extended", &custom),
            "has-thinking"
        );

        // Negative case: *thinking* should NOT match models without "thinking"
        assert_eq!(
            resolve_model_route("random-model-name", &custom),
            "random-model-name" // Falls back to system default (pass-through)
        );
    }

    #[test]
    fn test_wildcard_edge_cases() {
        let mut custom = HashMap::new();
        custom.insert("prefix*".to_string(), "prefix-match".to_string());
        custom.insert("*".to_string(), "catch-all".to_string());
        custom.insert("a*b*c".to_string(), "multi-wild".to_string());

        // Specificity: "prefix*" (6) > "*" (0)
        assert_eq!(
            resolve_model_route("prefix-anything", &custom),
            "prefix-match"
        );
        // Catch-all has lowest specificity
        assert_eq!(resolve_model_route("random-model", &custom), "catch-all");
        // Multi-wildcard: "a*b*c" (3)
        assert_eq!(resolve_model_route("a-test-b-foo-c", &custom), "multi-wild");
    }

    #[test]
    fn test_argon_ide_brain_override() {
        let custom = HashMap::new();

        // 1. Initially disabled
        crate::proxy::config::update_argon_override_config(crate::proxy::config::IdeArgonOverrideConfig {
            enabled: false,
            tier: "high".to_string(),
        });
        assert_eq!(resolve_model_route("gemini-3.8-flash", &custom), "gemini-3-flash");

        // 2. Enable High tier
        crate::proxy::config::update_argon_override_config(crate::proxy::config::IdeArgonOverrideConfig {
            enabled: true,
            tier: "high".to_string(),
        });
        assert_eq!(resolve_model_route("gemini-3.8-flash", &custom), "gemini-4-argon-high");
        assert_eq!(resolve_model_route("gemini-3.8-flash-medium", &custom), "gemini-4-argon-high");
        assert_eq!(resolve_model_route("gemini-3-flash", &custom), "gemini-4-argon-high");
        assert_eq!(resolve_model_route("MODEL_PLACEHOLDER_M319", &custom), "gemini-4-argon-high");

        // 3. Switch to Medium tier
        crate::proxy::config::update_argon_override_config(crate::proxy::config::IdeArgonOverrideConfig {
            enabled: true,
            tier: "medium".to_string(),
        });
        assert_eq!(resolve_model_route("gemini-3.8-flash", &custom), "gemini-4-argon-medium");

        // 4. Switch to Low tier
        crate::proxy::config::update_argon_override_config(crate::proxy::config::IdeArgonOverrideConfig {
            enabled: true,
            tier: "low".to_string(),
        });
        assert_eq!(resolve_model_route("gemini-3.8-flash", &custom), "gemini-4-argon-low");

        // 5. Image models must NOT be hijacked
        assert_eq!(resolve_model_route("gemini-3.1-flash-image", &custom), "gemini-3.1-flash-image");

        // 6. Reset back to disabled
        crate::proxy::config::update_argon_override_config(crate::proxy::config::IdeArgonOverrideConfig {
            enabled: false,
            tier: "high".to_string(),
        });
        assert_eq!(resolve_model_route("gemini-3.8-flash", &custom), "gemini-3-flash");
    }
}
