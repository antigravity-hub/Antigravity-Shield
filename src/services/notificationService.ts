import { isTauri } from '../utils/env';

/**
 * Dispatch an OS-level native desktop notification (Windows Toast, macOS Alert, Linux notify-send)
 * Falls back to browser Web Notification API if running in web context.
 */
export async function sendDesktopNotification(title: string, body: string): Promise<void> {
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
