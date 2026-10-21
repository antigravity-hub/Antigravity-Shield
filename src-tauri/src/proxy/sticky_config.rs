// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use serde::{Deserialize, Serialize};

/// 调度模式枚举
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SchedulingMode {
    /// 缓存优先 (Cache-first): 尽可能locked同一account，限流时优先等待，极大提升 Prompt Caching 命中率
    #[serde(alias = "cache_first", alias = "CacheFirst")]
    CacheFirst,
    /// 平衡模式 (Balance): locked同一account，限流时立即切换到备选account，兼顾success率和性能
    #[serde(alias = "balance", alias = "Balance")]
    Balance,
    /// 性能优先 (Performance-first): 纯轮询模式 (Round-robin)，account负载最均衡，但不利用缓存
    #[serde(alias = "performance_first", alias = "PerformanceFirst", alias = "round_robin", alias = "RoundRobin")]
    PerformanceFirst,
}

impl Default for SchedulingMode {
    fn default() -> Self {
        Self::Balance
    }
}

/// 粘性会话config
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct StickySessionConfig {
    /// current调度模式
    pub mode: SchedulingMode,
    /// 缓存优先模式下的最大等待时间 (s)
    pub max_wait_seconds: u64,
}

impl Default for StickySessionConfig {
    fn default() -> Self {
        Self {
            mode: SchedulingMode::Balance,
            max_wait_seconds: 60,
        }
    }
}
