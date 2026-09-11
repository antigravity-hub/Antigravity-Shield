import { useEffect, useRef } from 'react';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAccountStore } from '../../stores/useAccountStore';

function BackgroundTaskRunner() {
    const { config } = useConfigStore();

    // Use refs to track previous state to detect "off -> on" transitions
    const prevAutoRefreshRef = useRef(false);
    const prevAutoSyncRef = useRef(false);

    // Hybrid Adaptive Jittered Auto-Refresh Quota Scheduler
    useEffect(() => {
        if (!config) return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let isCancelled = false;
        let cycleCount = 0;
        const { auto_refresh, refresh_interval } = config;
        const { refreshActiveAccountQuota, refreshAllQuotas } = useAccountStore.getState();

        // Immediate sync on enable
        if (auto_refresh && !prevAutoRefreshRef.current) {
            console.log('[BackgroundTask] Auto-refresh enabled, executing initial active sync...');
            refreshActiveAccountQuota();
        }
        prevAutoRefreshRef.current = auto_refresh;

        if (auto_refresh && refresh_interval > 0) {
            const scheduleNextRun = () => {
                if (isCancelled) return;

                // Base interval in milliseconds (min 1 minute)
                const baseMs = Math.max(1, refresh_interval) * 60 * 1000;
                // Humanized anti-abuse jitter between +15s and +45s
                const jitterMs = Math.floor(Math.random() * 30000) + 15000;
                const nextDelay = baseMs + jitterMs;

                console.log(`[BackgroundTask] Scheduled next jittered sync in ${(nextDelay / 1000).toFixed(1)}s (jitter: +${(jitterMs / 1000).toFixed(1)}s)`);

                timeoutId = setTimeout(async () => {
                    if (isCancelled) return;

                    // Pause network requests if document has been hidden/idle for a long time
                    if (document.hidden && cycleCount > 0 && cycleCount % 2 !== 0) {
                        console.log('[BackgroundTask] Window hidden, deferring sync cycle...');
                        scheduleNextRun();
                        return;
                    }

                    try {
                        cycleCount++;
                        // Every 3rd cycle do a full fleet sync; otherwise prioritize active account for speed & zero-spam
                        if (cycleCount % 3 === 0) {
                            console.log('[BackgroundTask] Staggered full fleet quota sync...');
                            await refreshAllQuotas();
                        } else {
                            console.log('[BackgroundTask] Active account priority quota sync...');
                            await refreshActiveAccountQuota();
                        }
                    } catch (err) {
                        console.warn('[BackgroundTask] Quota sync cycle failed gracefully:', err);
                    }

                    scheduleNextRun();
                }, nextDelay);
            };

            scheduleNextRun();
        }

        return () => {
            isCancelled = true;
            if (timeoutId) {
                console.log('[BackgroundTask] Clearing adaptive auto-refresh scheduler');
                clearTimeout(timeoutId);
            }
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
