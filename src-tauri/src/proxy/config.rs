// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use serde::{Deserialize, Serialize};
// use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

// ============================================================================
// 辅助Utility functions
// ============================================================================

/// 标准化代理 URL，如果缺失协议则default补全 http://
pub fn normalize_proxy_url(url: &str) -> String {
    let url = url.trim();
    if url.is_empty() {
        return String::new();
    }
    if !url.contains("://") {
        format!("http://{}", url)
    } else {
        url.to_string()
    }
}

// ============================================================================
// 全局 Thinking Budget configuration存储
// 用于在 request transform 函数中访问config（none需修改函数签名）
// ============================================================================
static GLOBAL_THINKING_BUDGET_CONFIG: OnceLock<RwLock<ThinkingBudgetConfig>> = OnceLock::new();

/// Get: current Thinking Budget configuration
pub fn get_thinking_budget_config() -> ThinkingBudgetConfig {
    GLOBAL_THINKING_BUDGET_CONFIG
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|cfg| cfg.clone())
        .unwrap_or_default()
}

/// Update: 全局 Thinking Budget configuration
pub fn update_thinking_budget_config(config: ThinkingBudgetConfig) {
    if let Some(lock) = GLOBAL_THINKING_BUDGET_CONFIG.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = config.clone();
            tracing::info!(
                "[Thinking-Budget] Global config updated: mode={:?}, custom_value={}",
                config.mode,
                config.custom_value
            );
        }
    } else {
        // 首次init
        let _ = GLOBAL_THINKING_BUDGET_CONFIG.set(RwLock::new(config.clone()));
        tracing::info!(
            "[Thinking-Budget] Global config initialized: mode={:?}, custom_value={}",
            config.mode,
            config.custom_value
        );
    }
}

// ============================================================================
// Global system prompt configuration存储
// user可在set中config一段全局hint词，自动注入到所有request的 systemInstruction 中
// ============================================================================
static GLOBAL_SYSTEM_PROMPT_CONFIG: OnceLock<RwLock<GlobalSystemPromptConfig>> = OnceLock::new();

/// Get: currentGlobal system prompt configuration
pub fn get_global_system_prompt() -> GlobalSystemPromptConfig {
    GLOBAL_SYSTEM_PROMPT_CONFIG
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|cfg| cfg.clone())
        .unwrap_or_default()
}

/// Update: Global system prompt configuration
pub fn update_global_system_prompt_config(config: GlobalSystemPromptConfig) {
    if let Some(lock) = GLOBAL_SYSTEM_PROMPT_CONFIG.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = config.clone();
            tracing::info!(
                "[Global-System-Prompt] Config updated: enabled={}, content_len={}",
                config.enabled,
                config.content.len()
            );
        }
    } else {
        // 首次init
        let _ = GLOBAL_SYSTEM_PROMPT_CONFIG.set(RwLock::new(config.clone()));
        tracing::info!(
            "[Global-System-Prompt] Config initialized: enabled={}, content_len={}",
            config.enabled,
            config.content.len()
        );
    }
}

// ============================================================================
// 全局图像思维模式config存储
// ============================================================================
static GLOBAL_IMAGE_THINKING_MODE: OnceLock<RwLock<String>> = OnceLock::new();

pub fn get_image_thinking_mode() -> String {
    GLOBAL_IMAGE_THINKING_MODE
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|s| s.clone())
        .unwrap_or_else(|| "enabled".to_string())
}

pub fn update_image_thinking_mode(mode: Option<String>) {
    let val = mode.unwrap_or_else(|| "enabled".to_string());
    if let Some(lock) = GLOBAL_IMAGE_THINKING_MODE.get() {
        if let Ok(mut cfg) = lock.write() {
            if *cfg != val {
                *cfg = val.clone();
                tracing::info!("[Image-Thinking] Global config updated: {}", val);
            }
        }
    } else {
        let _ = GLOBAL_IMAGE_THINKING_MODE.set(RwLock::new(val.clone()));
    }
}

// ============================================================================
// IDE Gemini 4 Argon Brain Override config存储
// ============================================================================
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IdeArgonOverrideConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_argon_tier")]
    pub tier: String,
}

fn default_argon_tier() -> String {
    "high".to_string()
}

impl Default for IdeArgonOverrideConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            tier: "high".to_string(),
        }
    }
}

