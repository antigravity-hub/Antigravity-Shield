import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { isTauri, isMac } from '../../utils/env';

export default function WindowControls() {
    const { t } = useTranslation();
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (!isTauri() || isMac()) return;

        let isMounted = true;
        const win = getCurrentWindow();

        // Check initial maximized state
        win.isMaximized().then((max) => {
            if (isMounted) setIsMaximized(max);
        }).catch(() => {});

        // Listen for window resize to sync maximized state
        let unlisten: (() => void) | null = null;
        win.onResized(async () => {
            try {
                const max = await win.isMaximized();
                if (isMounted) setIsMaximized(max);
            } catch {}
        }).then((fn) => {
            unlisten = fn;
        }).catch(() => {});

        return () => {
            isMounted = false;
            if (unlisten) unlisten();
        };
    }, []);

    if (!isTauri() || isMac()) {
        return null;
    }

    const win = getCurrentWindow();

    const handleMinimize = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await win.minimize();
        } catch (error) {
            console.error('Failed to minimize window:', error);
        }
    };

    const handleToggleMaximize = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await win.toggleMaximize();
            const max = await win.isMaximized();
            setIsMaximized(max);
        } catch (error) {
            console.error('Failed to toggle maximize window:', error);
        }
    };

    const handleClose = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await win.close();
        } catch (error) {
            console.error('Failed to close window:', error);
        }
    };

    return (
        <div
            className="fixed top-0 right-0 h-9 flex items-center z-[10000] select-none pointer-events-auto"
            data-no-drag="true"
        >
            {/* Minimize button */}
            <button
                type="button"
                onClick={handleMinimize}
                title={t('nav.window_minimize', 'Minimize')}
                className="w-12 h-9 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-white/10 active:bg-slate-300/60 dark:active:bg-white/15 transition-colors focus:outline-none"
            >
                <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none">
                    <line x1="1" y1="5.5" x2="9" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            </button>

            {/* Maximize / Restore button */}
            <button
                type="button"
                onClick={handleToggleMaximize}
                title={isMaximized ? t('nav.window_restore', 'Restore Down') : t('nav.window_maximize', 'Maximize')}
                className="w-12 h-9 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-white/10 active:bg-slate-300/60 dark:active:bg-white/15 transition-colors focus:outline-none"
            >
                {isMaximized ? (
                    /* Restore dual overlapping squares */
                    <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none">
                        <path d="M3 2.5H8V7.5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                        <rect x="1.5" y="3.5" width="5.5" height="5.5" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
                    </svg>
                ) : (
                    /* Maximize single square */
                    <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none">
                        <rect x="1.5" y="1.5" width="7" height="7" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
                    </svg>
                )}
            </button>

            {/* Close button (Windows red on hover) */}
            <button
                type="button"
                onClick={handleClose}
                title={t('nav.window_close', 'Close')}
                className="w-12 h-9 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-white dark:hover:text-white hover:bg-[#e81123] active:bg-[#c4101f] transition-colors focus:outline-none"
            >
                <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none">
                    <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            </button>
        </div>
    );
}
