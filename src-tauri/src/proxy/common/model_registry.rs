// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

// Dynamic Model Registry & Semantic Family Resolver
// Zero-Disk I/O, In-Memory TTL Caching, Autonomous Google API Discovery

use dashmap::DashMap;
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub const DEFAULT_CACHE_TTL_SECS: u64 = 45 * 60; // 45 minutes
pub const STALE_REFRESH_THRESHOLD_SECS: u64 = 40 * 60; // 40 minutes

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModelFamily {
    GeminiFlash,
    GeminiPro,
    GeminiThinking,
    GeminiImagePro,
    GeminiImageFlash,
    ClaudeSonnet,
    ClaudeOpus,
    Unknown,
}

impl ModelFamily {
    pub fn classify(name: &str) -> (Self, u32) {
        let lower = name.trim().to_lowercase();

        // 0. Argon Reasoning Family (Pass-through directly, do NOT hijack into Flash)
        if lower.contains("argon") {
            return (ModelFamily::Unknown, 0);
        }

        // 1. Image models
        if lower.contains("image") || lower.contains("imagen") {
            if lower.contains("flash") {
                let rank = if lower.contains("3.1") { 310 } else if lower.contains("3") { 300 } else { 200 };
                return (ModelFamily::GeminiImageFlash, rank);
            }
            let rank = if lower.contains("3.1") { 310 } else if lower.contains("3") { 300 } else { 200 };
            return (ModelFamily::GeminiImagePro, rank);
        }

        // 2. Claude models
        if lower.contains("opus") {
            let rank = if lower.contains("4.6") || lower.contains("4-6") { 460 } else { 450 };
            return (ModelFamily::ClaudeOpus, rank);
        }
        if lower.contains("sonnet") || lower.contains("haiku") {
            let rank = if lower.contains("4.6") || lower.contains("4-6") { 460 } else { 450 };
            return (ModelFamily::ClaudeSonnet, rank);
        }

        // 3. Gemini Thinking & Reasoning
        if lower.contains("thinking") {
            let rank = if lower.contains("3") { 300 } else if lower.contains("2.5") { 250 } else { 200 };
            return (ModelFamily::GeminiThinking, rank);
        }

        // 4. Gemini Pro Family (including OpenAI heavy aliases: gpt-4, gpt-4o, o1, o3)
        if lower.contains("pro")
            || lower.starts_with("gpt-4")
            || lower.starts_with("o1")
            || lower.starts_with("o3")
        {
            let rank = if lower.contains("3.1") { 310 } else if lower.contains("3") { 300 } else { 250 };
            return (ModelFamily::GeminiPro, rank);
        }

        // 5. Gemini Flash Family (including OpenAI light aliases: gpt-4o-mini, gpt-3.5)
        if lower.contains("flash")
            || lower.contains("gpt-4o-mini")
            || lower.contains("-mini")
            || lower.ends_with("-mini")
            || lower.starts_with("gpt-3.5")
            || lower.starts_with("gemini-flash")
        {
            let rank = if lower.contains("3.8") {
                380
            } else if lower.contains("3.7") {
                370
            } else if lower.contains("3.6") {
                360
            } else if lower.contains("3.5") {
                350
            } else if lower.contains("3") {
                300
            } else {
                250
            };
            return (ModelFamily::GeminiFlash, rank);
        }

        (ModelFamily::Unknown, 0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredModel {
    pub id: String,
    pub display_name: Option<String>,
    pub supports_images: bool,
    pub supports_thinking: bool,
    pub thinking_budget: Option<i32>,
    pub recommended: bool,
    pub max_tokens: Option<i32>,
    pub max_output_tokens: Option<i32>,
    pub remaining_percentage: i32,
    pub reset_time: String,
    pub family: ModelFamily,
    pub version_rank: u32,
}

#[derive(Debug, Clone, Default)]
pub struct FamilyPointers {
    pub latest_flash: Option<String>,
    pub latest_pro: Option<String>,
    pub latest_thinking: Option<String>,
    pub latest_image_pro: Option<String>,
    pub latest_image_flash: Option<String>,
    pub latest_sonnet: Option<String>,
    pub latest_opus: Option<String>,
}

pub struct AccountModelCache {
    pub account_id: String,
    pub models: HashMap<String, DiscoveredModel>,
    pub last_refreshed: Instant,
    pub is_refreshing: Arc<AtomicBool>,
}

pub struct DynamicModelRegistry {
    accounts: DashMap<String, AccountModelCache>,
    pool_models: DashMap<String, DiscoveredModel>,
    deprecated_forwarding: DashMap<String, String>,
    family_pointers: RwLock<FamilyPointers>,
}

pub static GLOBAL_MODEL_REGISTRY: Lazy<DynamicModelRegistry> = Lazy::new(DynamicModelRegistry::new);

impl DynamicModelRegistry {
    pub fn new() -> Self {
        let mut initial_forwarding = DashMap::new();
        // Seed standard official Google migration rules as baseline
        initial_forwarding.insert("gemini-2.0-flash".to_string(), "gemini-3-flash".to_string());
        initial_forwarding.insert("gemini-3-pro-high".to_string(), "gemini-pro-agent".to_string());
        initial_forwarding.insert("claude-sonnet-4-5".to_string(), "claude-sonnet-4-6".to_string());
        initial_forwarding.insert("claude-opus-4-5-thinking".to_string(), "claude-opus-4-6-thinking".to_string());

        Self {
            accounts: DashMap::new(),
            pool_models: DashMap::new(),
            deprecated_forwarding: initial_forwarding,
            family_pointers: RwLock::new(FamilyPointers {
                latest_flash: Some("gemini-3-flash".to_string()),
                latest_pro: Some("gemini-3.1-pro-preview".to_string()),
                latest_thinking: Some("gemini-2.5-flash-thinking".to_string()),
                latest_image_pro: Some("gemini-3-pro-image".to_string()),
                latest_image_flash: Some("gemini-3.1-flash-image".to_string()),
                latest_sonnet: Some("claude-sonnet-4-6".to_string()),
                latest_opus: Some("claude-opus-4-6-thinking".to_string()),
            }),
        }
    }

    pub fn global() -> &'static Self {
        &GLOBAL_MODEL_REGISTRY
    }

    /// Register or refresh models discovered from an account's quota endpoint
    pub fn register_account_models(
        &self,
        account_id: &str,
        models: Vec<DiscoveredModel>,
        deprecated_rules: HashMap<String, String>,
    ) {
        let mut account_map = HashMap::with_capacity(models.len());

        for model in models {
            self.pool_models.insert(model.id.clone(), model.clone());
            account_map.insert(model.id.clone(), model);
        }

        for (old_id, new_id) in deprecated_rules {
            self.deprecated_forwarding.insert(old_id, new_id);
        }

        self.accounts.insert(
            account_id.to_string(),
            AccountModelCache {
                account_id: account_id.to_string(),
                models: account_map,
                last_refreshed: Instant::now(),
                is_refreshing: Arc::new(AtomicBool::new(false)),
            },
        );

        self.recalculate_family_pointers();
    }

    /// Recalculate highest versioned model pointers per family
    fn recalculate_family_pointers(&self) {
        let mut best_flash: Option<(String, u32)> = None;
        let mut best_pro: Option<(String, u32)> = None;
        let mut best_thinking: Option<(String, u32)> = None;
        let mut best_img_pro: Option<(String, u32)> = None;
        let mut best_img_flash: Option<(String, u32)> = None;
        let mut best_sonnet: Option<(String, u32)> = None;
        let mut best_opus: Option<(String, u32)> = None;

        for entry in self.pool_models.iter() {
            let m = entry.value();
            match m.family {
                ModelFamily::GeminiFlash => {
                    if best_flash.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                        best_flash = Some((m.id.clone(), m.version_rank));
                    }
                }
                ModelFamily::GeminiPro => {
                    if best_pro.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                        best_pro = Some((m.id.clone(), m.version_rank));
                    }
                }
                ModelFamily::GeminiThinking => {
                    if best_thinking.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                        best_thinking = Some((m.id.clone(), m.version_rank));
                    }
                }
                ModelFamily::GeminiImagePro => {
                    if best_img_pro.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                        best_img_pro = Some((m.id.clone(), m.version_rank));
                    }
                }
                ModelFamily::GeminiImageFlash => {
                    if best_img_flash.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                        best_img_flash = Some((m.id.clone(), m.version_rank));
                    }
                }
                ModelFamily::ClaudeSonnet => {
                    if best_sonnet.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                        best_sonnet = Some((m.id.clone(), m.version_rank));
                    }
                }
                ModelFamily::ClaudeOpus => {
                    if best_opus.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                        best_opus = Some((m.id.clone(), m.version_rank));
                    }
                }
                ModelFamily::Unknown => {}
            }
        }

        let mut pointers = self.family_pointers.write();
        if let Some((id, _)) = best_flash {
            pointers.latest_flash = Some(id);
        }
        if let Some((id, _)) = best_pro {
            pointers.latest_pro = Some(id);
        }
        if let Some((id, _)) = best_thinking {
            pointers.latest_thinking = Some(id);
        }
        if let Some((id, _)) = best_img_pro {
            pointers.latest_image_pro = Some(id);
        }
        if let Some((id, _)) = best_img_flash {
            pointers.latest_image_flash = Some(id);
        }
        if let Some((id, _)) = best_sonnet {
            pointers.latest_sonnet = Some(id);
        }
        if let Some((id, _)) = best_opus {
            pointers.latest_opus = Some(id);
        }
    }

    /// Resolve a model request using the 5-tier priority cascade
    pub fn resolve_model(&self, requested: &str, custom_mapping: Option<&HashMap<String, String>>) -> String {
        let trimmed = requested.trim();
        if trimmed.is_empty() {
            return "gemini-3-flash".to_string();
        }

        // Tier 1: Live Google Migration Rules (deprecatedModelIds)
        if let Some(forwarded) = self.deprecated_forwarding.get(trimmed) {
            return forwarded.clone();
        }

        // Tier 2: User Custom Mapping
        if let Some(map) = custom_mapping {
            if let Some(custom) = map.get(trimmed) {
                return custom.clone();
            }
        }

        // Tier 3: Exact match in live pool models
        if self.pool_models.contains_key(trimmed) {
            return trimmed.to_string();
        }

        // Tier 4: Semantic Family Fallback
        let (family, _) = ModelFamily::classify(trimmed);
        let pointers = self.family_pointers.read();

        let target = match family {
            ModelFamily::GeminiFlash => pointers.latest_flash.as_deref(),
            ModelFamily::GeminiPro => pointers.latest_pro.as_deref(),
            ModelFamily::GeminiThinking => pointers.latest_thinking.as_deref(),
            ModelFamily::GeminiImagePro => pointers.latest_image_pro.as_deref(),
            ModelFamily::GeminiImageFlash => pointers.latest_image_flash.as_deref(),
            ModelFamily::ClaudeSonnet => pointers.latest_sonnet.as_deref(),
            ModelFamily::ClaudeOpus => pointers.latest_opus.as_deref(),
            ModelFamily::Unknown => None,
        };

        if let Some(canonical) = target {
            return canonical.to_string();
        }

        // Tier 5: Transparent pass-through for unknown, custom, or future models
        trimmed.to_string()
    }

    /// Resolve a model request for a specific account with zero disk I/O
    pub fn resolve_model_for_account(&self, requested: &str, account_id: &str) -> String {
        let trimmed = requested.trim();
        if trimmed.is_empty() {
            return "gemini-3-flash".to_string();
        }

        // Tier 1: Live Google Migration Rules (deprecatedModelIds)
        if let Some(forwarded) = self.deprecated_forwarding.get(trimmed) {
            return forwarded.clone();
        }

        // Tier 2: Exact match in account models
        if let Some(acc) = self.accounts.get(account_id) {
            if acc.models.contains_key(trimmed) {
                return trimmed.to_string();
            }
        }

        // Tier 3: Exact match in pool models
        if self.pool_models.contains_key(trimmed) {
            return trimmed.to_string();
        }

        // Tier 4: Semantic Family Fallback (prefer account's highest-ranking model in the same family)
        let (family, _) = ModelFamily::classify(trimmed);
        if family != ModelFamily::Unknown {
            if let Some(acc) = self.accounts.get(account_id) {
                let mut best_in_acc: Option<(String, u32)> = None;
                for m in acc.models.values() {
                    if m.family == family {
                        if best_in_acc.as_ref().map_or(true, |(_, r)| m.version_rank >= *r) {
                            best_in_acc = Some((m.id.clone(), m.version_rank));
                        }
                    }
                }
                if let Some((best_id, _)) = best_in_acc {
                    return best_id;
                }
            }
        }

        // Fallback to pool family pointer
        let pointers = self.family_pointers.read();
        let target = match family {
            ModelFamily::GeminiFlash => pointers.latest_flash.as_deref(),
            ModelFamily::GeminiPro => pointers.latest_pro.as_deref(),
            ModelFamily::GeminiThinking => pointers.latest_thinking.as_deref(),
            ModelFamily::GeminiImagePro => pointers.latest_image_pro.as_deref(),
            ModelFamily::GeminiImageFlash => pointers.latest_image_flash.as_deref(),
            ModelFamily::ClaudeSonnet => pointers.latest_sonnet.as_deref(),
            ModelFamily::ClaudeOpus => pointers.latest_opus.as_deref(),
            ModelFamily::Unknown => None,
        };

        if let Some(canonical) = target {
            return canonical.to_string();
        }

        trimmed.to_string()
    }

    /// Get list of models for /v1/models (Zero disk I/O)
    pub fn get_available_models(
        &self,
        target_account_id: Option<&str>,
        only_raw_quota: bool,
    ) -> Vec<String> {
        use std::collections::BTreeSet;
        let mut result = BTreeSet::new();

        if let Some(acc_id) = target_account_id {
            if let Some(entry) = self.accounts.get(acc_id) {
                for id in entry.models.keys() {
                    result.insert(id.clone());
                }
            }
        } else {
            for entry in self.pool_models.iter() {
                result.insert(entry.key().clone());
            }
        }

        // If pool is empty (e.g. cold boot before first quota fetch), provide baseline modern models
        if result.is_empty() {
            result.insert("gemini-3-flash".to_string());
            result.insert("gemini-3.1-pro-preview".to_string());
            result.insert("gemini-pro-agent".to_string());
            result.insert("claude-sonnet-4-6".to_string());
            result.insert("claude-opus-4-6-thinking".to_string());
        }

        // When not only_raw_quota, append primary canonical aliases and image combinations
        if !only_raw_quota {
            let pointers = self.family_pointers.read();
            if let Some(ref m) = pointers.latest_flash {
                result.insert(m.clone());
            }
            if let Some(ref m) = pointers.latest_pro {
                result.insert(m.clone());
            }
            if let Some(ref m) = pointers.latest_sonnet {
                result.insert(m.clone());
            }
            if let Some(ref m) = pointers.latest_opus {
                result.insert(m.clone());
            }

            // Image generation resolution & ratio matrix
            let base = "gemini-3-pro-image";
            let resolutions = ["", "-2k", "-4k"];
            let ratios = ["", "-1x1", "-4x3", "-3x4", "-16x9", "-9x16", "-21x9"];
            for res in resolutions {
                for ratio in ratios {
                    result.insert(format!("{}{}{}", base, res, ratio));
                }
            }
        }

        result.into_iter().collect()
    }

    /// Check if account model cache is fresh
    pub fn is_fresh(&self, account_id: &str, ttl: Duration) -> bool {
        if let Some(entry) = self.accounts.get(account_id) {
            entry.last_refreshed.elapsed() < ttl
        } else {
            false
        }
    }

    /// Check if account needs soft background refresh
    pub fn needs_soft_refresh(&self, account_id: &str) -> bool {
        if let Some(entry) = self.accounts.get(account_id) {
            let age = entry.last_refreshed.elapsed();
            age >= Duration::from_secs(STALE_REFRESH_THRESHOLD_SECS)
                && age < Duration::from_secs(DEFAULT_CACHE_TTL_SECS)
                && !entry.is_refreshing.load(Ordering::Relaxed)
        } else {
            true
        }
    }

    /// Mark account as currently refreshing to avoid redundant tasks
    pub fn mark_refreshing(&self, account_id: &str) -> bool {
        if let Some(entry) = self.accounts.get(account_id) {
            entry
                .is_refreshing
                .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                .is_ok()
        } else {
            false
        }
    }
}
