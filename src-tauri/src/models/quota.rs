// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use serde::{Deserialize, Serialize};

/// 单个quota桶 (对应 retrieveUserQuotaSummary 里的一个 bucket)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaBucket {
    /// 桶 ID,如 "gemini-weekly" / "gemini-5h" / "3p-weekly" / "3p-5h"
    #[serde(alias = "bucketId")]
    pub bucket_id: String,
    /// 窗口type: "weekly" / "5h"
    pub window: String,
    /// 剩余比例 0.0-1.0
    #[serde(alias = "remainingFraction")]
    pub remaining_fraction: f64,
    /// Reset: 时间 (RFC3339)
    #[serde(alias = "resetTime")]
    pub reset_time: String,
    #[serde(skip_serializing_if = "Option::is_none", alias = "displayName")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// 一个model组 (如 Gemini Models / Claude and GPT models)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaGroup {
    #[serde(alias = "displayName")]
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub buckets: Vec<QuotaBucket>,
}

/// Model quotasinfo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelQuota {
    pub name: String,
    pub percentage: i32, // 剩余百分比 0-100
    #[serde(alias = "resetTime")]
    pub reset_time: String,

    // -- 动态参数解析与持久化 --
    #[serde(skip_serializing_if = "Option::is_none", alias = "displayName")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "supportsImages")]
    pub supports_images: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "supportsThinking")]
    pub supports_thinking: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "thinkingBudget")]
    pub thinking_budget: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommended: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "maxTokens")]
    pub max_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "maxOutputTokens")]
    pub max_output_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "supportedMimeTypes")]
    pub supported_mime_types: Option<std::collections::HashMap<String, bool>>,
}

/// quotadata结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaData {
    pub models: Vec<ModelQuota>,
    #[serde(alias = "lastUpdated")]
    pub last_updated: i64,
    #[serde(default, alias = "isForbidden")]
    pub is_forbidden: bool,
    /// 禁止访问的原因 (403 详细info)
    #[serde(default, alias = "forbiddenReason")]
    pub forbidden_reason: Option<String>,
    /// 订阅等级 (FREE/PRO/ULTRA)
    #[serde(default, alias = "subscriptionTier")]
    pub subscription_tier: Option<String>,
    /// model淘汰重定向规则表 (old_model_id -> new_model_id)
    #[serde(default, alias = "modelForwardingRules")]
    pub model_forwarding_rules: std::collections::HashMap<String, String>,
    /// 按model组的quota摘要 (weekly + 5h 双窗口),来自 retrieveUserQuotaSummary
    #[serde(default, alias = "quotaGroups")]
    pub quota_groups: Option<Vec<QuotaGroup>>,
}

impl QuotaData {
    pub fn new() -> Self {
        Self {
            models: Vec::new(),
            last_updated: chrono::Utc::now().timestamp(),
            is_forbidden: false,
            forbidden_reason: None,
            subscription_tier: None,
            model_forwarding_rules: std::collections::HashMap::new(),
            quota_groups: None,
        }
    }

    pub fn add_model(&mut self, model: ModelQuota) {
        self.models.push(model);
    }

    /// Returns the minimum remaining quota percentage (0-100) across all active models and quota groups.
    pub fn get_min_remaining_percentage(&self) -> i32 {
        let mut min_pct = 100;
        let mut has_entries = false;

        for m in &self.models {
            min_pct = min_pct.min(m.percentage);
            has_entries = true;
        }

        if let Some(ref groups) = self.quota_groups {
            for g in groups {
                for b in &g.buckets {
                    let pct = (b.remaining_fraction * 100.0).round() as i32;
                    min_pct = min_pct.min(pct.clamp(0, 100));
                    has_entries = true;
                }
            }
        }

        if has_entries {
            min_pct
        } else {
            100
        }
    }

    /// Returns true if any weekly quota bucket has hit its limit (e.g. 0% remaining or limit reached message)
    pub fn has_weekly_limit_hit(&self) -> bool {
        if let Some(ref groups) = self.quota_groups {
            for g in groups {
                for b in &g.buckets {
                    let is_weekly = b.window.eq_ignore_ascii_case("weekly")
                        || b.bucket_id.to_lowercase().contains("weekly")
                        || b.bucket_id.to_lowercase().contains("week");
                    if is_weekly {
                        if b.remaining_fraction <= 0.005 {
                            return true;
                        }
                        if let Some(ref desc) = b.description {
                            let lower = desc.to_lowercase();
                            if lower.contains("hit your weekly limit") || lower.contains("weekly limit reached") {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        false
    }

    /// Returns true if core Gemini models or the Gemini weekly bucket are fully exhausted (0%)
    pub fn is_gemini_exhausted(&self) -> bool {
        // Check Gemini group / weekly bucket first
        if let Some(ref groups) = self.quota_groups {
            for g in groups {
                let g_name = g.display_name.to_lowercase();
                if g_name.contains("gemini") {
                    for b in &g.buckets {
                        let is_weekly = b.window.eq_ignore_ascii_case("weekly")
                            || b.bucket_id.to_lowercase().contains("weekly")
                            || b.bucket_id.to_lowercase().contains("week");
                        if is_weekly && b.remaining_fraction <= 0.005 {
                            return true;
                        }
                    }
                }
            }
        }

        // Check if all primary Gemini models are 0%
        let gemini_models: Vec<_> = self.models
            .iter()
            .filter(|m| {
                let n = m.name.to_lowercase();
                n.contains("gemini") || n.contains("flash") || n.contains("pro")
            })
            .collect();

        if !gemini_models.is_empty() && gemini_models.iter().all(|m| m.percentage <= 0) {
            return true;
        }

        false
    }

    /// Minimum remaining percentage for Gemini family specifically
    pub fn get_gemini_min_percentage(&self) -> i32 {
        let mut min_pct = 100;
        let mut has_gemini = false;

        for m in &self.models {
            let n = m.name.to_lowercase();
            if n.contains("gemini") || n.contains("flash") || n.contains("pro") {
                min_pct = min_pct.min(m.percentage);
                has_gemini = true;
            }
        }

        if let Some(ref groups) = self.quota_groups {
            for g in groups {
                if g.display_name.to_lowercase().contains("gemini") {
                    for b in &g.buckets {
                        let pct = (b.remaining_fraction * 100.0).round() as i32;
                        min_pct = min_pct.min(pct.clamp(0, 100));
                        has_gemini = true;
                    }
                }
            }
        }

        if has_gemini {
            min_pct
        } else {
            self.get_min_remaining_percentage()
        }
    }
}

impl Default for QuotaData {
    fn default() -> Self {
        Self::new()
    }
}
