import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { request as invoke } from '../utils/request';
import { copyToClipboard } from '../utils/clipboard';
import { CONTAINER_MAX_WIDTH } from '../constants/layout';
import {
    Activity,
    Users,
    BrainCircuit,
    Terminal,
    Settings,
    RefreshCw,
    X,
    QrCode,
    CheckCircle,
    Copy,
    Save,
    Trash2,
    Smartphone
} from 'lucide-react';
import { QRCode } from 'antd';
import { AppConfig, ProxyConfig, StickySessionConfig, CircuitBreakerConfig } from '../types/config';
import ModalDialog from '../components/common/ModalDialog';
import { showToast } from '../components/common/ToastContainer';
import { useProxyModels } from '../hooks/useProxyModels';
import { listAccounts } from '../services/accountService';
import { useConfigStore } from '../stores/useConfigStore';

import { ProxyOverviewTab } from '../components/proxy/ProxyOverviewTab';
import { ProxyAccountsTab } from '../components/proxy/ProxyAccountsTab';
import { ProxyRoutingTab } from '../components/proxy/ProxyRoutingTab';
import { ProxyDiagnosticsHUD } from '../components/proxy/ProxyDiagnosticsHUD';
import { ProxySettingsTab } from '../components/proxy/ProxySettingsTab';

interface ProxyStatus {
    running: boolean;
    port: number;
    base_url: string;
    active_accounts: number;
}

interface CustomPreset {
    id: string;
    name: string;
    description: string;
    mappings: Record<string, string>;
}

