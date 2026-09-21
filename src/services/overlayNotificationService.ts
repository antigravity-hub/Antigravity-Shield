import { request as invoke } from '../utils/request';
import { listen } from '@tauri-apps/api/event';

export interface OverlayNotificationOptions {
    notification_type: 'countdown' | 'toast';
    title: string;
    message: string;
    model_name?: string;
    current_email?: string;
    target_email?: string;
    target_quota_score?: number;
    countdown_secs?: number;
    target_account_id?: string;
    target_env?: string;
}

export type OverlayUserAction = 'switch_now' | 'snooze' | 'cancel';

export interface OverlayActionEvent {
    action: OverlayUserAction;
    target_account_id?: string;
    target_env?: string;
    target_email?: string;
}

/**
 * Trigger the floating HUD notification overlay window.
 * Returns a promise that resolves when the user makes a choice (switch_now, snooze, cancel).
 */
export async function showFloatingOverlay(
    options: OverlayNotificationOptions
): Promise<OverlayUserAction> {
    try {
        await invoke('show_overlay_notification', {
            payload: options,
        });

        if (options.notification_type !== 'countdown') {
            return 'cancel';
        }

        return new Promise<OverlayUserAction>((resolve) => {
            let unlistenFn: (() => void) | null = null;

            const cleanup = () => {
                if (unlistenFn) {
                    unlistenFn();
                    unlistenFn = null;
                }
            };

            listen<OverlayActionEvent>('overlay-user-action', (event) => {
                cleanup();
                resolve(event.payload.action);
            }).then((fn) => {
                unlistenFn = fn;
            });
        });
    } catch (err) {
        console.error('[OverlayService] Failed to show floating overlay:', err);
        return 'switch_now'; // Fallback to direct action if overlay fails
    }
}

/**
 * Dismiss/hide the floating overlay notification HUD.
 */
export async function hideFloatingOverlay(): Promise<void> {
    try {
        await invoke('hide_overlay_notification');
    } catch (err) {
        console.error('[OverlayService] Failed to hide floating overlay:', err);
    }
}

/**
 * Fetch current overlay notification payload cached in backend
 */
export async function getFloatingOverlayPayload(): Promise<OverlayNotificationOptions | null> {
    try {
        return await invoke<OverlayNotificationOptions | null>('get_overlay_payload');
    } catch (err) {
        console.error('[OverlayService] Failed to get overlay payload:', err);
        return null;
    }
}