static GLOBAL_ARGON_OVERRIDE: OnceLock<RwLock<IdeArgonOverrideConfig>> = OnceLock::new();

pub fn get_argon_override_config() -> IdeArgonOverrideConfig {
    GLOBAL_ARGON_OVERRIDE
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|cfg| cfg.clone())
        .unwrap_or_default()
}

pub fn update_argon_override_config(config: IdeArgonOverrideConfig) {
    if let Some(lock) = GLOBAL_ARGON_OVERRIDE.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = config.clone();
            tracing::info!(
                "[Argon-Override] Global config updated: enabled={}, tier={}",
                config.enabled,
                config.tier
            );
        }
    } else {
        let _ = GLOBAL_ARGON_OVERRIDE.set(RwLock::new(config.clone()));
        tracing::info!(
            "[Argon-Override] Global config initialized: enabled={}, tier={}",
            config.enabled,
            config.tier
        );
    }
}

// ============================================================================
// 全局压缩等级config存储
// ============================================================================
static GLOBAL_COMPRESSION_LEVEL: OnceLock<RwLock<String>> = OnceLock::new();
static GLOBAL_USAGE_SCALING: OnceLock<RwLock<bool>> = OnceLock::new();
static GLOBAL_THRESHOLD_L1: OnceLock<RwLock<f32>> = OnceLock::new();
static GLOBAL_THRESHOLD_L2: OnceLock<RwLock<f32>> = OnceLock::new();
static GLOBAL_THRESHOLD_L3: OnceLock<RwLock<f32>> = OnceLock::new();

pub fn get_global_threshold_l1() -> f32 {
    GLOBAL_THRESHOLD_L1
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|v| *v)
        .unwrap_or(0.6)
}

pub fn get_global_threshold_l2() -> f32 {
    GLOBAL_THRESHOLD_L2
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|v| *v)
        .unwrap_or(0.75)
}

pub fn get_global_threshold_l3() -> f32 {
    GLOBAL_THRESHOLD_L3
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|v| *v)
        .unwrap_or(0.9)
}

pub fn get_global_compression_level() -> String {
    let level = GLOBAL_COMPRESSION_LEVEL
        .get()
        .and_then(|lock| lock.read().ok())
        .map(|cfg| cfg.clone())
        .unwrap_or_else(|| "disabled".to_string());

    if level == "disabled" {
        let scaling = GLOBAL_USAGE_SCALING
            .get()
            .and_then(|lock| lock.read().ok())
            .map(|s| *s)
            .unwrap_or(false);
        if scaling {
            "high".to_string()
        } else {
            "disabled".to_string()
        }
    } else {
        level
    }
}

pub fn update_global_compression_level(level: String, scaling: bool) {
    if let Some(lock) = GLOBAL_COMPRESSION_LEVEL.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = level;
        }
    } else {
        let _ = GLOBAL_COMPRESSION_LEVEL.set(RwLock::new(level));
    }

    if let Some(lock) = GLOBAL_USAGE_SCALING.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = scaling;
        }
    } else {
        let _ = GLOBAL_USAGE_SCALING.set(RwLock::new(scaling));
    }
}

pub fn update_global_thresholds(l1: f32, l2: f32, l3: f32) {
    if let Some(lock) = GLOBAL_THRESHOLD_L1.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = l1;
        }
    } else {
        let _ = GLOBAL_THRESHOLD_L1.set(RwLock::new(l1));
    }

    if let Some(lock) = GLOBAL_THRESHOLD_L2.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = l2;
        }
    } else {
        let _ = GLOBAL_THRESHOLD_L2.set(RwLock::new(l2));
    }

    if let Some(lock) = GLOBAL_THRESHOLD_L3.get() {
        if let Ok(mut cfg) = lock.write() {
            *cfg = l3;
        }
    } else {
        let _ = GLOBAL_THRESHOLD_L3.set(RwLock::new(l3));
    }
}

/// Global system prompt configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSystemPromptConfig {
    /// Whether enabled全局系统hint词
    #[serde(default)]
    pub enabled: bool,
    /// 系统System prompt content
    #[serde(default)]
    pub content: String,
}

impl Default for GlobalSystemPromptConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            content: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProxyAuthMode {
    Off,
    Strict,
    AllExceptHealth,
    Auto,
}

