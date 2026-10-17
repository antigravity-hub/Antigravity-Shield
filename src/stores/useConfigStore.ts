import { create } from 'zustand';
import { AppConfig } from '../types/config';
import * as configService from '../services/configService';

interface ConfigState {
    config: AppConfig | null;
    loading: boolean;
    error: string | null;

    // Actions
    loadConfig: () => Promise<void>;
    saveConfig: (config: AppConfig, silent?: boolean) => Promise<void>;
    updateTheme: (theme: string) => Promise<void>;
    updateLanguage: (language: string) => Promise<void>;
    updateNavigationLayout: (layout: 'sidebar' | 'topbar') => Promise<void>;
    updateAccentColor: (accentColor: string) => Promise<void>;
    toggleShowAllQuotas: () => void;
    showAllQuotas: boolean;
    toggleAutoWarm: () => Promise<void>;
    toggleMenuItem: (path: string) => Promise<void>;
    isMenuItemHidden: (path: string) => boolean;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
    config: null,
    loading: false,
    error: null,
    showAllQuotas: localStorage.getItem('antigravity_show_all_quotas') === 'true',

    loadConfig: async () => {
        set({ loading: true, error: null });
        try {
            const config = await configService.loadConfig();
            if (config?.language) {
                try {
                    localStorage.setItem('i18nextLng', config.language);
                } catch {}
            }
            const v6Migrated = localStorage.getItem('antigravity_v6_migrated') === 'true';
            let savedLayout: 'sidebar' | 'topbar';
            let targetAutoLaunch = config?.auto_launch ?? true;

            if (!v6Migrated) {
                // Force v6 defaults: vertical sidebar and auto_launch enabled
                savedLayout = 'sidebar';
                targetAutoLaunch = true;
                try {
                    localStorage.setItem('antigravity_navigation_layout', 'sidebar');
                    localStorage.setItem('antigravity_v6_migrated', 'true');
                } catch {}

                // Trigger backend system startup toggle
                try {
                    const { isTauri } = await import('../utils/env');
                    if (isTauri()) {
                        const { invoke } = await import('@tauri-apps/api/core');
                        await invoke('toggle_auto_launch', { enable: true });
                    }
                } catch {}

                // Persist migrated config to disk
                const migratedConfig: AppConfig = {
                    ...config,
                    navigation_layout: 'sidebar' as const,
                    auto_launch: true,
                };
                configService.saveConfig(migratedConfig).catch(() => {});
            } else {
                savedLayout = (localStorage.getItem('antigravity_navigation_layout') as 'sidebar' | 'topbar') || config?.navigation_layout || 'sidebar';
            }

            const savedAccent = localStorage.getItem('antigravity_accent_color') || config?.accent_color || 'seafoam';
            set({
                config: {
                    ...config,
                    navigation_layout: savedLayout,
                    auto_launch: targetAutoLaunch,
                    accent_color: savedAccent,
                },
                loading: false,
            });
        } catch (error) {
            const fallback: AppConfig = {
                language: localStorage.getItem('i18nextLng') || 'en',
                theme: localStorage.getItem('app-theme-preference') || 'dark',
                auto_refresh: false,
                refresh_interval: 10,
                auto_sync: false,
                sync_interval: 5,
                auto_switch_on_quota: true,
                auto_switch_threshold_percentage: 5,
                auto_launch: true,
                navigation_layout: 'sidebar',
                accent_color: localStorage.getItem('antigravity_accent_color') || 'seafoam',
                proxy: {
                    enabled: false,
                    port: 8045,
                    api_key: '',
                    auto_start: false,
                    request_timeout: 120,
                    enable_logging: false,
                    upstream_proxy: { enabled: false, url: '' }
                },
                scheduled_warmup: { enabled: false, monitored_models: [] },
                quota_protection: { enabled: false, threshold_percentage: 10, monitored_models: [] },
                pinned_quota_models: { models: [] },
                circuit_breaker: { enabled: false, backoff_steps: [] },
                cloudflared: { enabled: false, mode: 'quick', port: 7860, use_http2: true },
                hidden_menu_items: []
            };
            set({ config: fallback, loading: false });
        }
    },

