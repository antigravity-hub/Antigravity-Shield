// image_pool.rs - Multimodal & Imagen 3 Token Bucket RPM Smoother & Image Pool
// Hardened rate pacing, explicit quota reset persistence, and bounded fair queueing.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::{watch, Mutex};
use tracing::info;

/// Default interval between image dispatches on the same account (1.5 RPM = 40 seconds)
pub const DEFAULT_IMAGE_PACING_SECS: u64 = 40;

/// Maximum client wait deadline in queue before returning 429
pub const DEFAULT_IMAGE_QUEUE_TIMEOUT_SECS: u64 = 45;

/// State for an individual account's token bucket in the image pool
#[derive(Debug, Clone)]
pub struct AccountTokenBucket {
    pub account_id: String,
    pub enabled: bool,
    pub in_use: usize,
    pub max_concurrency: usize,
    pub last_dispatched_at: Option<Instant>,
    pub pacing_interval: Duration,
    pub locked_until: Option<Instant>,
    pub lockout_reason: Option<String>,
}

impl AccountTokenBucket {
    pub fn new(account_id: String, max_concurrency: usize, pacing_interval: Duration) -> Self {
        Self {
            account_id,
            enabled: true,
            in_use: 0,
            max_concurrency,
            last_dispatched_at: None,
            pacing_interval,
            locked_until: None,
            lockout_reason: None,
        }
    }

    /// Check whether this account bucket is ready to accept an image request
    pub fn is_available(&self, now: Instant) -> bool {
        if !self.enabled {
            return false;
        }
        if self.in_use >= self.max_concurrency {
            return false;
        }
        if let Some(locked_until) = self.locked_until {
            if now < locked_until {
                return false;
            }
        }
        if let Some(last_dispatch) = self.last_dispatched_at {
            if now.saturating_duration_since(last_dispatch) < self.pacing_interval {
                return false;
            }
        }
        true
    }

    /// Calculate time until this account will next be ready
    pub fn time_until_available(&self, now: Instant) -> Duration {
        if !self.enabled || self.in_use >= self.max_concurrency {
            return Duration::from_secs(60);
        }
        let mut max_wait = Duration::ZERO;
        if let Some(locked_until) = self.locked_until {
            if locked_until > now {
                let wait = locked_until.saturating_duration_since(now);
                if wait > max_wait {
                    max_wait = wait;
                }
            }
        }
        if let Some(last_dispatch) = self.last_dispatched_at {
            let elapsed = now.saturating_duration_since(last_dispatch);
            if elapsed < self.pacing_interval {
                let wait = self.pacing_interval - elapsed;
                if wait > max_wait {
                    max_wait = wait;
                }
            }
        }
        max_wait
    }
}

/// A permit representing an active leased slot on an account in the image pool
pub struct ImagePoolPermit {
    pub account_id: String,
    pool: Arc<TokenBucketImagePool>,
}

impl Drop for ImagePoolPermit {
    fn drop(&mut self) {
        self.pool.release_slot(&self.account_id);
    }
}

/// Token bucket image pool coordinator
pub struct TokenBucketImagePool {
    buckets: Arc<Mutex<HashMap<String, AccountTokenBucket>>>,
    pacing_interval: Duration,
    default_concurrency: usize,
    change_tx: watch::Sender<u64>,
    metrics: ImagePoolMetrics,
}

#[derive(Default)]
pub struct ImagePoolMetrics {
    pub total_dispatched: AtomicUsize,
    pub total_queued: AtomicUsize,
    pub total_timeouts: AtomicUsize,
    pub total_rate_limited: AtomicUsize,
}

impl TokenBucketImagePool {
    pub fn new(
        account_ids: Vec<String>,
        per_account_concurrency: usize,
        pacing_interval_secs: u64,
    ) -> Arc<Self> {
        let (change_tx, _) = watch::channel(0);
        let pacing_interval = Duration::from_secs(pacing_interval_secs.max(1));
        let mut map = HashMap::new();
        for id in account_ids {
            map.insert(
                id.clone(),
                AccountTokenBucket::new(id, per_account_concurrency, pacing_interval),
            );
        }

        Arc::new(Self {
            buckets: Arc::new(Mutex::new(map)),
            pacing_interval,
            default_concurrency: per_account_concurrency,
            change_tx,
            metrics: ImagePoolMetrics::default(),
        })
    }

    pub fn subscribe(&self) -> watch::Receiver<u64> {
        self.change_tx.subscribe()
    }