impl Default for ProxyAuthMode {
    fn default() -> Self {
        Self::Auto
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ZaiDispatchMode {
    /// Never use z.ai.
    Off,
    /// Use z.ai for all Anthropic protocol requests.
    Exclusive,
    /// Treat z.ai as one additional slot in the shared pool.
    Pooled,
    /// Use z.ai only when the Google pool is unavailable.
    Fallback,
}

impl Default for ZaiDispatchMode {
    fn default() -> Self {
        Self::Off
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZaiModelDefaults {
    /// Default model for "opus" family (when the incoming model is a Claude id).
    #[serde(default = "default_zai_opus_model")]
    pub opus: String,
    /// Default model for "sonnet" family (when the incoming model is a Claude id).
    #[serde(default = "default_zai_sonnet_model")]
    pub sonnet: String,
    /// Default model for "haiku" family (when the incoming model is a Claude id).
    #[serde(default = "default_zai_haiku_model")]
    pub haiku: String,
}

impl Default for ZaiModelDefaults {
    fn default() -> Self {
        Self {
            opus: default_zai_opus_model(),
            sonnet: default_zai_sonnet_model(),
            haiku: default_zai_haiku_model(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZaiMcpConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub web_search_enabled: bool,
    #[serde(default)]
    pub web_reader_enabled: bool,
    #[serde(default)]
    pub vision_enabled: bool,
}

impl Default for ZaiMcpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            web_search_enabled: false,
            web_reader_enabled: false,
            vision_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZaiConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_zai_base_url")]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub dispatch_mode: ZaiDispatchMode,
    /// Optional per-model mapping overrides for Anthropic/Claude model ids.
    /// Key: incoming `model` string, Value: upstream z.ai model id (e.g. `glm-4.7`).
    #[serde(default)]
    pub model_mapping: HashMap<String, String>,
    #[serde(default)]
    pub models: ZaiModelDefaults,
    #[serde(default)]
    pub mcp: ZaiMcpConfig,
}

impl Default for ZaiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: default_zai_base_url(),
            api_key: String::new(),
            dispatch_mode: ZaiDispatchMode::Off,
            model_mapping: HashMap::new(),
            models: ZaiModelDefaults::default(),
            mcp: ZaiMcpConfig::default(),
        }
    }
}

/// 实验性功能config (Feature Flags)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperimentalConfig {
    /// enabled双层签名缓存 (Signature Cache)
    #[serde(default = "default_true")]
    pub enable_signature_cache: bool,

    /// enabled工具循环自动恢复 (Tool Loop Recovery)
    #[serde(default = "default_true")]
    pub enable_tool_loop_recovery: bool,

    /// enabled跨model兼容性check (Cross-Model Checks)
    #[serde(default = "default_true")]
    pub enable_cross_model_checks: bool,

    /// enabled上下文用量缩放 (Context Usage Scaling)
    /// 激进模式: 缩放用量并激活自动压缩以突破 200k 限制
    /// default关闭以保持透明度,让客户端能触发原生压缩指令
    #[serde(default = "default_false")]
    pub enable_usage_scaling: bool,

    /// 压缩级别 (Compression Level)
    /// disabled, low, medium, high
    #[serde(default = "default_compression_level")]
    pub compression_level: String,

    /// 上下文压缩阈值 L1 (Tool Trimming)
    #[serde(default = "default_threshold_l1")]
    pub context_compression_threshold_l1: f32,

    /// 上下文压缩阈值 L2 (Thinking Compression)
    #[serde(default = "default_threshold_l2")]
    pub context_compression_threshold_l2: f32,

    /// 上下文压缩阈值 L3 (Fork + Summary)
    #[serde(default = "default_threshold_l3")]
    pub context_compression_threshold_l3: f32,
}

impl Default for ExperimentalConfig {
    fn default() -> Self {
        Self {
            enable_signature_cache: true,
            enable_tool_loop_recovery: true,
            enable_cross_model_checks: true,
            enable_usage_scaling: false,
            compression_level: "disabled".to_string(),
            context_compression_threshold_l1: 0.4,
            context_compression_threshold_l2: 0.55,
            context_compression_threshold_l3: 0.7,
        }
    }
}

fn default_threshold_l1() -> f32 {
    0.4
}
fn default_threshold_l2() -> f32 {
    0.55
}
fn default_threshold_l3() -> f32 {
    0.7
}
fn default_compression_level() -> String {
    "disabled".to_string()
}

/// Thinking Budget 模式
/// 控制如何handle调用方传入的 thinking_budget 参数
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ThinkingBudgetMode {
    /// 自动限制：对特定model（Flash/Thinking）应用 24576 上限
    Auto,
    /// 透传：完全使用调用方传入的值，不做任何修改
    Passthrough,
    /// 自定义：使用user设定的固定值覆盖所有request
    Custom,
    /// 自适应：使用 effort 参数控制思考强度 (Claude 4.6+)
    Adaptive,
}

impl Default for ThinkingBudgetMode {
    fn default() -> Self {
        Self::Auto
    }
}

/// Thinking Budget configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingBudgetConfig {
    /// Mode selection
    #[serde(default)]
    pub mode: ThinkingBudgetMode,
    /// 自定义固定值（仅在 mode=Custom 时生效）
    #[serde(default = "default_thinking_budget_custom_value")]
    pub custom_value: u32,
    /// 思考强度 (仅在 mode=Adaptive 时生效) : low, medium, high
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
}

impl Default for ThinkingBudgetConfig {
    fn default() -> Self {
        Self {
            mode: ThinkingBudgetMode::Auto,
            custom_value: default_thinking_budget_custom_value(),
            effort: None,
        }
    }
}

fn default_thinking_budget_custom_value() -> u32 {
    24576
}

fn default_true() -> bool {
    true
}

fn default_false() -> bool {
    false
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugLoggingConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub output_dir: Option<String>,
}

impl Default for DebugLoggingConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            output_dir: None,
        }
    }
}

