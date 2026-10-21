/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
export interface UpstreamProxyConfig {
    enabled: boolean;
    url: string;
}

export interface ProxyConfig {
    enabled: boolean;
    allow_lan_access?: boolean;
    auth_mode?: 'off' | 'strict' | 'all_except_health' | 'auto';
    port: number;
    api_key: string;
    admin_password?: string;
    auto_start: boolean;
    custom_mapping?: Record<string, string>;
    request_timeout: number;
    enable_logging: boolean;
    debug_logging?: DebugLoggingConfig;
    upstream_proxy: UpstreamProxyConfig;
    zai?: ZaiConfig;
    scheduling?: StickySessionConfig;
    experimental?: ExperimentalConfig;
    user_agent_override?: string;
    saved_user_agent?: string;
    thinking_budget?: ThinkingBudgetConfig;
    global_system_prompt?: GlobalSystemPromptConfig;
    image_thinking_mode?: 'enabled' | 'disabled'; // [NEW] 图像思维模式开关
    only_raw_quota_models?: boolean; // [NEW] 是否只暴露真实quotamodel
    proxy_pool?: ProxyPoolConfig;
    ide_argon_override?: {
        enabled: boolean;
        tier: 'high' | 'medium' | 'low';
    };
}

// ============================================================================
// Thinking Budget config (controls token budget for deep thinking)
// ============================================================================

/** Thinking Budget processing mode */
export type ThinkingBudgetMode = 'auto' | 'passthrough' | 'custom' | 'adaptive'; // [NEW] 支持自适应模式

/** Thinking Effort tier (adaptive mode only) */
export type ThinkingEffort = 'low' | 'medium' | 'high';

/** Thinking Budget configuration */
export interface ThinkingBudgetConfig {
    /** Mode selection */
    mode: ThinkingBudgetMode;
    /** Custom fixed budget (mode=custom only), range 1024-65536 */
    custom_value: number;
    /** Thinking intensity (mode=adaptive only) */
    effort?: ThinkingEffort;
}

// ============================================================================
// Global system prompt configuration
// ============================================================================

/** Global system prompt configuration */
export interface GlobalSystemPromptConfig {
    /** Whether enabled */
    enabled: boolean;
    /** System prompt content */
    content: string;
}

export interface DebugLoggingConfig {
    enabled: boolean;
    output_dir?: string;
}

export type SchedulingMode = 'CacheFirst' | 'Balance' | 'PerformanceFirst';

export interface StickySessionConfig {
    mode: SchedulingMode;
    max_wait_seconds: number;
}

export type ZaiDispatchMode = 'off' | 'exclusive' | 'pooled' | 'fallback';

export interface ZaiMcpConfig {
    enabled: boolean;
    web_search_enabled: boolean;
    web_reader_enabled: boolean;
    vision_enabled: boolean;
}

export interface ZaiModelDefaults {
    opus: string;
    sonnet: string;
    haiku: string;
}

export interface ZaiConfig {
    enabled: boolean;
    base_url: string;
    api_key: string;
    dispatch_mode: ZaiDispatchMode;
    model_mapping?: Record<string, string>;
    models: ZaiModelDefaults;
    mcp: ZaiMcpConfig;
}

export interface ScheduledWarmupConfig {
    enabled: boolean;
    monitored_models: string[];
}

export interface QuotaProtectionConfig {
    enabled: boolean;
    threshold_percentage: number; // 1-99
    monitored_models: string[];
}

export interface PinnedQuotaModelsConfig {
    models: string[];
}

export interface ExperimentalConfig {
    enable_usage_scaling: boolean;
    compression_level?: string;
    context_compression_threshold_l1?: number;
    context_compression_threshold_l2?: number;
    context_compression_threshold_l3?: number;
}

export interface CircuitBreakerConfig {
    enabled: boolean;
    backoff_steps: number[];
}

export interface AppConfig {
    language: string;
    theme: string;
    auto_refresh: boolean;
    refresh_interval: number;
    auto_sync: boolean;
    sync_interval: number;
    default_export_path?: string;
    antigravity_executable?: string; // [NEW] 手动指定的反重力程序路径
    antigravity_ide_executable?: string; // [NEW] 手动指定的 Antigravity IDE 程序路径
    antigravity_cli_executable?: string; // [NEW] 手动指定的 Antigravity CLI (agy) 路径
    antigravity_args?: string[]; // [NEW] Antigravity 启动参数
    auto_launch?: boolean; // 开机自动启动
    auto_check_update?: boolean; // 自动Check for updates
    update_check_interval?: number; // Update: check间隔（h）
    accounts_page_size?: number; // account列表每页显示数量,default 0 表示自动计算
    hidden_menu_items?: string[]; // 隐藏的菜单项路径列表
    scheduled_warmup: ScheduledWarmupConfig;
    quota_protection: QuotaProtectionConfig; // [NEW] quota保护config
    pinned_quota_models: PinnedQuotaModelsConfig; // [NEW] quota关注列表
    circuit_breaker: CircuitBreakerConfig; // [NEW] 熔断器config
    proxy: ProxyConfig;
    cloudflared: CloudflaredConfig;
    auto_switch_on_quota?: boolean; // quota耗尽时自动轮换account
    auto_switch_threshold_percentage?: number; // 自动轮换阈值百分比 (default 5%)
    overlay_notifications_enabled?: boolean; // enabled悬浮HUD倒计时通知
    overlay_position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'; // 悬浮窗位置
    auto_switch_countdown_secs?: number; // 自动轮换倒计时s数
    navigation_layout?: 'sidebar' | 'topbar'; // 导航布局模式 (Apple macOS Sidebar vs Top Navbar)
    accent_color?: string; // 7 种 UI 奢华主题高亮色 (seafoam, cyan, violet, amber, rose, emerald, sunset)
}

// ============================================================================
// Cloudflared tunnel type definitions
// ============================================================================

export type TunnelMode = 'quick' | 'auth';

export interface CloudflaredConfig {
    enabled: boolean;
    mode: TunnelMode;
    port: number;
    token?: string;
    use_http2: boolean;
}

export interface CloudflaredStatus {
    installed: boolean;
    version?: string;
    running: boolean;
    url?: string;
    error?: string;
}

// ============================================================================
// Proxy pool type definitions
// ============================================================================

export interface ProxyAuth {
    username: string;
    password?: string;
}

export interface ProxyEntry {
    id: string;
    name: string;
    url: string;
    auth?: ProxyAuth;
    enabled: boolean;
    priority: number;
    tags: string[];
    max_accounts?: number;
    health_check_url?: string;
    last_check_time?: number;
    is_healthy: boolean;
    latency?: number; // [NEW] 延迟 (毫s)
}

// export type ProxyPoolMode = 'global' | 'per_account' | 'hybrid'; // [REMOVED]

export type ProxySelectionStrategy = 'round_robin' | 'random' | 'priority' | 'least_connections' | 'weighted_round_robin';

export interface ProxyPoolConfig {
    enabled: boolean;
    // mode: ProxyPoolMode; // [REMOVED]
    proxies: ProxyEntry[];
    health_check_interval: number;
    auto_failover: boolean;
    strategy: ProxySelectionStrategy;
    account_bindings?: Record<string, string>;
}
