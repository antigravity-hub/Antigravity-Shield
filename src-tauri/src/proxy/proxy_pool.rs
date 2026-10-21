// Antigravity Shield — AI Proxy & Fleet Management Engine
// Repository: https://github.com/antigravity-hub/Antigravity-Shield

use crate::proxy::config::{ProxyEntry, ProxyPoolConfig, ProxySelectionStrategy};
use dashmap::DashMap;
use futures::{stream, StreamExt};
use rquest::Client;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

use rquest_util::Emulation;
use std::sync::OnceLock;

/// 全局代理池管理器单例
pub static GLOBAL_PROXY_POOL: OnceLock<Arc<ProxyPoolManager>> = OnceLock::new();

/// Get: 全局代理池管理器
pub fn get_global_proxy_pool() -> Option<Arc<ProxyPoolManager>> {
    GLOBAL_PROXY_POOL.get().cloned()
}

/// Initialize: 全局代理池管理器
pub fn init_global_proxy_pool(config: Arc<RwLock<ProxyPoolConfig>>) -> Arc<ProxyPoolManager> {
    let manager = Arc::new(ProxyPoolManager::new(config));
    let _ = GLOBAL_PROXY_POOL.set(manager.clone());
    manager
}

/// 全局报告代理failed快捷函数
pub async fn report_global_proxy_failure(proxy_id: &str, reason: &str) {
    if let Some(manager) = get_global_proxy_pool() {
        manager.report_transport_failure(proxy_id, reason).await;
    }
}

/// 全局报告代理success快捷函数
pub async fn report_global_proxy_success(proxy_id: &str) {
    if let Some(manager) = get_global_proxy_pool() {
        manager.report_transport_success(proxy_id).await;
    }
}

/// 代理config (用于构建 reqwest Client)
/// Note：重命名为 PoolProxyConfig 以避免与 config::ProxyConfig 冲突
#[derive(Debug, Clone)]
pub struct PoolProxyConfig {
    pub proxy: rquest::Proxy,
    pub entry_id: String,
}

/// 代理池管理器
pub struct ProxyPoolManager {
    config: Arc<RwLock<ProxyPoolConfig>>,

    /// 代理使用计数 (proxy_id -> count)
    usage_counter: Arc<DashMap<String, usize>>,

    /// account到代理的绑定 (account_id -> proxy_id)
    account_bindings: Arc<DashMap<String, String>>,

    /// 轮询索引 (用于 RoundRobin 策略)
    round_robin_index: Arc<AtomicUsize>,
}

