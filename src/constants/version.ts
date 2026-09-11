import { useState, useEffect } from 'react';
import { isTauri } from '../utils/env';

/**
 * Global compile-time version injected by Vite from root package.json.
 * Single Source of Truth (SSoT) across the entire platform.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '5.5.0';

/**
 * Returns the current runtime application version.
 * In a native Tauri environment, queries Tauri's getVersion API.
 * In web preview or during startup, returns the compile-time APP_VERSION.
 */
export async function getAppVersion(): Promise<string> {
    if (isTauri()) {
        try {
            const { getVersion } = await import('@tauri-apps/api/app');
            const v = await getVersion();
            if (v) return v;
        } catch {
            // Fallback to SSoT constant
        }
    }
    return APP_VERSION;
}

/**
 * React hook to retrieve the current application version cleanly
 * without any hardcoded version strings or boilerplate useEffect.
 */
export function useAppVersion(): string {
    const [version, setVersion] = useState<string>(APP_VERSION);

    useEffect(() => {
        getAppVersion().then(v => {
            if (v && v !== version) {
                setVersion(v);
            }
        });
    }, [version]);

    return version;
}
