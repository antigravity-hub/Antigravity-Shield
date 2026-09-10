import { getCurrentWindow, LogicalPosition, LogicalSize, currentMonitor } from '@tauri-apps/api/window';
import { isTauri } from './env';

/**
 * Apply optimal window size based on monitor resolution:
 * - If monitor is Full HD (>= 1920x1080) and can fit: 1750 x 1000, centered
 * - If monitor is less than Full HD: full width of available work area
 */
export const applyResponsiveFullViewSize = async () => {
    if (!isTauri()) return;
    try {
        const win = getCurrentWindow();
        const monitor = await currentMonitor();

        if (monitor) {
            const scale = monitor.scaleFactor || 1;
            const physicalWidth = monitor.size.width;
            const physicalHeight = monitor.size.height;

            // Work area dimensions in logical pixels (accounting for Windows taskbar & system scaling)
            const workAreaLogicalWidth = Math.floor(monitor.workArea.size.width / scale);
            const workAreaLogicalHeight = Math.floor(monitor.workArea.size.height / scale);
            const workAreaLogicalX = Math.floor(monitor.workArea.position.x / scale);
            const workAreaLogicalY = Math.floor(monitor.workArea.position.y / scale);

            const isFullHdOrHigher = physicalWidth >= 1920 && physicalHeight >= 1080;

            if (isFullHdOrHigher && workAreaLogicalWidth >= 1750 && workAreaLogicalHeight >= 1000) {
                // Monitor is Full HD (or higher) and logical work area comfortably fits 1750x1000
                await win.setSize(new LogicalSize(1750, 1000));
                await win.center();
            } else {
                // Monitor is less than Full HD (< 1920) or display scaling restricts available space:
                // Run full width!
                const targetWidth = workAreaLogicalWidth;
                const targetHeight = Math.min(1000, workAreaLogicalHeight);
                const posY = workAreaLogicalY + Math.max(0, Math.floor((workAreaLogicalHeight - targetHeight) / 2));
                await win.setSize(new LogicalSize(targetWidth, targetHeight));
                await win.setPosition(new LogicalPosition(workAreaLogicalX, posY));
            }
        } else {
            // Fallback if monitor detection fails
            const screenWidth = window.screen.availWidth || window.innerWidth;
            const screenHeight = window.screen.availHeight || window.innerHeight;
            if (screenWidth >= 1920 && screenHeight >= 1000) {
                await win.setSize(new LogicalSize(1750, 1000));
                await win.center();
            } else {
                await win.setSize(new LogicalSize(screenWidth, Math.min(1000, screenHeight)));
            }
        }
    } catch (error) {
        console.error('Failed to apply responsive window size:', error);
    }
};

/**
 * Enter mini view mode
 * @param contentHeight The height of the content to fit
 * @param shouldCenter Whether to center the window (default: false)
 */
export const enterMiniMode = async (contentHeight: number, shouldCenter: boolean = false) => {
    if (!isTauri()) return;
    try {
        const win = getCurrentWindow();

        // Hide window decorations (title bar) first to ensure accurate sizing
        await win.setDecorations(false);

        // Set window size: width 300, height = content height 
        await win.setSize(new LogicalSize(300, contentHeight + 2));

        await win.setAlwaysOnTop(true);
        // Enable window shadow
        await win.setShadow(true);
        // Disable resizing in mini mode
        await win.setResizable(false);

        // Center window only if requested (usually on first load)
        if (shouldCenter) {
            await win.center();
        }
    } catch (error) {
        console.error('Failed to enter mini mode:', error);
    }
};

/**
 * Exit mini view mode and restore default window state
 */
export const exitMiniMode = async () => {
    if (!isTauri()) return;
    try {
        const win = getCurrentWindow();
        await applyResponsiveFullViewSize();
        await win.setAlwaysOnTop(false);
        // Restore window decorations (title bar)
        await win.setDecorations(true);
        // Re-enable resizing
        await win.setResizable(true);
    } catch (error) {
        console.error('Failed to exit mini mode:', error);
    }
};

/**
 * Ensure window is in valid full view state (Self-healing)
 * Used on app startup to configure responsive dimensions or recover from mini mode
 */
export const ensureFullViewState = async () => {
    if (!isTauri()) return;
    try {
        const win = getCurrentWindow();
        const size = await win.outerSize();
        // If window is suspiciously narrow (likely leftover from Mini View or uninitialized), restore default size
        if (size.width < 500) {
            await applyResponsiveFullViewSize();
        } else {
            await applyResponsiveFullViewSize();
        }
        // Always enforce standard window properties for Full View
        await win.setDecorations(true);
        await win.setResizable(true);
        await win.setAlwaysOnTop(false);
    } catch (error) {
        console.error('Failed to ensure full view state:', error);
    }
};
