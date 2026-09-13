import { getCurrentWindow, LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, currentMonitor } from '@tauri-apps/api/window';
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

interface SavedWindowState {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized: boolean;
}

let savedFullViewState: SavedWindowState | null = null;
let savedMiniViewState: { width: number; height: number; x?: number; y?: number } | null = null;

/**
 * Enter mini view mode
 * @param contentHeight The height of the content to fit
 * @param shouldCenter Whether to center the window (default: false)
 */
export const enterMiniMode = async (contentHeight?: number, shouldCenter: boolean = false) => {
    if (!isTauri()) return;
    try {
        const win = getCurrentWindow();

        // 1. Save Full View state before entering Mini View
        try {
            const isMax = await win.isMaximized();
            const size = await win.outerSize();
            const pos = await win.outerPosition();
            if (size.width >= 400 && size.height >= 300) {
                savedFullViewState = {
                    width: size.width,
                    height: size.height,
                    x: pos.x,
                    y: pos.y,
                    isMaximized: isMax,
                };
            }
            if (isMax) {
                await win.unmaximize();
            }
        } catch (e) {
            console.warn('Could not record full view state before mini mode:', e);
        }

        // 2. Hide window decorations first
        try {
            await win.setDecorations(false);
        } catch (e) {
            console.warn('setDecorations failed:', e);
        }

        // 3. Allow micro and compact dimensions: minimum 110px width, 52px height
        try {
            await win.setMinSize(new LogicalSize(110, 52));
        } catch (e) {
            console.warn('setMinSize failed:', e);
        }

        // 4. Set target dimensions (restore previously chosen mini view size if user resized)
        try {
            if (savedMiniViewState && savedMiniViewState.width > 0 && savedMiniViewState.height > 0) {
                await win.setSize(new PhysicalSize(savedMiniViewState.width, savedMiniViewState.height));
                if (savedMiniViewState.x !== undefined && savedMiniViewState.y !== undefined) {
                    await win.setPosition(new PhysicalPosition(savedMiniViewState.x, savedMiniViewState.y));
                }
            } else {
                const safeHeight = contentHeight 
                    ? Math.min(Math.max(contentHeight + 16, 220), 380)
                    : 320;
                await win.setSize(new LogicalSize(320, safeHeight));
                if (shouldCenter) {
                    await win.center();
                }
            }
        } catch (e) {
            console.warn('setSize failed:', e);
        }

        // 5. Mini view MUST default to always-on-top so it never hides behind other applications
        try {
            await win.setAlwaysOnTop(true);
        } catch (e) {
            console.warn('setAlwaysOnTop failed:', e);
        }

        // Enable window shadow & freeform resizing
        try {
            await win.setShadow(true);
            await win.setResizable(true);
        } catch (e) {}

    } catch (error) {
        console.error('Failed to enter mini mode:', error);
    }
};

/**
 * Exit mini view mode and restore previous window state
 */
export const exitMiniMode = async () => {
    if (!isTauri()) return;
    try {
        const win = getCurrentWindow();

        // Save current Mini View dimensions for next time
        try {
            const currentSize = await win.outerSize();
            const currentPos = await win.outerPosition();
            if (currentSize.width < 500 && currentSize.height < 500) {
                savedMiniViewState = {
                    width: currentSize.width,
                    height: currentSize.height,
                    x: currentPos.x,
                    y: currentPos.y,
                };
            }
        } catch (e) {}

        // 1. Remove always on top
        try {
            await win.setAlwaysOnTop(false);
        } catch (e) {}

        // 2. Restore window decorations (title bar)
        try {
            await win.setDecorations(true);
        } catch (e) {}

        // 3. Restore standard minimum dimensions for Full View
        try {
            await win.setMinSize(new LogicalSize(500, 400));
        } catch (e) {}

        // 4. Restore previous Full View size and position
        if (savedFullViewState) {
            if (savedFullViewState.isMaximized) {
                await win.maximize();
            } else {
                await win.setSize(new PhysicalSize(savedFullViewState.width, savedFullViewState.height));
                if (savedFullViewState.x !== undefined && savedFullViewState.y !== undefined) {
                    await win.setPosition(new PhysicalPosition(savedFullViewState.x, savedFullViewState.y));
                }
            }
        } else {
            await applyResponsiveFullViewSize();
        }

        // Re-enable resizing
        try {
            await win.setResizable(true);
        } catch (e) {}
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
        await win.setMinSize(new LogicalSize(500, 400));
        const size = await win.outerSize();
        // If window is suspiciously small (likely leftover from Mini View on restart), restore default size
        if (size.width < 500 || size.height < 400) {
            if (savedFullViewState) {
                if (savedFullViewState.isMaximized) {
                    await win.maximize();
                } else {
                    await win.setSize(new PhysicalSize(savedFullViewState.width, savedFullViewState.height));
                    if (savedFullViewState.x !== undefined && savedFullViewState.y !== undefined) {
                        await win.setPosition(new PhysicalPosition(savedFullViewState.x, savedFullViewState.y));
                    }
                }
            } else {
                await applyResponsiveFullViewSize();
            }
        }
        // Always enforce standard window properties for Full View
        await win.setDecorations(true);
        await win.setResizable(true);
        await win.setAlwaysOnTop(false);
    } catch (error) {
        console.error('Failed to ensure full view state:', error);
    }
};