    saveConfig: async (config: AppConfig, silent: boolean = false) => {
        if (!silent) set({ loading: true, error: null });
        // Optimistic instant state update
        set({ config });
        if (config?.theme) {
            try {
                localStorage.setItem('app-theme-preference', config.theme);
            } catch {}
        }
        if (config?.language) {
            try {
                localStorage.setItem('i18nextLng', config.language);
            } catch {}
        }
        if (config?.navigation_layout) {
            try {
                localStorage.setItem('antigravity_navigation_layout', config.navigation_layout);
            } catch {}
        }
        try {
            await configService.saveConfig(config);
            set({ loading: false });
            const { isTauri } = await import('../utils/env');
            if (isTauri()) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('set_window_theme', { theme: config.theme }).catch(() => {
                });
            }
        } catch (error) {
            console.warn('[ConfigStore] Failed to persist config to backend:', error);
            set({ error: String(error), loading: false });
        }
    },

    updateNavigationLayout: async (layout: 'sidebar' | 'topbar') => {
        try {
            localStorage.setItem('antigravity_navigation_layout', layout);
        } catch {}
        const { config } = get();
        if (config) {
            const next = { ...config, navigation_layout: layout };
            set({ config: next });
            await get().saveConfig(next, true).catch(() => {});
        } else {
            set({
                config: {
                    navigation_layout: layout,
                } as any,
            });
        }
    },

    updateTheme: async (theme: string) => {
        try {
            localStorage.setItem('app-theme-preference', theme);
        } catch {}
        const { config } = get();
        if (!config) return;

        const newConfig = { ...config, theme };
        await get().saveConfig(newConfig, true);
    },

    updateAccentColor: async (accentColor: string) => {
        try {
            localStorage.setItem('antigravity_accent_color', accentColor);
        } catch {}
        const { config } = get();
        if (config) {
            const next = { ...config, accent_color: accentColor };
            set({ config: next });
            await get().saveConfig(next, true).catch(() => {});
        } else {
            set({
                config: {
                    accent_color: accentColor,
                } as any,
            });
        }
    },

    updateLanguage: async (language: string) => {
        try {
            localStorage.setItem('i18nextLng', language);
        } catch {}
        const { config } = get();
        if (!config) return;

        const newConfig = { ...config, language };
        await get().saveConfig(newConfig, true);
    },

    toggleShowAllQuotas: () => {
        const current = get().showAllQuotas;
        const next = !current;
        localStorage.setItem('antigravity_show_all_quotas', String(next));
        set({ showAllQuotas: next });
    },

    toggleAutoWarm: async () => {
        const { config } = get();
        if (!config) return;

        const currentWarmup = config.scheduled_warmup || {
            enabled: false,
            monitored_models: [
                'gemini-3-flash',
                'claude',
                'gemini-3-pro-high',
                'gemini-3.1-flash-image',
            ],
        };

        const nextEnabled = !currentWarmup.enabled;
        const newConfig = {
            ...config,
            scheduled_warmup: {
                ...currentWarmup,
                enabled: nextEnabled,
                monitored_models: currentWarmup.monitored_models?.length
                    ? currentWarmup.monitored_models
                    : [
                        'gemini-3-flash',
                        'claude',
                        'gemini-3-pro-high',
                        'gemini-3.1-flash-image',
                    ],
            },
        };

        await get().saveConfig(newConfig, true);
    },

    toggleMenuItem: async (path: string) => {
        const { config } = get();
        if (!config) return;

        const hiddenItems = config.hidden_menu_items || [];
        const isHidden = hiddenItems.includes(path);

        const newHiddenItems = isHidden
            ? hiddenItems.filter(item => item !== path)
            : [...hiddenItems, path];

        const newConfig = { ...config, hidden_menu_items: newHiddenItems };
        await get().saveConfig(newConfig, true);
    },

    isMenuItemHidden: (path: string) => {
        const { config } = get();
        if (!config) return false;
        return (config.hidden_menu_items || []).includes(path);
    },
}));