export default function ApiProxy() {
    const { t } = useTranslation();
    const { models } = useProxyModels();

    // Active Navigation Tab
    const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'routing' | 'diagnostics' | 'settings'>('overview');

    // Gateway Service Status
    const [status, setStatus] = useState<ProxyStatus>({
        running: false,
        port: 0,
        base_url: '',
        active_accounts: 0,
    });

    const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    // Protocol & Model Selection for Code Generator
    const [selectedProtocol, setSelectedProtocol] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
    const [selectedModelId, setSelectedModelId] = useState('gemini-3-flash');

    // API Key & Admin Password Editing States
    const [isEditingApiKey, setIsEditingApiKey] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const [isEditingAdminPassword, setIsEditingAdminPassword] = useState(false);
    const [tempAdminPassword, setTempAdminPassword] = useState('');

    // Presets Management
    const [selectedPreset, setSelectedPreset] = useState<string>('default');
    const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
    const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    // Confirmation Modals
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [isRegenerateKeyConfirmOpen, setIsRegenerateKeyConfirmOpen] = useState(false);
    const [isClearBindingsConfirmOpen, setIsClearBindingsConfirmOpen] = useState(false);
    const [isClearRateLimitsConfirmOpen, setIsClearRateLimitsConfirmOpen] = useState(false);

    // Fixed Account Mode
    const [preferredAccountId, setPreferredAccountId] = useState<string | null>(null);
    const [availableAccounts, setAvailableAccounts] = useState<Array<{ id: string; email: string }>>([]);

    // Cloudflared Public Egress Tunnel
    const [cfStatus, setCfStatus] = useState<{ installed: boolean; version?: string; running: boolean; url?: string; error?: string }>({
        installed: false,
        running: false,
    });
    const [cfLoading, setCfLoading] = useState(false);
    const [cfMode, setCfMode] = useState<'quick' | 'auth'>('quick');
    const [cfToken, setCfToken] = useState('');
    const [cfUseHttp2, setCfUseHttp2] = useState(true);
    const [isMobileQrOpen, setIsMobileQrOpen] = useState(false);

    const mobilePairingUrl = useMemo(() => {
        if (!cfStatus.url || !appConfig?.proxy?.api_key) return '';
        return `${cfStatus.url}/mobile-view?token=${encodeURIComponent(appConfig.proxy.api_key)}`;
    }, [cfStatus.url, appConfig?.proxy?.api_key]);

    // Lifecycle Polling
    useEffect(() => {
        loadConfig();
        loadStatus();
        loadAccounts();
        loadPreferredAccount();
        loadCfStatus();
        loadCustomPresets();
        const interval = setInterval(loadStatus, 3000);
        const cfInterval = setInterval(loadCfStatus, 5000);
        return () => {
            clearInterval(interval);
            clearInterval(cfInterval);
        };
    }, []);

    // Load available accounts
    const loadAccounts = async () => {
        try {
            const accounts = await listAccounts();
            setAvailableAccounts(accounts.map((a) => ({ id: a.id, email: a.email })));
        } catch (error) {
            console.error('Failed to load accounts in ApiProxy:', error);
        }
    };

    // Cloudflared Status Check
    const loadCfStatus = async () => {
        try {
            const res = await invoke<typeof cfStatus>('cloudflared_get_status');
            setCfStatus(res);
        } catch {
            // Ignore if manager is not yet initialized
        }
    };

    // Cloudflared Install
    const handleCfInstall = async () => {
        setCfLoading(true);
        try {
            const res = await invoke<typeof cfStatus>('cloudflared_install');
            setCfStatus(res);
            showToast(t('proxy.cloudflared.install_success', { defaultValue: 'Cloudflared installed successfully' }), 'success');
        } catch (error) {
            console.error('Cloudflared install error:', error);
            showToast(String(error), 'error');
        } finally {
            setCfLoading(false);
        }
    };

    // Cloudflared Start/Stop
    const handleCfToggle = async (enable: boolean) => {
        if (enable && !status.running) {
            showToast(
                t('proxy.cloudflared.require_proxy_running', { defaultValue: 'Please start the local proxy service first' }),
                'warning'
            );
            return;
        }
        setCfLoading(true);
        try {
            if (enable) {
                if (!cfStatus.installed) {
                    const installStatus = await invoke<typeof cfStatus>('cloudflared_install');
                    setCfStatus(installStatus);
                    if (!installStatus.installed) {
                        throw new Error('Cloudflared install failed');
                    }
                }

                const config = {
                    enabled: true,
                    mode: cfMode,
                    port: appConfig?.proxy?.port || 8045,
                    token: cfMode === 'auth' ? cfToken : null,
                    use_http2: cfUseHttp2,
                };
                const res = await invoke<typeof cfStatus>('cloudflared_start', { config });
                setCfStatus(res);
                showToast(t('proxy.cloudflared.started', { defaultValue: 'Tunnel started' }), 'success');

                if (appConfig) {
                    const newConfig = {
                        ...appConfig,
                        cloudflared: {
                            ...appConfig.cloudflared,
                            enabled: true,
                            mode: cfMode,
                            token: cfToken,
                            use_http2: cfUseHttp2,
                            port: appConfig?.proxy?.port || 8045,
                        },
                    };
                    saveConfig(newConfig);
                }
            } else {
                const res = await invoke<typeof cfStatus>('cloudflared_stop');
                setCfStatus(res);
                showToast(t('proxy.cloudflared.stopped', { defaultValue: 'Tunnel stopped' }), 'success');

                if (appConfig) {
                    const newConfig = {
                        ...appConfig,
                        cloudflared: {
                            ...appConfig.cloudflared,
                            enabled: false,
                        },
                    };
                    saveConfig(newConfig);
                }
            }
        } catch (error) {
            console.error('Cloudflared toggle error:', error);
            showToast(String(error), 'error');
        } finally {
            setCfLoading(false);
        }
    };

    const handleCfCopyUrl = async () => {
        if (!cfStatus.url) return;
        const success = await copyToClipboard(cfStatus.url);
        if (success) {
            setCopied('cf-url');
            setTimeout(() => setCopied(null), 2000);
            showToast(t('common.copied', { defaultValue: 'Copied to clipboard' }), 'success');
        }
    };

    // Load preferred account
    const loadPreferredAccount = async () => {
        try {
            const prefId = await invoke<string | null>('get_preferred_account');
            setPreferredAccountId(prefId);
        } catch (error) {
            console.error('Failed to load preferred account:', error);
        }
    };

    const handleSetPreferredAccount = async (accountId: string | null) => {
        try {
            await invoke('set_preferred_account', { accountId });
            setPreferredAccountId(accountId);
            const account = availableAccounts.find((a) => a.id === accountId);
            showToast(
                accountId
                    ? t('proxy.fixed_account.enabled', { email: account?.email || accountId })
                    : t('proxy.fixed_account.disabled'),
                'success'
            );
        } catch (error) {
            console.error('Failed to set preferred account:', error);
            showToast(String(error), 'error');
        }
    };

    // Load app configuration
    const loadConfig = async () => {
        try {
            setConfigLoading(true);
            setConfigError(null);
            const config = await invoke<AppConfig>('load_config');
            const defaultProxy = {
                enabled: true,
                port: 8045,
                api_key: 'sk-88d0a0c262754391bf7c1cc589d10cb2',
                auto_start: true,
                request_timeout: 120,
                enable_logging: true,
                auth_mode: 'auto' as const,
                upstream_proxy: { enabled: true, url: 'socks5://127.0.0.1:10808' },
                custom_mapping: {},
                scheduling: {
                    mode: 'round_robin',
                    session_ttl_minutes: 30,
                    retry_delays_ms: [1000, 2000, 4000],
                    max_retries: 3,
                    cooldown_period_seconds: 60,
                    sticky_sessions: true,
                },
            };
            const safeProxy = Object.assign({}, defaultProxy, config?.proxy || {});
            if (!safeProxy.port) safeProxy.port = 8045;
            if (!safeProxy.api_key) safeProxy.api_key = 'sk-88d0a0c262754391bf7c1cc589d10cb2';
            const safeConfig: AppConfig = {
                ...config,
                proxy: safeProxy as any,
            };
            setAppConfig(safeConfig);
            setTempApiKey(safeProxy.api_key || '');
            setTempAdminPassword(safeConfig.proxy.admin_password || '');
            if (safeConfig.cloudflared) {
                setCfMode(safeConfig.cloudflared.mode || 'quick');
                setCfToken(safeConfig.cloudflared.token || '');
                setCfUseHttp2(safeConfig.cloudflared.use_http2 ?? true);
            }
        } catch (error) {
            console.error('Failed to load proxy config from backend, applying resilient fallback:', error);
            const storeConfig = useConfigStore.getState().config;
            if (storeConfig) {
                setAppConfig(storeConfig);
                setTempApiKey(storeConfig.proxy.api_key || '');
                setTempAdminPassword(storeConfig.proxy.admin_password || '');
            } else {
                const fallback: AppConfig = {
                    language: 'en',
                    theme: 'dark',
                    auto_refresh: false,
                    refresh_interval: 10,
                    auto_sync: false,
                    sync_interval: 5,
                    auto_switch_on_quota: true,
                    auto_switch_threshold_percentage: 5,
                    auto_launch: true,
                    navigation_layout: 'sidebar',
                    accent_color: 'seafoam',
                    scheduled_warmup: { enabled: false, monitored_models: [] },
                    quota_protection: { enabled: false, threshold_percentage: 5, monitored_models: [] },
                    pinned_quota_models: { models: [] },
                    circuit_breaker: { enabled: true, backoff_steps: [5, 15, 30, 60] },
                    cloudflared: { enabled: false, mode: 'quick', port: 8045, use_http2: true },
                    proxy: {
                        enabled: true,
                        port: 8045,
                        api_key: 'sk-antigravity-shield',
                        auto_start: false,
                        request_timeout: 120,
                        enable_logging: true,
                        auth_mode: 'all_except_health',
                        upstream_proxy: { enabled: false, url: '' },
                    },
                };
                setAppConfig(fallback);
                setTempApiKey(fallback.proxy.api_key || '');
                setTempAdminPassword(fallback.proxy.admin_password || '');
            }
        } finally {
            setConfigLoading(false);
        }
    };

    // Load proxy status
    const loadStatus = async () => {
        try {
            const s = await invoke<ProxyStatus>('get_proxy_status');
            setStatus(s);
        } catch (error) {
            console.error('Failed to load proxy status:', error);
            setStatus({
                running: false,
                port: 0,
                base_url: '',
                active_accounts: 0,
            });
        }
    };

    // Save app configuration
    const saveConfig = async (newConfig: AppConfig) => {
        try {
            await invoke('save_config', { config: newConfig });
            setAppConfig(newConfig);
            showToast(t('common.save_success'), 'success');
        } catch (error) {
            console.error('Failed to save config:', error);
            showToast(String(error), 'error');
        }
    };

    // Update proxy subconfig
    const updateProxyConfig = (updates: Partial<ProxyConfig>) => {
        if (!appConfig) return;
        const newConfig = {
            ...appConfig,
            proxy: {
                ...(appConfig.proxy || {}),
                ...updates,
            },
        };
        saveConfig(newConfig);
    };

    // Update scheduling configuration
    const updateSchedulingConfig = (updates: Partial<StickySessionConfig>) => {
        if (!appConfig) return;
        const currentScheduling = appConfig.proxy?.scheduling || {
            mode: 'Balance',
            max_wait_seconds: 30,
            enable_dynamic_switch: true,
            enable_session_sticky: true,
            session_timeout_minutes: 30,
        };
        const newScheduling = { ...currentScheduling, ...updates };
        const newAppConfig = {
            ...appConfig,
            proxy: {
                ...(appConfig.proxy || {}),
                scheduling: newScheduling,
            },
        };
        saveConfig(newAppConfig);
    };

    // Update circuit breaker configuration
    const updateCircuitBreakerConfig = (newBreakerConfig: CircuitBreakerConfig) => {
        if (!appConfig) return;
        const newConfig = {
            ...appConfig,
            circuit_breaker: newBreakerConfig,
        };
        saveConfig(newConfig);
    };

    // Custom model mapping updates
    const handleUpdateCustomMapping = (key: string, value: string) => {
        if (!appConfig) return;
        const currentMapping = appConfig.proxy?.custom_mapping || {};
        const newCustom = { ...currentMapping, [key]: value };
        updateProxyConfig({ custom_mapping: newCustom });
    };

    const handleRemoveCustomMapping = (key: string) => {
        if (!appConfig) return;
        const newCustom = { ...(appConfig.proxy?.custom_mapping || {}) };
        delete newCustom[key];
        updateProxyConfig({ custom_mapping: newCustom });
    };

    const executeResetMapping = async () => {
        if (!appConfig) return;
        setIsResetConfirmOpen(false);
        const newConfig = {
            ...appConfig,
            proxy: {
                ...(appConfig.proxy || {}),
                custom_mapping: {},
            },
        };
        await saveConfig(newConfig);
        showToast(t('proxy.router.reset_success'), 'success');
    };

    // Presets definitions
    const defaultPresets = useMemo<CustomPreset[]>(
        () => [
            {
                id: 'default',
                name: t('proxy.router.preset_default', { defaultValue: 'Default' }),
                description: t('proxy.router.preset_default_desc', { defaultValue: 'Balanced models with standard latency' }),
                mappings: {
                    'gpt-4*': 'gemini-3.1-pro-high',
                    'gpt-4o*': 'gemini-3-flash',
                    'gpt-3.5*': 'gemini-2.5-flash',
                    'o1-*': 'gemini-3.1-pro-high',
                    'o3-*': 'gemini-3.1-pro-high',
                    'claude-3-5-sonnet-*': 'claude-sonnet-4-6',
                    'claude-3-opus-*': 'claude-opus-4-6-thinking',
                    'claude-opus-4-6*': 'claude-opus-4-6-thinking',
                    'claude-haiku-*': 'gemini-2.5-flash',
                    'claude-3-haiku-*': 'gemini-2.5-flash',
                } as Record<string, string>,
            },
            {
                id: 'performance',
                name: t('proxy.router.preset_performance', { defaultValue: 'High Performance' }),
                description: t('proxy.router.preset_performance_desc', { defaultValue: 'Directs heavy prompts to reasoning models' }),
                mappings: {
                    'gpt-4*': 'claude-opus-4-6-thinking',
                    'gpt-4o*': 'claude-sonnet-4-6',
                    'gpt-3.5*': 'gemini-3-flash',
                    'o1-*': 'claude-opus-4-6-thinking',
                    'o3-*': 'claude-opus-4-6-thinking',
                    'claude-3-5-sonnet-*': 'claude-sonnet-4-6',
                    'claude-3-opus-*': 'claude-opus-4-6-thinking',
                    'claude-opus-4-6*': 'claude-opus-4-6-thinking',
                    'claude-haiku-*': 'claude-sonnet-4-6',
                    'claude-3-haiku-*': 'claude-sonnet-4-6',
                } as Record<string, string>,
            },
            {
                id: 'cost-effective',
                name: t('proxy.router.preset_cost', { defaultValue: 'Cost Effective / High Speed' }),
                description: t('proxy.router.preset_cost_desc', { defaultValue: 'Routes everything to Flash models for speed' }),
                mappings: {
                    'gpt-4*': 'gemini-3-flash',
                    'gpt-4o*': 'gemini-2.5-flash',
                    'gpt-3.5*': 'gemini-2.5-flash',
                    'o1-*': 'gemini-3-flash',
                    'o3-*': 'gemini-3-flash',
                    'claude-3-5-sonnet-*': 'gemini-3-flash',
                    'claude-3-opus-*': 'gemini-3-flash',
                    'claude-opus-4-*': 'gemini-3-flash',
                    'claude-haiku-*': 'gemini-2.5-flash',
                    'claude-3-haiku-*': 'gemini-2.5-flash',
                } as Record<string, string>,
            },
        ],
        [t]
    );

    const presetOptions = useMemo(() => {
        return [...defaultPresets, ...customPresets];
    }, [defaultPresets, customPresets]);

    const loadCustomPresets = () => {
        try {
            const saved = localStorage.getItem('antigravity_custom_presets');
            if (saved) {
                setCustomPresets(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to parse custom presets from localStorage:', e);
        }
    };

    const handleSaveCurrentAsPreset = () => {
        if (!newPresetName.trim() || !appConfig) return;
        const newPreset: CustomPreset = {
            id: `custom_${Date.now()}`,
            name: newPresetName.trim(),
            description: t('proxy.router.custom_preset_desc', { defaultValue: 'Custom preset' }),
            mappings: { ...(appConfig.proxy?.custom_mapping || {}) },
        };
        const updatedPresets = [...customPresets, newPreset];
        setCustomPresets(updatedPresets);
        localStorage.setItem('antigravity_custom_presets', JSON.stringify(updatedPresets));
        setNewPresetName('');
        setSelectedPreset(newPreset.id);
        showToast(t('proxy.router.preset_saved'), 'success');
    };

    const handleDeletePreset = (id: string) => {
        const updatedPresets = customPresets.filter((p) => p.id !== id);
        setCustomPresets(updatedPresets);
        localStorage.setItem('antigravity_custom_presets', JSON.stringify(updatedPresets));
        if (selectedPreset === id) {
            setSelectedPreset('default');
        }
        showToast(t('common.delete_success'), 'success');
    };

    const handleApplyPresets = async () => {
        if (!appConfig) return;
        const selectedPresetData = presetOptions.find((p) => p.id === selectedPreset);
        if (!selectedPresetData) return;

        const newConfig = {
            ...appConfig,
            proxy: {
                ...(appConfig.proxy || {}),
                custom_mapping: { ...selectedPresetData.mappings },
            },
        };
        await saveConfig(newConfig);
        showToast(t('proxy.router.preset_applied', { name: selectedPresetData.name }), 'success');
    };

    // Clear session bindings
    const executeClearSessionBindings = async () => {
        setIsClearBindingsConfirmOpen(false);
        try {
            await invoke('clear_session_bindings');
            showToast(t('proxy.config.scheduling.clear_bindings_success'), 'success');
        } catch (error) {
            console.error('Failed to clear session bindings:', error);
            showToast(String(error), 'error');
        }
    };

    // Clear rate limits
    const executeClearRateLimits = async () => {
        setIsClearRateLimitsConfirmOpen(false);
        try {
            await invoke('clear_rate_limits');
            showToast(t('proxy.config.scheduling.clear_rate_limits_success'), 'success');
        } catch (error) {
            console.error('Failed to clear rate limits:', error);
            showToast(String(error), 'error');
        }
    };

    // Toggle Proxy Service (Start/Stop)
    const handleToggle = async () => {
        if (!appConfig) return;
        setLoading(true);
        try {
            if (status.running) {
                await invoke('stop_proxy');
                showToast(t('proxy.status.stopped'), 'info');
            } else {
                await invoke('start_proxy', { config: appConfig?.proxy || {} });
                showToast(t('proxy.status.started'), 'success');
            }
            await loadStatus();
        } catch (error) {
            console.error('Failed to toggle proxy:', error);
            showToast(String(error), 'error');
        } finally {
            setLoading(false);
        }
    };

    // API Key Regeneration
    const executeGenerateApiKey = async () => {
        setIsRegenerateKeyConfirmOpen(false);
        try {
            const newKey = await invoke<string>('generate_api_key');
            updateProxyConfig({ api_key: newKey });
            setTempApiKey(newKey);
            showToast(t('proxy.config.api_key_generated'), 'success');
        } catch (error) {
            console.error('Failed to generate API key:', error);
            showToast(String(error), 'error');
        }
    };

    const copyToClipboardHandler = async (text: string, label: string) => {
        const success = await copyToClipboard(text);
        if (success) {
            setCopied(label);
            setTimeout(() => setCopied(null), 2000);
            showToast(t('common.copied'), 'success');
        }
    };

    // API Key Edit Handlers
    const handleEditApiKey = () => {
        setTempApiKey(appConfig?.proxy?.api_key || '');
        setIsEditingApiKey(true);
    };

    const handleSaveApiKey = () => {
        updateProxyConfig({ api_key: tempApiKey.trim() });
        setIsEditingApiKey(false);
        showToast(t('common.save_success'), 'success');
    };

    const handleCancelEditApiKey = () => {
        setTempApiKey(appConfig?.proxy?.api_key || '');
        setIsEditingApiKey(false);
    };

    // Admin Password Edit Handlers
    const handleEditAdminPassword = () => {
        setTempAdminPassword(appConfig?.proxy?.admin_password || '');
        setIsEditingAdminPassword(true);
    };

    const handleSaveAdminPassword = () => {
        updateProxyConfig({ admin_password: tempAdminPassword.trim() });
        setIsEditingAdminPassword(false);
        showToast(t('common.save_success'), 'success');
    };

    const handleCancelEditAdminPassword = () => {
        setTempAdminPassword(appConfig?.proxy?.admin_password || '');
        setIsEditingAdminPassword(false);
    };

    // Python Integration Snippet Generator
    const getPythonExample = (modelId: string) => {
        const port = status.running ? status.port : (appConfig?.proxy?.port || 8045);
        const baseUrl = `http://127.0.0.1:${port}/v1`;
        const apiKey = appConfig?.proxy?.api_key || 'YOUR_API_KEY';

        if (selectedProtocol === 'anthropic') {
            return `from anthropic import Anthropic

client = Anthropic(
    base_url="${`http://127.0.0.1:${port}`}",
    api_key="${apiKey}"
)

response = client.messages.create(
    model="${modelId}",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.content[0].text)`;
        }

        if (selectedProtocol === 'gemini') {
            const rawBaseUrl = `http://127.0.0.1:${port}`;
            return `# Requires: pip install google-generativeai
import google.generativeai as genai

genai.configure(
    api_key="${apiKey}",
    transport='rest',
    client_options={'api_endpoint': '${rawBaseUrl}'}
)

model = genai.GenerativeModel('${modelId}')
response = model.generate_content("Hello")
print(response.text)`;
        }

        return `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)`;
    };

    const TABS = [
        { id: 'overview', label: t('proxy.tabs.overview', { defaultValue: 'Overview & Status' }), icon: Activity },
        { id: 'accounts', label: t('proxy.tabs.accounts', { defaultValue: 'Accounts & Quotas' }), icon: Users },
        { id: 'routing', label: t('proxy.tabs.routing', { defaultValue: 'Routing & Aliases' }), icon: BrainCircuit },
        { id: 'diagnostics', label: t('proxy.tabs.diagnostics', { defaultValue: 'Diagnostics HUD' }), icon: Terminal },
        { id: 'settings', label: t('proxy.tabs.settings', { defaultValue: 'Settings & Network' }), icon: Settings },
    ];

    return (
        <div className="h-full w-full overflow-y-auto overflow-x-hidden rtl:text-right">
            <div className={`p-5 space-y-5 ${CONTAINER_MAX_WIDTH}`}>
                {/* Header & Segmented Pill Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-slate-800/80">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
                            <Activity size={22} style={{ color: 'var(--color-accent)' }} />
                            <span>{t('proxy.header.title', { defaultValue: 'Antigravity Shield API Proxy' })}</span>
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 pt-0.5">
                            Local High-Performance AI Gateway with Zero-Leak Telemetry &amp; Universal Protocol Mapping
                        </p>
                    </div>

                    {/* Segmented Pill Tabs */}
                    <div className="bg-gray-100/80 dark:bg-[#0c100e]/80 p-1 rounded-2xl border border-gray-200/50 dark:border-slate-800/80 flex items-center gap-1 backdrop-blur-md overflow-x-auto">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                                        isActive
                                            ? 'text-white shadow-xs'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-[#141916]'
                                    }`}
                                    style={isActive ? { backgroundColor: 'var(--color-primary-btn)' } : undefined}
                                >
                                    <Icon size={14} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Loading State */}
                {configLoading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4">
                            <RefreshCw size={30} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {t('common.loading', { defaultValue: 'Loading gateway configuration...' })}
                            </span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {!configLoading && configError && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4 text-center max-w-md">
                            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-500">
                                <Settings size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                                    {t('proxy.error.load_failed', { defaultValue: 'Failed to load gateway configuration' })}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {configError}
                                </p>
                            </div>
                            <button
                                onClick={loadConfig}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity flex items-center gap-1.5 shadow-sm"
                                style={{ backgroundColor: 'var(--color-primary-btn)' }}
                            >
                                <RefreshCw size={14} />
                                <span>{t('common.retry', { defaultValue: 'Retry' })}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab Views */}
                {!configLoading && !configError && appConfig && (
                    <div className="space-y-5">
                        {activeTab === 'overview' && (
                            <ProxyOverviewTab
                                status={status}
                                appConfig={appConfig}
                                loading={loading}
                                onToggle={handleToggle}
                                copied={copied}
                                onCopy={copyToClipboardHandler}
                                onSelectTab={(tabId) => setActiveTab(tabId as any)}
                            />
                        )}

                        {activeTab === 'accounts' && (
                            <ProxyAccountsTab
                                availableAccounts={availableAccounts}
                                preferredAccountId={preferredAccountId}
                                onSetPreferredAccount={handleSetPreferredAccount}
                                onClearRateLimits={() => setIsClearRateLimitsConfirmOpen(true)}
                                onClearSessionBindings={() => setIsClearBindingsConfirmOpen(true)}
                                appConfig={appConfig}
                                onUpdateScheduling={updateSchedulingConfig}
                                onUpdateProxyConfig={updateProxyConfig}
                            />
                        )}

                        {activeTab === 'routing' && (
                            <ProxyRoutingTab
                                appConfig={appConfig}
                                models={models}
                                selectedPreset={selectedPreset}
                                presetOptions={presetOptions}
                                customPresets={customPresets}
                                onSelectPreset={setSelectedPreset}
                                onApplyPreset={handleApplyPresets}
                                onOpenPresetManager={() => setIsPresetManagerOpen(true)}
                                onResetMapping={() => setIsResetConfirmOpen(true)}
                                onUpdateCustomMapping={handleUpdateCustomMapping}
                                onRemoveCustomMapping={handleRemoveCustomMapping}
                                onUpdateProxyConfig={updateProxyConfig}
                                selectedProtocol={selectedProtocol}
                                onSelectProtocol={setSelectedProtocol}
                                selectedModelId={selectedModelId}
                                onSelectModelId={setSelectedModelId}
                                getPythonExample={getPythonExample}
                                copied={copied}
                                onCopy={copyToClipboardHandler}
                            />
                        )}

                        {activeTab === 'diagnostics' && (
                            <ProxyDiagnosticsHUD
                                status={status}
                                appConfig={appConfig}
                                models={models}
                            />
                        )}

                        {activeTab === 'settings' && (
                            <ProxySettingsTab
                                appConfig={appConfig}
                                status={status}
                                onUpdateProxyConfig={updateProxyConfig}
                                onUpdateCircuitBreakerConfig={updateCircuitBreakerConfig}
                                isEditingApiKey={isEditingApiKey}
                                tempApiKey={tempApiKey}
                                setTempApiKey={setTempApiKey}
                                onEditApiKey={handleEditApiKey}
                                onSaveApiKey={handleSaveApiKey}
                                onCancelEditApiKey={handleCancelEditApiKey}
                                onGenerateApiKey={() => setIsRegenerateKeyConfirmOpen(true)}
                                isEditingAdminPassword={isEditingAdminPassword}
                                tempAdminPassword={tempAdminPassword}
                                setTempAdminPassword={setTempAdminPassword}
                                onEditAdminPassword={handleEditAdminPassword}
                                onSaveAdminPassword={handleSaveAdminPassword}
                                onCancelEditAdminPassword={handleCancelEditAdminPassword}
                                cfStatus={cfStatus}
                                cfLoading={cfLoading}
                                cfMode={cfMode}
                                setCfMode={setCfMode}
                                cfToken={cfToken}
                                setCfToken={setCfToken}
                                cfUseHttp2={cfUseHttp2}
                                setCfUseHttp2={setCfUseHttp2}
                                onCfInstall={handleCfInstall}
                                onCfToggle={handleCfToggle}
                                onCfCopyUrl={handleCfCopyUrl}
                                onOpenMobileQr={() => setIsMobileQrOpen(true)}
                                copied={copied}
                                onCopy={copyToClipboardHandler}
                            />
                        )}
                    </div>
                )}

                {/* Modals & Dialogs */}
                <ModalDialog
                    isOpen={isResetConfirmOpen}
                    title={t('proxy.dialog.reset_mapping_title', { defaultValue: 'Reset Mappings' })}
                    message={t('proxy.dialog.reset_mapping_msg', { defaultValue: 'Are you sure you want to reset all model mappings to system defaults?' })}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={executeResetMapping}
                    onCancel={() => setIsResetConfirmOpen(false)}
                />

                <ModalDialog
                    isOpen={isRegenerateKeyConfirmOpen}
                    title={t('proxy.dialog.regenerate_key_title', { defaultValue: 'Regenerate API Key' })}
                    message={t('proxy.dialog.regenerate_key_msg', { defaultValue: 'Are you sure you want to regenerate the API key? The old key will become invalid immediately.' })}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={executeGenerateApiKey}
                    onCancel={() => setIsRegenerateKeyConfirmOpen(false)}
                />

                <ModalDialog
                    isOpen={isClearBindingsConfirmOpen}
                    title={t('proxy.dialog.clear_bindings_title', { defaultValue: 'Clear Session Bindings' })}
                    message={t('proxy.dialog.clear_bindings_msg', { defaultValue: 'Are you sure you want to clear all session-to-account bindings?' })}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={executeClearSessionBindings}
                    onCancel={() => setIsClearBindingsConfirmOpen(false)}
                />

                <ModalDialog
                    isOpen={isClearRateLimitsConfirmOpen}
                    title={t('proxy.dialog.clear_rate_limits_title', { defaultValue: 'Clear Rate Limits' })}
                    message={t('proxy.dialog.clear_rate_limits_confirm', { defaultValue: 'Are you sure you want to clear all local rate limit records?' })}
                    type="confirm"
                    isDestructive={true}
                    onConfirm={executeClearRateLimits}
                    onCancel={() => setIsClearRateLimitsConfirmOpen(false)}
                />

                {/* Preset Manager Modal */}
                <ModalDialog
                    isOpen={isPresetManagerOpen}
                    title={t('proxy.router.manage_presets_title', { defaultValue: 'Preset Manager' })}
                    onConfirm={() => setIsPresetManagerOpen(false)}
                    confirmText={t('common.close', { defaultValue: 'Close' })}
                    type="info"
                >
                    <div className="space-y-5">
                        <div className="space-y-2 p-3 bg-gray-50/70 dark:bg-base-200/50 rounded-xl border border-gray-200/60 dark:border-base-300">
                            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <Save size={14} style={{ color: 'var(--color-accent)' }} />
                                {t('proxy.router.save_current_as_preset', { defaultValue: 'Save Current Configuration as Preset' })}
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    placeholder={t('proxy.router.preset_name_placeholder', { defaultValue: 'Preset Name' })}
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-base-200 bg-white dark:bg-base-100 text-xs"
                                />
                                <button
                                    onClick={handleSaveCurrentAsPreset}
                                    disabled={!newPresetName.trim()}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--color-primary-btn)' }}
                                >
                                    {t('common.save', { defaultValue: 'Save' })}
                                </button>
                            </div>
                        </div>

                        {/* Existing Custom Presets */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                Your Saved Presets
                            </h4>
                            <div className="max-h-[220px] overflow-y-auto space-y-1.5 pe-1">
                                {customPresets.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 dark:bg-base-200/50 rounded-xl border border-dashed border-gray-200 dark:border-base-300">
                                        No custom presets saved yet.
                                    </div>
                                ) : (
                                    customPresets.map((preset) => (
                                        <div
                                            key={preset.id}
                                            className="flex items-center justify-between p-2.5 bg-white dark:bg-base-100 border border-gray-200/70 dark:border-base-300 rounded-xl"
                                        >
                                            <div className="truncate">
                                                <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                                                    {preset.name}
                                                </div>
                                                <div className="text-[10px] text-gray-400">
                                                    {Object.keys(preset.mappings).length} rules mapped
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeletePreset(preset.id)}
                                                className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </ModalDialog>

                {/* Mobile QR Pairing Modal */}
                {isMobileQrOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                        <div className="bg-white dark:bg-base-100 border border-gray-200 dark:border-base-300 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
                            <div className="px-5 py-4 border-b border-gray-100 dark:border-base-200 flex items-center justify-between bg-gray-50/50 dark:bg-base-200/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center">
                                        <Smartphone size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-base-content">
                                            {t('proxy.cloudflared.mobile_modal_title', { defaultValue: 'Secure Mobile Pairing' })}
                                        </h3>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                            Zero-Trust End-to-End Pairing
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsMobileQrOpen(false)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-base-200 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-5 flex flex-col items-center gap-4">
                                <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                                    <QRCode value={mobilePairingUrl} size={210} bordered={false} />
                                </div>

                                <div className="bg-gray-50 dark:bg-base-200/50 border border-gray-200 dark:border-base-300 rounded-xl p-3 text-center space-y-1 w-full">
                                    <div className="flex items-center justify-center gap-1.5 text-gray-800 dark:text-gray-200 font-bold text-xs">
                                        <QrCode className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                                        <span>Direct Mobile Camera Scan</span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                        Scan this barcode with your phone camera to securely connect to the proxy without entering URLs or credentials.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 w-full">
                                    <button
                                        onClick={() => {
                                            copyToClipboardHandler(mobilePairingUrl, 'mobile-url-modal');
                                        }}
                                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-opacity flex items-center justify-center gap-1.5"
                                        style={{ backgroundColor: 'var(--color-primary-btn)' }}
                                    >
                                        {copied === 'mobile-url-modal' ? <CheckCircle size={14} /> : <Copy size={14} />}
                                        <span>Copy Link</span>
                                    </button>
                                    <button
                                        onClick={() => setIsMobileQrOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-base-300 hover:bg-gray-50 dark:hover:bg-base-200"
                                    >
                                        {t('common.close', { defaultValue: 'Close' })}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