/// IP 黑名单config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpBlacklistConfig {
    /// Whether enabled黑名单
    #[serde(default)]
    pub enabled: bool,

    /// 自定义封禁消息
    #[serde(default = "default_block_message")]
    pub block_message: String,
}

impl Default for IpBlacklistConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            block_message: default_block_message(),
        }
    }
}

fn default_block_message() -> String {
    "Access denied".to_string()
}

/// IP 白名单config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpWhitelistConfig {
    /// Whether enabled白名单模式 (enabled后只允许白名单IP访问)
    #[serde(default)]
    pub enabled: bool,

    /// 白名单优先模式 (白名单IP跳过黑名单check)
    #[serde(default = "default_true")]
    pub whitelist_priority: bool,
}

impl Default for IpWhitelistConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            whitelist_priority: true,
        }
    }
}

/// 安全监控config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityMonitorConfig {
    /// IP 黑名单config
    #[serde(default)]
    pub blacklist: IpBlacklistConfig,

    /// IP 白名单config
    #[serde(default)]
    pub whitelist: IpWhitelistConfig,
}

impl Default for SecurityMonitorConfig {
    fn default() -> Self {
        Self {
            blacklist: IpBlacklistConfig::default(),
            whitelist: IpWhitelistConfig::default(),
        }
    }
}

/// 图片任务Routing & scheduling configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageSchedulerConfig {
    #[serde(default = "default_image_per_account_concurrency")]
    pub per_account_concurrency: usize,
}

impl Default for ImageSchedulerConfig {
    fn default() -> Self {
        Self {
            per_account_concurrency: default_image_per_account_concurrency(),
        }
    }
}

fn default_image_per_account_concurrency() -> usize {
    4
}

