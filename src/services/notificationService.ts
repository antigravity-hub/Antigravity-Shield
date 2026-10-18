import { isTauri } from '../utils/env';

const recentDesktopNotifications = new Map<string, number>();
const DESKTOP_NOTIFICATION_DEDUP_MS = 15_000; // 15 seconds dedup window for identical title+body

/**
 * Dispatch an OS-level native desktop notification (Windows Toast, macOS Alert, Linux notify-send)
 * Falls back to browser Web Notification API if running in web context.
 */
export async function sendDesktopNotification(title: string, body: string): Promise<void> {
    const key = `${title.trim()}:${body.trim()}`;
    const now = Date.now();
    const lastTime = recentDesktopNotifications.get(key) || 0;
    if (now - lastTime < DESKTOP_NOTIFICATION_DEDUP_MS) {
        return; // Throttled duplicate OS notification
    }
    recentDesktopNotifications.set(key, now);

    // Housekeeping: clean expired keys if map grows large
    if (recentDesktopNotifications.size > 50) {
        for (const [k, timestamp] of recentDesktopNotifications.entries()) {
            if (now - timestamp > DESKTOP_NOTIFICATION_DEDUP_MS) {
                recentDesktopNotifications.delete(k);
            }
        }
    }

    if (isTauri()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('send_desktop_notification', { title, body });
            return;
        } catch (err) {
            console.warn('[NotificationService] Failed to send native OS notification via Tauri:', err);
        }
    }

    // Web / fallback Notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
            if (Notification.permission === 'granted') {
                new Notification(title, {
                    body,
                    icon: '/icons/128x128.png',
                });
            } else if (Notification.permission === 'default') {
                Notification.requestPermission().then((perm) => {
                    if (perm === 'granted') {
                        new Notification(title, {
                            body,
                            icon: '/icons/128x128.png',
                        });
                    }
                }).catch(() => {});
            }
        } catch (e) {
            console.warn('[NotificationService] Fallback web notification failed:', e);
        }
    }
}