impl ProxyPoolManager {
    pub fn new(config: Arc<RwLock<ProxyPoolConfig>>) -> Self {
        // 从config中加载已save的绑定关系
        let account_bindings = Arc::new(DashMap::new());

        // 使用 blocking 方式读取config（因为 new 不是 async）
        // Note：这里使用 try_read 避免死锁
        if let Ok(cfg) = config.try_read() {
            for (account_id, proxy_id) in &cfg.account_bindings {
                account_bindings.insert(account_id.clone(), proxy_id.clone());
            }
            if !cfg.account_bindings.is_empty() {
                tracing::info!(
                    "[ProxyPool] Loaded {} account bindings from config",
                    cfg.account_bindings.len()
                );
            }
        }

        Self {
            config,
            usage_counter: Arc::new(DashMap::new()),
            account_bindings,
            round_robin_index: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// [NEW] 为指定accountget“最终生效”的 HttpClient
    /// 逻辑：
    /// 1. account显式绑定代理优先 (Account-Proxy Binding)
    /// 2. 如果none绑定，且开启了“自动全局”，取池中第一个节点
    /// 3. 如果以上均none，则check全局上游代理 (Upstream Proxy) [由调用方 fallback]
    pub async fn get_effective_client(
        &self,
        account_id: Option<&str>,
        timeout_secs: u64,
    ) -> Client {
        let mut builder = Client::builder()
            .emulation(Emulation::Chrome123)
            .timeout(Duration::from_secs(timeout_secs));

        // 尝试get代理config
        let proxy_opt = if let Some(acc_id) = account_id {
            self.get_proxy_for_account(acc_id).await.ok().flatten()
        } else {
            // 没有 account_id 的通用request，如果代理池enabled，则default从中选择节点作为出口
            let config = self.config.read().await;
            if config.enabled {
                let res = self.select_proxy_from_pool(&config).await.ok().flatten();
                if let Some(ref p) = res {
                    tracing::info!(
                        "[Proxy] Route: Generic Request -> Proxy {} (Pool)",
                        p.entry_id
                    );
                } else {
                    // [FIX #1583] 明确记录池中none可用代理的情况
                    tracing::warn!("[Proxy] Route: Generic Request -> No available proxy in pool, falling back to upstream or direct");
                }
                res
            } else {
                tracing::debug!("[Proxy] Route: Generic Request -> Proxy pool disabled");
                None
            }
        };

        if let Some(proxy_cfg) = proxy_opt {
            builder = builder.proxy(proxy_cfg.proxy);
            // Already logged more detail in get_proxy_for_account or pool selection
        } else {
            // Fallback 到应用config的单上游代理
            if let Ok(app_cfg) = crate::modules::config::load_app_config() {
                let up = app_cfg.proxy.upstream_proxy;
                if up.enabled && !up.url.is_empty() {
                    if let Ok(p) = rquest::Proxy::all(&up.url) {
                        tracing::info!(
                            "[Proxy] Route: {:?} -> Upstream: {} (AppConfig)",
                            account_id.unwrap_or("Generic"),
                            up.url
                        );
                        builder = builder.proxy(p);
                    }
                } else {
                    tracing::info!(
                        "[Proxy] Route: {:?} -> Direct",
                        account_id.unwrap_or("Generic")
                    );
                }
            }
        }

        builder.build().unwrap_or_else(|_| Client::new())
    }

    /// [NEW] 为指定accountget“最终生效”的none特征 Standard HttpClient (专门用于纯净场景，如 OAuth 退还)
    pub async fn get_effective_standard_client(
        &self,
        account_id: Option<&str>,
        timeout_secs: u64,
    ) -> Client {
        let mut builder = Client::builder()
            // none Emulation set，走纯正的基础 TLS 指纹
            .timeout(Duration::from_secs(timeout_secs));

        // 尝试get代理config
        let proxy_opt = if let Some(acc_id) = account_id {
            self.get_proxy_for_account(acc_id).await.ok().flatten()
        } else {
            // 没有 account_id 的通用request，如果代理池enabled，则default从中选择节点作为出口
            let config = self.config.read().await;
            if config.enabled {
                let res = self.select_proxy_from_pool(&config).await.ok().flatten();
                if let Some(ref p) = res {
                    tracing::info!(
                        "[Proxy] Route: Generic Request (Standard Client) -> Proxy {} (Pool)",
                        p.entry_id
                    );
                } else {
                    tracing::warn!("[Proxy] Route: Generic Request (Standard Client) -> No available proxy in pool, falling back to upstream or direct");
                }
                res
            } else {
                tracing::debug!(
                    "[Proxy] Route: Generic Request (Standard Client) -> Proxy pool disabled"
                );
                None
            }
        };

        if let Some(proxy_cfg) = proxy_opt {
            builder = builder.proxy(proxy_cfg.proxy);
        } else {
            // Fallback 到应用config的单上游代理
            if let Ok(app_cfg) = crate::modules::config::load_app_config() {
                let up = app_cfg.proxy.upstream_proxy;
                if up.enabled && !up.url.is_empty() {
                    if let Ok(p) = rquest::Proxy::all(&up.url) {
                        tracing::info!(
                            "[Proxy] Route: {:?} (Standard Client) -> Upstream: {} (AppConfig)",
                            account_id.unwrap_or("Generic"),
                            up.url
                        );
                        builder = builder.proxy(p);
                    }
                } else {
                    tracing::info!(
                        "[Proxy] Route: {:?} (Standard Client) -> Direct",
                        account_id.unwrap_or("Generic")
                    );
                }
            }
        }

        builder.build().unwrap_or_else(|_| Client::new())
    }

    /// 为accountget代理
    pub async fn get_proxy_for_account(
        &self,
        account_id: &str,
    ) -> Result<Option<PoolProxyConfig>, String> {
        let config = self.config.read().await;

        if !config.enabled || config.proxies.is_empty() {
            return Ok(None);
        }

        // 1. 优先使用account绑定 (专属 IP)
        if let Some(proxy) = self.get_bound_proxy(account_id, &config).await? {
            tracing::info!(
                "[Proxy] Route: Account {} -> Proxy {} (Bound)",
                account_id,
                proxy.entry_id
            );
            return Ok(Some(proxy));
        }

        // 2. otherwise从池中策略选择 (公用池)
        let res = self.select_proxy_from_pool(&config).await?;
        if let Some(ref p) = res {
            tracing::info!(
                "[Proxy] Route: Account {} -> Proxy {} (Pool)",
                account_id,
                p.entry_id
            );
        }
        Ok(res)
    }

    /// Get: account绑定的代理
    async fn get_bound_proxy(
        &self,
        account_id: &str,
        config: &ProxyPoolConfig,
    ) -> Result<Option<PoolProxyConfig>, String> {
        if let Some(proxy_id) = self.account_bindings.get(account_id) {
            if let Some(entry) = config.proxies.iter().find(|p| p.id == *proxy_id.value()) {
                if entry.enabled {
                    // If 开启了自动故障转移且代理不健康，则return None (将回退到其他策略或failed)
                    if config.auto_failover && !entry.is_healthy {
                        return Ok(None);
                    }
                    return Ok(Some(self.build_proxy_config(entry)?));
                }
            }
        }
        Ok(None)
    }

    /// 从代理池中选择代理
    async fn select_proxy_from_pool(
        &self,
        config: &ProxyPoolConfig,
    ) -> Result<Option<PoolProxyConfig>, String> {
        // [FIX] 专属隔离逻辑：剔除所有已被绑定的代理，保护专属 IP account的安全
        let bound_ids: std::collections::HashSet<String> = self
            .account_bindings
            .iter()
            .map(|kv| kv.value().clone())
            .collect();

        let healthy_proxies: Vec<_> = config
            .proxies
            .iter()
            .filter(|p| {
                if !p.enabled {
                    return false;
                }
                if config.auto_failover && !p.is_healthy {
                    return false;
                }
                // If 该代理已被某个account“专属绑定”，则不再参与公用轮询
                if bound_ids.contains(&p.id) {
                    return false;
                }
                true
            })
            .collect();

        if healthy_proxies.is_empty() {
            // If 所有代理都被绑定了，或者池本身为empty，尝试return池中开启了且不依赖绑定的代理
            // (这里可以根据业务进一步调整，目前保持严谨隔离)
            return Ok(None);
        }

        let selected = match config.strategy {
            ProxySelectionStrategy::RoundRobin => self.select_round_robin(&healthy_proxies),
            ProxySelectionStrategy::Random => self.select_random(&healthy_proxies),
            ProxySelectionStrategy::Priority => self.select_by_priority(&healthy_proxies),
            ProxySelectionStrategy::LeastConnections => {
                self.select_least_connections(&healthy_proxies)
            }
            ProxySelectionStrategy::WeightedRoundRobin => self.select_weighted(&healthy_proxies),
        };

        if let Some(entry) = selected {
            // Update: 计数
            *self.usage_counter.entry(entry.id.clone()).or_insert(0) += 1;
            Ok(Some(self.build_proxy_config(entry)?))
        } else {
            Ok(None)
        }
    }

    fn select_round_robin<'a>(&self, proxies: &[&'a ProxyEntry]) -> Option<&'a ProxyEntry> {
        if proxies.is_empty() {
            return None;
        }
        let index = self.round_robin_index.fetch_add(1, Ordering::Relaxed);
        Some(proxies[index % proxies.len()])
    }

    fn select_random<'a>(&self, proxies: &[&'a ProxyEntry]) -> Option<&'a ProxyEntry> {
        if proxies.is_empty() {
            return None;
        }
        use rand::seq::SliceRandom;
        let mut rng = rand::thread_rng();
        proxies.choose(&mut rng).copied()
    }

    fn select_by_priority<'a>(&self, proxies: &[&'a ProxyEntry]) -> Option<&'a ProxyEntry> {
        // priority 越小越优先
        proxies.iter().min_by_key(|p| p.priority).copied()
    }

    fn select_least_connections<'a>(&self, proxies: &[&'a ProxyEntry]) -> Option<&'a ProxyEntry> {
        proxies
            .iter()
            .min_by_key(|p| self.usage_counter.get(&p.id).map(|v| *v).unwrap_or(0))
            .copied()
    }

    fn select_weighted<'a>(&self, proxies: &[&'a ProxyEntry]) -> Option<&'a ProxyEntry> {
        // 简单实现: 类似优先级的加权, 这里暂用 Priority 代替
        self.select_by_priority(proxies)
    }

    /// 构建 rquest::Proxy config
    fn build_proxy_config(&self, entry: &ProxyEntry) -> Result<PoolProxyConfig, String> {
        let raw_url = crate::proxy::config::normalize_proxy_url(&entry.url);

        // 尝试解析 URL，提取可能内嵌在 URL 中的 username 和 password
        let (clean_url, parsed_auth) = match url::Url::parse(&raw_url) {
            Ok(mut u) => {
                let user = if !u.username().is_empty() {
                    Some(u.username().to_string())
                } else {
                    None
                };
                let pass = u.password().map(|p| p.to_string());

                // 清理 URL 中的凭据以防特定底层库解析exception
                let _ = u.set_username("");
                let _ = u.set_password(None);

                let auth = if let (Some(user), Some(pass)) = (user, pass) {
                    Some((user, pass))
                } else {
                    None
                };
                (u.to_string(), auth)
            }
            Err(_) => (raw_url.clone(), None),
        };

        let mut proxy = rquest::Proxy::all(&clean_url)
            .or_else(|_| rquest::Proxy::all(&raw_url))
            .map_err(|e| format!("Invalid proxy URL: {}", e))?;

        // 优先使用结构化 auth，兜底使用从 URL 内嵌解析出的 auth
        if let Some(auth) = &entry.auth {
            if !auth.username.is_empty() {
                proxy = proxy.basic_auth(&auth.username, &auth.password);
            }
        } else if let Some((user, pass)) = parsed_auth {
            proxy = proxy.basic_auth(&user, &pass);
        }

        Ok(PoolProxyConfig {
            proxy,
            entry_id: entry.id.clone(),
        })
    }

    /// 绑定account到代理
    pub async fn bind_account_to_proxy(
        &self,
        account_id: String,
        proxy_id: String,
    ) -> Result<(), String> {
        // Check: 代理是否存在
        {
            let config = self.config.read().await;
            if !config.proxies.iter().any(|p| p.id == proxy_id) {
                return Err(format!("Proxy {} not found", proxy_id));
            }

            // Check: 代理最大account数限制
            if let Some(entry) = config.proxies.iter().find(|p| p.id == proxy_id) {
                if let Some(max) = entry.max_accounts {
                    if max > 0 {
                        let current_count = self
                            .account_bindings
                            .iter()
                            .filter(|kv| *kv.value() == proxy_id)
                            .count();
                        if current_count >= max {
                            return Err(format!(
                                "Proxy {} has reached max accounts limit",
                                proxy_id
                            ));
                        }
                    }
                }
            }
        }

        // Update: 内存中的绑定
        self.account_bindings
            .insert(account_id.clone(), proxy_id.clone());

        // 持久化到config文件
        self.persist_bindings().await;

        tracing::info!(
            "[ProxyPool] Bound account {} to proxy {}",
            account_id,
            proxy_id
        );
        Ok(())
    }

    /// 解绑account代理
    pub async fn unbind_account_proxy(&self, account_id: String) {
        self.account_bindings.remove(&account_id);

        // 持久化到config文件
        self.persist_bindings().await;

        tracing::info!("[ProxyPool] Unbound account {}", account_id);
    }

    /// Get: accountcurrent绑定的代理ID
    pub fn get_account_binding(&self, account_id: &str) -> Option<String> {
        self.account_bindings
            .get(account_id)
            .map(|v| v.value().clone())
    }

    /// Get: 所有绑定关系的快照
    pub fn get_all_bindings_snapshot(&self) -> std::collections::HashMap<String, String> {
        self.account_bindings
            .iter()
            .map(|kv| (kv.key().clone(), kv.value().clone()))
            .collect()
    }

    /// [HOT-RELOAD] Re-sync the in-memory DashMap from `config.account_bindings`.
    /// Called after `update_proxy_pool` so that a wholesale ProxyPoolConfig
    /// replacement (e.g. via `save_config`) does not leave the in-memory
    /// bindings stale or empty.
    pub async fn sync_bindings_from_config(&self) {
        let config = self.config.read().await;
        let snapshot = config.account_bindings.clone();
        drop(config);

        // Reset the DashMap: clear old entries, then insert fresh ones.
        self.account_bindings.clear();
        for (account_id, proxy_id) in &snapshot {
            self.account_bindings
                .insert(account_id.clone(), proxy_id.clone());
        }
        tracing::info!(
            "[ProxyPool] Re-synced {} account bindings from config (hot-reload)",
            snapshot.len()
        );
    }

    /// 持久化绑定关系到config文件
    async fn persist_bindings(&self) {
        // Get: current绑定快照
        let bindings = self.get_all_bindings_snapshot();

        // Update: config中的绑定关系
        {
            let mut config = self.config.write().await;
            config.account_bindings = bindings;
        }

        // Save: 到磁盘
        if let Ok(mut app_config) = crate::modules::config::load_app_config() {
            let config = self.config.read().await;
            app_config.proxy.proxy_pool = config.clone();
            if let Err(e) = crate::modules::config::save_app_config(&app_config) {
                tracing::error!("[ProxyPool] Failed to persist bindings: {}", e);
            }
        }
    }

    /// Get: 内部config引用
    pub fn config(&self) -> &Arc<RwLock<ProxyPoolConfig>> {
        &self.config
    }

    /// [HARDENED M4] 记录代理节点传输或地理位置failed，触发动态故障转移
    pub async fn report_transport_failure(&self, proxy_id: &str, reason: &str) {
        tracing::warn!(
            "[ProxyPool] Recording transport/geo failure for proxy {}: {}",
            proxy_id,
            reason
        );
        let mut config = self.config.write().await;
        if proxy_id == "active_node" {
            // If 传入泛型 active_node，标记current首个健康节点failed
            if let Some(proxy) = config.proxies.iter_mut().find(|p| p.enabled && p.is_healthy) {
                proxy.is_healthy = false;
                proxy.last_check_time = Some(chrono::Utc::now().timestamp());
                let lower_reason = reason.to_lowercase();
                if lower_reason.contains("location") || lower_reason.contains("geo") {
                    if !proxy.tags.iter().any(|t| t == "geo_blocked") {
                        proxy.tags.push("geo_blocked".to_string());
                    }
                }
            }
        } else if let Some(proxy) = config.proxies.iter_mut().find(|p| p.id == proxy_id) {
            proxy.is_healthy = false;
            proxy.last_check_time = Some(chrono::Utc::now().timestamp());
            let lower_reason = reason.to_lowercase();
            if lower_reason.contains("location") || lower_reason.contains("geo") {
                if !proxy.tags.iter().any(|t| t == "geo_blocked") {
                    proxy.tags.push("geo_blocked".to_string());
                }
            }
        }
        // 轮换索引递增以触发下一次选择不同节点
        self.round_robin_index.fetch_add(1, Ordering::Relaxed);
    }

    /// [HARDENED M4] 记录代理节点传输success，恢复健康status
    pub async fn report_transport_success(&self, proxy_id: &str) {
        let mut config = self.config.write().await;
        if let Some(proxy) = config.proxies.iter_mut().find(|p| p.id == proxy_id) {
            proxy.is_healthy = true;
            proxy.last_check_time = Some(chrono::Utc::now().timestamp());
        }
    }

    /// [HARDENED M4] getcurrent健康代理节点数量
    pub async fn get_healthy_count(&self) -> usize {
        let config = self.config.read().await;
        config.proxies.iter().filter(|p| p.enabled && p.is_healthy).count()
    }

    /// [HARDENED M4] 触发动态故障转移并get下一个可用代理
    pub async fn trigger_failover(&self, failed_proxy_id: &str, reason: &str) -> Option<PoolProxyConfig> {
        self.report_transport_failure(failed_proxy_id, reason).await;
        let config = self.config.read().await;
        self.select_proxy_from_pool(&config).await.ok().flatten()
    }

    /// [HARDENED M4] 探测 Google Cloud Code 边缘节点连通性 (针对 HTTPS CONNECT 隧道与地域可用性)
    pub async fn probe_google_edge_reachability(&self, entry: &ProxyEntry) -> bool {
        if !entry.is_healthy || !entry.enabled {
            return false;
        }
        if entry.tags.iter().any(|t| t == "geo_blocked") || entry.url.contains("blocked") {
            return false;
        }
        let proxy_res = self.build_proxy_config(entry);
        let proxy_cfg = match proxy_res {
            Ok(cfg) => cfg,
            Err(_) => return false,
        };
        let client_result = Client::builder()
            .proxy(proxy_cfg.proxy)
            .emulation(Emulation::Chrome123)
            .timeout(Duration::from_secs(5))
            .build();
        let client = match client_result {
            Ok(c) => c,
            Err(_) => return false,
        };
        match client.head("https://cloudcode-pa.googleapis.com/v1internal").send().await {
            Ok(resp) => {
                let code = resp.status().as_u16();
                code != 400 && code != 403
            }
            Err(_) => false,
        }
    }

    /// 批量check代理健康status
    pub async fn health_check(&self) -> Result<(), String> {
        let proxies_to_check: Vec<ProxyEntry> = {
            let config = self.config.read().await;
            config
                .proxies
                .iter()
                .filter(|p| p.enabled)
                .cloned()
                .collect()
        };

        let concurrency_limit = 20usize;
        let results = stream::iter(proxies_to_check)
            .map(|proxy| async move {
                let (is_healthy, latency) = self.check_proxy_health(&proxy).await;

                let latency_msg = if let Some(ms) = latency {
                    format!("{}ms", ms)
                } else {
                    "-".to_string()
                };

                tracing::info!(
                    "Proxy {} ({}) health check: {} (Latency: {})",
                    proxy.name,
                    proxy.url,
                    if is_healthy { "✓ OK" } else { "✗ FAILED" },
                    latency_msg
                );

                (proxy.id, is_healthy, latency)
            })
            .buffer_unordered(concurrency_limit)
            .collect::<Vec<_>>()
            .await;

        // 统一updatestatus
        let mut config = self.config.write().await;
        for (id, is_healthy, latency) in results {
            if let Some(proxy) = config.proxies.iter_mut().find(|p| p.id == id) {
                proxy.is_healthy = is_healthy;
                proxy.latency = latency;
                proxy.last_check_time = Some(chrono::Utc::now().timestamp());
            }
        }

        Ok(())
    }

    /// Check: 单个代理健康status
    async fn check_proxy_health(&self, entry: &ProxyEntry) -> (bool, Option<u64>) {
        const DEFAULT_HEALTH_CHECK_URL: &str = "https://cp.cloudflare.com/generate_204";

        let check_url = if let Some(url) = &entry.health_check_url {
            if url.trim().is_empty() {
                DEFAULT_HEALTH_CHECK_URL
            } else {
                url.as_str()
            }
        } else {
            DEFAULT_HEALTH_CHECK_URL
        };

        // 尝试构建 Client，如果failed直接视为不健康
        let proxy_res = self.build_proxy_config(entry);
        if let Err(e) = proxy_res {
            tracing::error!("Proxy {} build config failed: {}", entry.url, e);
            return (false, None);
        }
        let proxy_cfg = proxy_res.unwrap();

        let client_result = Client::builder()
            .proxy(proxy_cfg.proxy)
            .emulation(Emulation::Chrome123)
            .timeout(Duration::from_secs(10))
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
            .build();

        let client = match client_result {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("Proxy {} build client failed: {}", entry.url, e);
                return (false, None);
            }
        };

        let start = std::time::Instant::now();
        match client.get(check_url).send().await {
            Ok(resp) => {
                let latency = start.elapsed().as_millis() as u64;
                if resp.status().is_success() {
                    (true, Some(latency))
                } else {
                    tracing::warn!(
                        "Proxy {} health check status error: {}",
                        entry.url,
                        resp.status()
                    );
                    (false, None)
                }
            }
            Err(e) => {
                tracing::warn!("Proxy {} health check request failed: {}", entry.url, e);
                (false, None)
            }
        }
    }

    /// 启动健康check循环
    pub fn start_health_check_loop(self: Arc<Self>) {
        tokio::spawn(async move {
            tracing::info!("Starting proxy pool health check loop...");
            loop {
                // Perform check only if enabled
                let enabled = self.config.read().await.enabled;
                if enabled {
                    if let Err(e) = self.health_check().await {
                        tracing::error!("Proxy pool health check failed: {}", e);
                    }
                }

                // Get interval and sleep AFTER check
                let interval_secs = {
                    let cfg = self.config.read().await;
                    if !cfg.enabled {
                        60 // check every minute if disabled
                    } else {
                        cfg.health_check_interval.max(30) // Back to default min 30s
                    }
                };

                tokio::time::sleep(Duration::from_secs(interval_secs)).await;
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proxy::config::ProxyAuth;

    #[test]
    fn test_build_proxy_config_with_explicit_auth() {
        let pool = ProxyPoolManager::new(Arc::new(RwLock::new(ProxyPoolConfig::default())));
        let entry = ProxyEntry {
            id: "p1".to_string(),
            name: "test".to_string(),
            url: "http://127.0.0.1:8080".to_string(),
            auth: Some(ProxyAuth {
                username: "user".to_string(),
                password: "pass".to_string(),
            }),
            enabled: true,
            priority: 1,
            tags: vec![],
            max_accounts: None,
            health_check_url: None,
            last_check_time: None,
            is_healthy: true,
            latency: None,
        };

        let res = pool.build_proxy_config(&entry);
        assert!(res.is_ok());
        assert_eq!(res.unwrap().entry_id, "p1");
    }

    #[test]
    fn test_build_proxy_config_with_url_auth() {
        let pool = ProxyPoolManager::new(Arc::new(RwLock::new(ProxyPoolConfig::default())));
        let entry = ProxyEntry {
            id: "p2".to_string(),
            name: "test_url_auth".to_string(),
            url: "http://user:pass@127.0.0.1:10080".to_string(),
            auth: None,
            enabled: true,
            priority: 1,
            tags: vec![],
            max_accounts: None,
            health_check_url: None,
            last_check_time: None,
            is_healthy: true,
            latency: None,
        };

        let res = pool.build_proxy_config(&entry);
        assert!(res.is_ok());
        assert_eq!(res.unwrap().entry_id, "p2");
    }
}

