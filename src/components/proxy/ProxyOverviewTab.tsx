import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Power,
    CheckCircle,
    Copy,
    Activity,
    Layers,
    Terminal,
    ArrowUpRight,
    Zap,
    Cpu,
    Check
} from 'lucide-react';
import { AppConfig } from '../../types/config';

interface ProxyStatus {
    running: boolean;
    port: number;
    base_url: string;
    active_accounts: number;
}

interface ProxyOverviewTabProps {
    status: ProxyStatus;
    appConfig: AppConfig;
    loading: boolean;
    onToggle: () => void;
    copied: string | null;
    onCopy: (text: string, label: string) => void;
    onSelectTab: (tabId: string) => void;
}

export const ProxyOverviewTab: React.FC<ProxyOverviewTabProps> = ({
    status,
    appConfig,
    loading,
    onToggle,
    copied,
    onCopy,
    onSelectTab,
}) => {
    const { t } = useTranslation();
    const port = status.running ? status.port : (appConfig.proxy.port || 8045);
    const baseUrl = `http://127.0.0.1:${port}`;
    const apiKey = appConfig.proxy.api_key || 'YOUR_API_KEY';

    const endpoints = [
        {
            protocol: 'OpenAI Compatibility',
            path: '/v1/chat/completions',
            url: `${baseUrl}/v1/chat/completions`,
            desc: 'For Cursor, Windsurf, LangChain, OpenAI Python/TS SDK',
            badge: 'OpenAI v1',
        },
        {
            protocol: 'Anthropic Claude Protocol',
            path: '/v1/messages',
            url: `${baseUrl}/v1/messages`,
            desc: 'For Claude Code CLI, Anthropic SDK with thinking tokens',
            badge: 'Claude 3.7/3.5',
        },
        {
            protocol: 'Models Directory',
            path: '/v1/models',
            url: `${baseUrl}/v1/models`,
            desc: 'Dynamic catalog reflecting upstream quota and aliases',
            badge: 'GET Catalog',
        },
    ];

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Top Bento Hero: Gateway Status & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Gateway Card */}
                <div className="lg:col-span-2 bg-white dark:bg-base-200/60 rounded-2xl p-6 border border-gray-100 dark:border-base-300 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Antigravity Shield Gateway
                                </span>
                                <span
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                    style={{
                                        backgroundColor: 'var(--color-badge-bg)',
                                        color: 'var(--color-badge-text)',
                                        borderColor: 'var(--color-badge-border)',
                                    }}
                                >
                                    v6.1 Native
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-base-content flex items-center gap-3">
                                {status.running ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                                        {t('proxy.status.running', { defaultValue: 'Service Active' })}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full bg-gray-400" />
                                        {t('proxy.status.stopped', { defaultValue: 'Service Idle' })}
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md pt-1">
                                {status.running
                                    ? `Listening on port ${port}. Multi-account tiered rotation and sub-50ms cooldown active.`
                                    : 'Start the proxy service to enable downstream connections from Cursor, Claude Code, and Windsurf.'}
                            </p>
                        </div>

                        {/* Power Toggle Button */}
                        <button
                            onClick={onToggle}
                            disabled={loading}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-sm ${
                                status.running
                                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50'
                                    : 'text-white hover:opacity-95'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={!status.running ? { backgroundColor: 'var(--color-primary-btn)' } : undefined}
                        >
                            <Power size={15} />
                            <span>
                                {loading
                                    ? t('proxy.status.processing', { defaultValue: 'Processing...' })
                                    : status.running
                                    ? t('proxy.action.stop', { defaultValue: 'Stop Gateway' })
                                    : t('proxy.action.start', { defaultValue: 'Start Gateway' })}
                            </span>
                        </button>
                    </div>

                    {/* Port & Address Bar */}
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-base-300 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-mono bg-gray-50 dark:bg-base-100 px-3 py-1.5 rounded-lg border border-gray-200/60 dark:border-base-300">
                            <span className="text-gray-400">Endpoint:</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{baseUrl}</span>
                            <button
                                onClick={() => onCopy(baseUrl, 'base-url')}
                                className="ps-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                title={t('common.copy')}
                            >
                                {copied === 'base-url' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onSelectTab('diagnostics')}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-base-300 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors flex items-center gap-1.5 text-gray-700 dark:text-gray-300"
                            >
                                <Activity size={14} style={{ color: 'var(--color-accent)' }} />
                                <span>{t('proxy.overview.test_connection', { defaultValue: 'Test Live Probe' })}</span>
                                <ArrowUpRight size={13} className="text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Telemetry Bento Card */}
                <div className="bg-white dark:bg-base-200/60 rounded-2xl p-6 border border-gray-100 dark:border-base-300 shadow-sm flex flex-col justify-between">
                    <div className="space-y-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Zap size={14} style={{ color: 'var(--color-accent)' }} />
                            {t('proxy.overview.pool_status', { defaultValue: 'Rotation Engine' })}
                        </span>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="bg-gray-50/80 dark:bg-base-100/70 p-3 rounded-xl border border-gray-100 dark:border-base-300">
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">Active Accounts</div>
                                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 pt-0.5">
                                    {status.active_accounts}
                                </div>
                            </div>
                            <div className="bg-gray-50/80 dark:bg-base-100/70 p-3 rounded-xl border border-gray-100 dark:border-base-300">
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">Failover Latency</div>
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 pt-0.5">
                                    &lt; 50ms
                                </div>
                            </div>
                            <div className="bg-gray-50/80 dark:bg-base-100/70 p-3 rounded-xl border border-gray-100 dark:border-base-300">
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">Protocol Support</div>
                                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 pt-1">
                                    OpenAI / Claude
                                </div>
                            </div>
                            <div className="bg-gray-50/80 dark:bg-base-100/70 p-3 rounded-xl border border-gray-100 dark:border-base-300">
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">Zero-Leak Guard</div>
                                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1 flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    Active
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => onSelectTab('accounts')}
                        className="w-full mt-4 py-2 px-3 rounded-xl text-xs font-medium border border-gray-200 dark:border-base-300 hover:bg-gray-50 dark:hover:bg-base-300 transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300"
                    >
                        <Layers size={14} style={{ color: 'var(--color-accent)' }} />
                        <span>{t('proxy.overview.view_quotas', { defaultValue: 'View Accounts & Quotas' })}</span>
                        <ArrowUpRight size={13} className="text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Protocol Endpoints Bento Grid */}
            <div className="bg-white dark:bg-base-200/60 rounded-2xl p-6 border border-gray-100 dark:border-base-300 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-base-content flex items-center gap-2">
                            <Terminal size={16} style={{ color: 'var(--color-accent)' }} />
                            {t('proxy.overview.endpoints_title', { defaultValue: 'Universal Protocol Endpoints' })}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Plug any downstream client directly into these local endpoints.
                        </p>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">
                        Auth: Bearer Token
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {endpoints.map((ep) => (
                        <div
                            key={ep.path}
                            className="bg-gray-50/70 dark:bg-base-100/60 p-4 rounded-xl border border-gray-200/70 dark:border-base-300 flex flex-col justify-between hover:shadow-sm transition-all"
                        >
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                        {ep.protocol}
                                    </span>
                                    <span
                                        className="text-[10px] px-2 py-0.5 rounded font-mono font-medium border"
                                        style={{
                                            backgroundColor: 'var(--color-badge-bg)',
                                            color: 'var(--color-badge-text)',
                                            borderColor: 'var(--color-badge-border)',
                                        }}
                                    >
                                        {ep.badge}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                                    {ep.desc}
                                </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-base-300/80 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-mono text-gray-700 dark:text-gray-300 truncate">
                                    {ep.path}
                                </span>
                                <button
                                    onClick={() => onCopy(ep.url, ep.path)}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-base-300 transition-colors"
                                    title={t('common.copy')}
                                >
                                    {copied === ep.path ? (
                                        <Check size={14} className="text-emerald-500" />
                                    ) : (
                                        <Copy size={14} />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Agent Setup Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cursor AI Setup */}
                <div className="bg-white dark:bg-base-200/60 rounded-2xl p-5 border border-gray-100 dark:border-base-300 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Cpu size={16} style={{ color: 'var(--color-accent)' }} />
                            <h4 className="text-xs font-bold text-gray-900 dark:text-base-content">
                                Cursor AI Quick Setup
                            </h4>
                        </div>
                        <span className="text-[10px] text-gray-400">Settings &gt; Models &gt; OpenAI API Key</span>
                    </div>
                    <div className="bg-gray-900 text-gray-200 p-3 rounded-xl font-mono text-[11px] space-y-1 relative group">
                        <div className="text-gray-400"># Override OpenAI Base URL</div>
                        <div className="text-emerald-400 font-semibold">{baseUrl}/v1</div>
                        <div className="text-gray-400 pt-1"># API Key</div>
                        <div className="text-gray-300 truncate">{apiKey}</div>
                        <button
                            onClick={() => onCopy(`${baseUrl}/v1`, 'cursor-config')}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-opacity"
                            title={t('common.copy')}
                        >
                            {copied === 'cursor-config' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                    </div>
                </div>

                {/* Claude Code CLI Setup */}
                <div className="bg-white dark:bg-base-200/60 rounded-2xl p-5 border border-gray-100 dark:border-base-300 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Terminal size={16} style={{ color: 'var(--color-accent)' }} />
                            <h4 className="text-xs font-bold text-gray-900 dark:text-base-content">
                                Claude Code CLI Setup
                            </h4>
                        </div>
                        <span className="text-[10px] text-gray-400">Terminal Environment</span>
                    </div>
                    <div className="bg-gray-900 text-gray-200 p-3 rounded-xl font-mono text-[11px] space-y-1 relative group">
                        <div className="text-gray-400"># Export Anthropic URL &amp; Token</div>
                        <div className="text-emerald-400 font-semibold truncate">
                            export ANTHROPIC_BASE_URL="{baseUrl}"
                        </div>
                        <div className="text-gray-300 truncate">
                            export ANTHROPIC_API_KEY="{apiKey}"
                        </div>
                        <button
                            onClick={() => onCopy(`export ANTHROPIC_BASE_URL="${baseUrl}"\nexport ANTHROPIC_API_KEY="${apiKey}"`, 'claude-cli-config')}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-opacity"
                            title={t('common.copy')}
                        >
                            {copied === 'claude-cli-config' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
