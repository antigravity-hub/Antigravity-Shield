import { useEffect, useRef } from 'react';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAccountStore } from '../../stores/useAccountStore';

/**
 * BackgroundTaskRunner
 * 
 * Note: Persistent periodic background quota refreshes and account DB syncs
 * are now natively managed by the Rust backend daemon (src-tauri/src/modules/scheduler.rs)
 * which continues running uninterrupted even when the window is minimized or hidden in the system tray.
 * 
 * This frontend component serves solely for:
 * 1. Immediate sync when user toggles auto-refresh or auto-sync ON in Settings.
 * 2. Opportunistic UI sync when the window regains focus after being idle.
 */
function BackgroundTaskRunner() {
    const { config } = useConfigStore();

    // Track previous states to detect "off -> on" user toggles
    const prevAutoRefreshRef = useRef(false);
    const prevAutoSyncRef = useRef(false);
    const lastFocusSyncRef = useRef<number>(Date.now());

    // Immediate sync on setting toggle
    useEffect(() => {
        if (!config) return;

        const { auto_refresh, auto_sync } = config;
        const { refreshActiveAccountQuota, refreshAllQuotas, syncAccountFromDb } = useAccountStore.getState();

        // If user just enabled auto_refresh in Settings
        if (auto_refresh && !prevAutoRefreshRef.current) {
            console.log('[BackgroundTask] Auto-refresh enabled by user, executing initial sync...');
            refreshActiveAccountQuota();
            setTimeout(() => {
                refreshAllQuotas(true).catch(err => {
                    console.warn('[BackgroundTask] Fleet sync on toggle failed gracefully:', err);
                });
            }, 1000);
        }
        prevAutoRefreshRef.current = auto_refresh;

        // If user just enabled auto_sync in Settings
        if (auto_sync && !prevAutoSyncRef.current) {
            console.log('[BackgroundTask] Auto-sync enabled by user, executing immediate DB sync...');
            syncAccountFromDb();
        }
        prevAutoSyncRef.current = auto_sync;
    }, [config?.auto_refresh, config?.auto_sync]);

    // Opportunistic desktop focus wake-up:
    // When user returns to window after > 5 minutes, sync so UI has fresh data instantly
    useEffect(() => {
        let isCancelled = false;

        const handleWakeup = () => {
            if (isCancelled) return;
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                if (now - lastFocusSyncRef.current > 5 * 60 * 1000) {
                    console.log('[BackgroundTask] Window regained focus after idle, triggering opportunistic UI sync...');
                    lastFocusSyncRef.current = now;
                    const { refreshAllQuotas } = useAccountStore.getState();
                    refreshAllQuotas(true).catch(err => {
                        console.warn('[BackgroundTask] Opportunistic UI sync failed gracefully:', err);
                    });
                }
            }
        };

        document.addEventListener('visibilitychange', handleWakeup);
        window.addEventListener('focus', handleWakeup);

        return () => {
            isCancelled = true;
            document.removeEventListener('visibilitychange', handleWakeup);
            window.removeEventListener('focus', handleWakeup);
        };
    }, []);

    return null;
}

export default BackgroundTaskRunner;
