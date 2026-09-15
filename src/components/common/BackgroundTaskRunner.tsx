import { useEffect, useRef } from 'react';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAccountStore } from '../../stores/useAccountStore';

function BackgroundTaskRunner() {
    const { config } = useConfigStore();

    // Use refs to track previous state to detect "off -> on" transitions
    const prevAutoRefreshRef = useRef(false);
    const prevAutoSyncRef = useRef(false);

    const lastSyncTimeRef = useRef<number>(Date.now());

    // Hybrid Adaptive Jittered Auto-Refresh Quota Scheduler
    useEffect(() => {
        if (!config) return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let isCancelled = false;
        const { auto_refresh, refresh_interval } = config;
        const { refreshActiveAccountQuota, refreshAllQuotas } = useAccountStore.getState();

        // Immediate sync on startup/enable
        if (auto_refresh && !prevAutoRefreshRef.current) {
            console.log('[BackgroundTask] Auto-refresh enabled, executing initial active and fleet sync...');
            lastSyncTimeRef.current = Date.now();
            refreshActiveAccountQuota();
            // Stagger full fleet sync slightly (1.5s) to guarantee snappy startup without network congestion
            setTimeout(() => {
                if (!isCancelled) {
                    refreshAllQuotas(true).catch(err => {
                        console.warn('[BackgroundTask] Initial background full fleet sync failed gracefully:', err);
                    });
                }
            }, 1500);
        }
        prevAutoRefreshRef.current = auto_refresh;

        if (auto_refresh && refresh_interval > 0) {
            const scheduleNextRun = () => {
                if (isCancelled) return;

                // Base interval in milliseconds (min 1 minute, default 10 minutes)
                const baseMs = Math.max(1, refresh_interval) * 60 * 1000;
                // Humanized anti-abuse jitter between +15s and +35s
                const jitterMs = Math.floor(Math.random() * 20000) + 15000;
                const nextDelay = baseMs + jitterMs;

                console.log(`[BackgroundTask] Scheduled next jittered fleet sync in ${(nextDelay / 1000).toFixed(1)}s (jitter: +${(jitterMs / 1000).toFixed(1)}s)`);

                timeoutId = setTimeout(async () => {
                    if (isCancelled) return;

                    try {
                        console.log('[BackgroundTask] Executing scheduled full-fleet quota sync...');
                        lastSyncTimeRef.current = Date.now();
                        await refreshAllQuotas(true);
                    } catch (err) {
                        console.warn('[BackgroundTask] Fleet quota sync cycle failed gracefully:', err);
                    }

                    scheduleNextRun();
                }, nextDelay);
            };

            scheduleNextRun();
        }

        // Opportunistic desktop focus wake-up:
        // When user switches back from IDE/browser after being away for > 5 minutes, immediately sync.
        const handleWakeup = () => {
            if (!auto_refresh || isCancelled) return;
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                // If more than 5 minutes have elapsed since the last sync, trigger an immediate opportunistic refresh
                if (now - lastSyncTimeRef.current > 5 * 60 * 1000) {
                    console.log('[BackgroundTask] Window regained focus after idle, triggering opportunistic fleet sync...');
                    lastSyncTimeRef.current = now;
                    refreshAllQuotas(true).catch(err => {
                        console.warn('[BackgroundTask] Opportunistic fleet sync failed gracefully:', err);
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleWakeup);
        window.addEventListener('focus', handleWakeup);

        return () => {
            isCancelled = true;
            if (timeoutId) {
                console.log('[BackgroundTask] Clearing adaptive auto-refresh scheduler');
                clearTimeout(timeoutId);
            }
            document.removeEventListener('visibilitychange', handleWakeup);
            window.removeEventListener('focus', handleWakeup);
        };
    }, [config?.auto_refresh, config?.refresh_interval]);

    // Auto Sync Current Account Effect
    useEffect(() => {
        if (!config) return;

        let intervalId: ReturnType<typeof setTimeout> | null = null;
        const { auto_sync, sync_interval } = config;
        const { syncAccountFromDb } = useAccountStore.getState();

        // Check if we just turned it on
        if (auto_sync && !prevAutoSyncRef.current) {
            console.log('[BackgroundTask] Auto-sync enabled, executing immediately...');
            syncAccountFromDb();
        }
        prevAutoSyncRef.current = auto_sync;

        if (auto_sync && sync_interval > 0) {
            console.log(`[BackgroundTask] Starting auto-sync account timer: ${sync_interval} mins`);
            intervalId = setInterval(() => {
                console.log('[BackgroundTask] Auto-syncing current account from DB...');
                syncAccountFromDb();
            }, Math.min(sync_interval * 60 * 1000, 2147483647));
        }

        return () => {
            if (intervalId) {
                console.log('[BackgroundTask] Clearing auto-sync timer');
                clearInterval(intervalId);
            }
        };
    }, [config?.auto_sync, config?.sync_interval]);

    // Render nothing
    return null;
}

export default BackgroundTaskRunner;