/// 反代serviceconfig
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// Whether enabled反代service
    pub enabled: bool,

    /// 是否允许局域网访问
    /// - false: 仅本机访问 127.0.0.1（default，隐私优先）
    /// - true: 允许局域网访问 0.0.0.0
    #[serde(default)]
    pub allow_lan_access: bool,

    /// Authorization policy for the proxy.
    /// - off: no auth required
    /// - strict: auth required for all routes
    /// - all_except_health: auth required for all routes except `/healthz`
    /// - auto: recommended defaults (currently: allow_lan_access => all_except_health, else off)
    #[serde(default)]
    pub auth_mode: ProxyAuthMode,

    /// 监听端口
    pub port: u16,

    /// API 密钥
    pub api_key: String,

    /// Web UI 管理后台密码 (可选，如Not set则使用 api_key)
    pub admin_password: Option<String>,

    /// 是否自动启动
    pub auto_start: bool,

    /// 自定义精确model映射表 (key: 原始model名, value: 目标model名)
    #[serde(default)]
    pub custom_mapping: std::collections::HashMap<String, String>,

    /// API request超时时间(s)
    #[serde(default = "default_request_timeout")]
    pub request_timeout: u64,

    /// 是否开启request日志记录 (监控)
    #[serde(default)]
    pub enable_logging: bool,

    /// 调试日志config (save完整链路)
    #[serde(default)]
    pub debug_logging: DebugLoggingConfig,

    /// 上游代理config
    #[serde(default)]
    pub upstream_proxy: UpstreamProxyConfig,

    /// 是否只在 /v1/models 中暴露真实quotamodel（隐藏内置虚拟别名）
    #[serde(default)]
    pub only_raw_quota_models: bool,

    /// z.ai provider configuration (Anthropic-compatible).
    #[serde(default)]
    pub zai: ZaiConfig,

    /// 自定义 User-Agent request头 (可选覆盖)
    #[serde(default)]
    pub user_agent_override: Option<String>,

    /// accountRouting & scheduling configuration (粘性会话/限流retry)
    #[serde(default)]
    pub scheduling: crate::proxy::sticky_config::StickySessionConfig,

    /// 实验性功能config
    #[serde(default)]
    pub experimental: ExperimentalConfig,

    /// 安全监控config (IP 黑白名单)
    #[serde(default)]
    pub security_monitor: SecurityMonitorConfig,

    /// 固定account模式的accountID (Fixed Account Mode)
    /// - None: 使用轮询模式
    /// - Some(account_id): 固定使用指定account
    #[serde(default)]
    pub preferred_account_id: Option<String>,

    /// Saved User-Agent string (persisted even when override is disabled)
    #[serde(default)]
    pub saved_user_agent: Option<String>,

    /// Thinking Budget configuration
    /// 控制如何handle AI 深度思考时的 Token 预算
    #[serde(default)]
    pub thinking_budget: ThinkingBudgetConfig,

    /// Global system prompt configuration
    /// 自动注入到所有 API request的 systemInstruction 中
    #[serde(default)]
    pub global_system_prompt: GlobalSystemPromptConfig,

    /// 图像思维模式config
    /// - enabled: 保留思维链 (default)
    /// - disabled: 移除思维链 (画质优先)
    #[serde(default)]
    pub image_thinking_mode: Option<String>,

    /// 图片上游任务的单account并发数（重启后生效）
    #[serde(default)]
    pub image_scheduler: ImageSchedulerConfig,

    /// 代理池config
    #[serde(default)]
    pub proxy_pool: ProxyPoolConfig,

    /// IDE Gemini 4 Argon Brain Override
    #[serde(default)]
    pub ide_argon_override: IdeArgonOverrideConfig,
}

/// 上游代理config
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpstreamProxyConfig {
    /// Whether enabled
    pub enabled: bool,
    /// 代理地址 (http://, https://, socks5://)
    pub url: String,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            allow_lan_access: false, // default仅本机访问，隐私优先
            auth_mode: ProxyAuthMode::default(),
            port: 8045,
            api_key: format!("sk-{}", uuid::Uuid::new_v4().simple()),
            admin_password: None,
            auto_start: false,
            custom_mapping: std::collections::HashMap::new(),
            request_timeout: default_request_timeout(),
            enable_logging: true, // default开启，支持 token 统计功能
            debug_logging: DebugLoggingConfig::default(),
            upstream_proxy: UpstreamProxyConfig::default(),
            only_raw_quota_models: false,
            zai: ZaiConfig::default(),
            scheduling: crate::proxy::sticky_config::StickySessionConfig::default(),
            experimental: ExperimentalConfig::default(),
            security_monitor: SecurityMonitorConfig::default(),
            preferred_account_id: None, // default使用轮询模式
            user_agent_override: None,
            saved_user_agent: None,
            thinking_budget: ThinkingBudgetConfig::default(),
            global_system_prompt: GlobalSystemPromptConfig::default(),
            proxy_pool: ProxyPoolConfig::default(),
            image_thinking_mode: None,
            image_scheduler: ImageSchedulerConfig::default(),
            ide_argon_override: IdeArgonOverrideConfig::default(),
        }
    }
}