    fn notify_change(&self) {
        self.change_tx.send_modify(|gen| *gen = gen.wrapping_add(1));
    }

    /// Try to acquire an immediate slot on a specific account
    pub async fn try_acquire_account(
        self: &Arc<Self>,
        account_id: &str,
    ) -> Option<ImagePoolPermit> {
        let mut buckets = self.buckets.lock().await;
        let now = Instant::now();
        if let Some(bucket) = buckets.get_mut(account_id) {
            if bucket.is_available(now) {
                bucket.in_use += 1;
                bucket.last_dispatched_at = Some(now);
                self.metrics.total_dispatched.fetch_add(1, Ordering::Relaxed);
                drop(buckets);
                self.notify_change();
                return Some(ImagePoolPermit {
                    account_id: account_id.to_string(),
                    pool: self.clone(),
                });
            }
        }
        None
    }

    /// Try to acquire any available account from the pool (pacing & load aware)
    pub async fn try_acquire_any(
        self: &Arc<Self>,
        excluded_accounts: &HashSet<String>,
    ) -> Option<ImagePoolPermit> {
        let mut buckets = self.buckets.lock().await;
        let now = Instant::now();

        // Sort candidates by least in_use, then oldest last_dispatched_at
        let mut candidates: Vec<_> = buckets
            .values()
            .filter(|b| !excluded_accounts.contains(&b.account_id) && b.is_available(now))
            .map(|b| (b.in_use, b.last_dispatched_at, b.account_id.clone()))
            .collect();

        candidates.sort_by_key(|c| (c.0, c.1));

        if let Some((_, _, account_id)) = candidates.into_iter().next() {
            if let Some(bucket) = buckets.get_mut(&account_id) {
                bucket.in_use += 1;
                bucket.last_dispatched_at = Some(now);
                self.metrics.total_dispatched.fetch_add(1, Ordering::Relaxed);
                drop(buckets);
                self.notify_change();
                return Some(ImagePoolPermit {
                    account_id,
                    pool: self.clone(),
                });
            }
        }

        None
    }

    /// Acquire a permit waiting up to `timeout` across available pool accounts
    pub async fn acquire_bounded(
        self: &Arc<Self>,
        excluded_accounts: &HashSet<String>,
        timeout: Duration,
    ) -> Result<ImagePoolPermit, String> {
        self.metrics.total_queued.fetch_add(1, Ordering::Relaxed);
        let deadline = Instant::now() + timeout;
        let mut watcher = self.subscribe();

        loop {
            watcher.borrow_and_update();

            if let Some(permit) = self.try_acquire_any(excluded_accounts).await {
                return Ok(permit);
            }

            let now = Instant::now();
            if now >= deadline {
                self.metrics.total_timeouts.fetch_add(1, Ordering::Relaxed);
                return Err("Image token bucket queue wait deadline exceeded".to_string());
            }

            let remaining = deadline.saturating_duration_since(now);

            // Calculate min wait time until next possible bucket regeneration
            let min_bucket_wait = {
                let buckets = self.buckets.lock().await;
                buckets
                    .values()
                    .filter(|b| !excluded_accounts.contains(&b.account_id) && b.enabled)
                    .map(|b| b.time_until_available(now))
                    .min()
                    .unwrap_or(Duration::from_millis(500))
            };

            let sleep_dur = remaining.min(min_bucket_wait).min(Duration::from_millis(500));

            tokio::select! {
                _ = watcher.changed() => {},
                _ = tokio::time::sleep(sleep_dur) => {},
            }
        }
    }

    /// Internal callback to release a slot
    pub(crate) fn release_slot(&self, account_id: &str) {
        let buckets = self.buckets.clone();
        let account_id = account_id.to_string();
        let change_tx = self.change_tx.clone();

        tokio::spawn(async move {
            let mut lock = buckets.lock().await;
            if let Some(bucket) = lock.get_mut(&account_id) {
                bucket.in_use = bucket.in_use.saturating_sub(1);
            }
            drop(lock);
            change_tx.send_modify(|gen| *gen = gen.wrapping_add(1));
        });
    }

    /// Apply explicit lockout cooldown to an account (e.g. from Google 429 RetryInfo or quotaResetDelay)
    pub async fn apply_account_lockout(
        &self,
        account_id: &str,
        duration: Duration,
        reason: &str,
    ) {
        self.metrics.total_rate_limited.fetch_add(1, Ordering::Relaxed);
        let mut buckets = self.buckets.lock().await;
        if let Some(bucket) = buckets.get_mut(account_id) {
            let until = Instant::now() + duration;
            bucket.locked_until = Some(until);
            bucket.lockout_reason = Some(reason.to_string());
            info!(
                account = account_id,
                duration_secs = duration.as_secs(),
                reason = reason,
                "Applied token bucket lockout cooldown to account"
            );
        }
        drop(buckets);
        self.notify_change();
    }