fn default_request_timeout() -> u64 {
    120 // default 120 s,原来 60 s太短
}

fn default_zai_base_url() -> String {
    "https://api.z.ai/api/anthropic".to_string()
}

fn default_zai_opus_model() -> String {
    "glm-4.7".to_string()
}

fn default_zai_sonnet_model() -> String {
    "glm-4.7".to_string()
}

fn default_zai_haiku_model() -> String {
    "glm-4.5-air".to_string()
}

impl ProxyConfig {
    /// Get: 实际的监听地址
    /// - allow_lan_access = false: return "127.0.0.1"（default，隐私优先）
    /// - allow_lan_access = true: return "0.0.0.0"（允许局域网访问）
    pub fn get_bind_address(&self) -> &str {
        if self.allow_lan_access {
            "0.0.0.0"
        } else {
            "127.0.0.1"
        }
    }
}

/// 代理认证info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyAuth {
    pub username: String,
    #[serde(
        serialize_with = "crate::utils::crypto::serialize_password",
        deserialize_with = "crate::utils::crypto::deserialize_password"
    )]
    pub password: String,
}

/// 单个代理config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyEntry {
    pub id: String,                       // 唯一标识
    pub name: String,                     // 显示名称
    pub url: String,                      // 代理地址 (http://, https://, socks5://)
    pub auth: Option<ProxyAuth>,          // 认证info (可选)
    pub enabled: bool,                    // Whether enabled
    pub priority: i32,                    // 优先级 (数字越小优先级越高)
    pub tags: Vec<String>,                // 标签 (如 "美国", "住宅IP")
    pub max_accounts: Option<usize>,      // 最大绑定account数 (0 = none限制)
    pub health_check_url: Option<String>, // 健康check URL
    pub last_check_time: Option<i64>,     // 上次check时间
    pub is_healthy: bool,                 // 健康status
    pub latency: Option<u64>,             // 延迟 (毫s) [NEW]
}

/// 代理池config
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProxyPoolConfig {
    pub enabled: bool, // Whether enabled代理池
    // pub mode: ProxyPoolMode,        // [REMOVED] 代理池模式，统一为 Hybrid 逻辑
    pub proxies: Vec<ProxyEntry>,         // 代理列表
    pub health_check_interval: u64,       // 健康check间隔 (s)
    pub auto_failover: bool,              // 自动故障转移
    pub strategy: ProxySelectionStrategy, // 代理选择策略
    /// account到代理的绑定关系 (account_id -> proxy_id)，持久化存储
    #[serde(default)]
    pub account_bindings: HashMap<String, String>,
}

impl Default for ProxyPoolConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            // mode: ProxyPoolMode::Global,
            proxies: Vec::new(),
            health_check_interval: 300,
            auto_failover: true,
            strategy: ProxySelectionStrategy::Priority,
            account_bindings: HashMap::new(),
        }
    }
}

/// 代理选择策略
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProxySelectionStrategy {
    /// 轮询: 依次使用
    RoundRobin,
    /// 随机: 随机选择
    Random,
    /// 优先级: 按 priority 字段排序
    Priority,
    /// 最少连接: 选择current使用最少的代理
    LeastConnections,
    /// 加权轮询: 根据健康status和优先级
    WeightedRoundRobin,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_proxy_url() {
        // 测试已有协议
        assert_eq!(
            normalize_proxy_url("http://127.0.0.1:7890"),
            "http://127.0.0.1:7890"
        );
        assert_eq!(
            normalize_proxy_url("https://proxy.com"),
            "https://proxy.com"
        );
        assert_eq!(
            normalize_proxy_url("socks5://127.0.0.1:1080"),
            "socks5://127.0.0.1:1080"
        );
        assert_eq!(
            normalize_proxy_url("socks5h://127.0.0.1:1080"),
            "socks5h://127.0.0.1:1080"
        );

        // 测试缺少协议（default补全 http://）
        assert_eq!(
            normalize_proxy_url("127.0.0.1:7890"),
            "http://127.0.0.1:7890"
        );
        assert_eq!(
            normalize_proxy_url("localhost:1082"),
            "http://localhost:1082"
        );

        // 测试边缘情况
        assert_eq!(normalize_proxy_url(""), "");
        assert_eq!(normalize_proxy_url("   "), "");
    }
}