    /// Synchronize active accounts from TokenManager
    pub async fn sync_accounts(&self, active_account_ids: &[String]) {
        let active_set: HashSet<_> = active_account_ids.iter().cloned().collect();
        let mut buckets = self.buckets.lock().await;

        for (id, bucket) in buckets.iter_mut() {
            bucket.enabled = active_set.contains(id);
        }

        for id in active_account_ids {
            buckets.entry(id.clone()).or_insert_with(|| {
                AccountTokenBucket::new(id.clone(), self.default_concurrency, self.pacing_interval)
            });
        }

        drop(buckets);
        self.notify_change();
    }

    /// Total available slots ready for immediate dispatch
    pub async fn available_slots(&self) -> usize {
        let buckets = self.buckets.lock().await;
        let now = Instant::now();
        buckets.values().filter(|b| b.is_available(now)).count()
    }
}

/// Computes exponential jitter backoff: 1.5^attempt * base_delay with +/- 20% random jitter
pub fn calculate_jitter_backoff(attempt: usize, base_delay: Duration, max_delay: Duration) -> Duration {
    let factor = 1.5_f64.powi(attempt as i32);
    let raw_ms = (base_delay.as_millis() as f64 * factor) as u64;
    let clamped_ms = raw_ms.min(max_delay.as_millis() as u64);

    let now_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(12345);
    let jitter_pct = 0.8 + ((now_nanos % 40) as f64 / 100.0);

    Duration::from_millis(((clamped_ms as f64) * jitter_pct) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_token_bucket_pacing_and_slots() {
        let accounts = vec!["acc-1".to_string(), "acc-2".to_string()];
        let pool = TokenBucketImagePool::new(accounts, 1, 1);

        assert_eq!(pool.available_slots().await, 2);

        let permit1 = pool.try_acquire_account("acc-1").await;
        assert!(permit1.is_some());

        assert!(pool.try_acquire_account("acc-1").await.is_none());
        assert_eq!(pool.available_slots().await, 1);

        let permit2 = pool.try_acquire_any(&HashSet::new()).await;
        assert!(permit2.is_some());
        assert_eq!(permit2.unwrap().account_id, "acc-2");

        drop(permit1);
        tokio::time::sleep(Duration::from_millis(50)).await;

        assert!(pool.try_acquire_account("acc-1").await.is_none());

        tokio::time::sleep(Duration::from_millis(1050)).await;
        assert!(pool.try_acquire_account("acc-1").await.is_some());
    }

    #[tokio::test]
    async fn test_lockout_persistence_and_expiry() {
        let accounts = vec!["acc-lock".to_string()];
        let pool = TokenBucketImagePool::new(accounts, 1, 0);

        assert_eq!(pool.available_slots().await, 1);

        pool.apply_account_lockout("acc-lock", Duration::from_millis(300), "QUOTA_EXHAUSTED").await;
        assert_eq!(pool.available_slots().await, 0);
        assert!(pool.try_acquire_account("acc-lock").await.is_none());

        tokio::time::sleep(Duration::from_millis(350)).await;
        assert_eq!(pool.available_slots().await, 1);
        assert!(pool.try_acquire_account("acc-lock").await.is_some());
    }

    #[tokio::test]
    async fn test_bounded_queue_timeout() {
        let accounts = vec!["acc-slow".to_string()];
        let pool = TokenBucketImagePool::new(accounts, 1, 10);

        let _held_permit = pool.try_acquire_account("acc-slow").await.unwrap();

        let res = pool
            .acquire_bounded(&HashSet::new(), Duration::from_millis(100))
            .await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("deadline exceeded"));
    }

    #[test]
    fn test_jitter_backoff_calculation() {
        let base = Duration::from_millis(1000);
        let max = Duration::from_millis(10000);

        let b0 = calculate_jitter_backoff(0, base, max);
        let b1 = calculate_jitter_backoff(1, base, max);
        let b2 = calculate_jitter_backoff(2, base, max);

        assert!(b0.as_millis() >= 800 && b0.as_millis() <= 1200);
        assert!(b1.as_millis() >= 1200 && b1.as_millis() <= 1800);
        assert!(b2.as_millis() >= 1800 && b2.as_millis() <= 2700);
    }
}
