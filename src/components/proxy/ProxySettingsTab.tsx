/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Settings,
    Shield,
    Key,
    Lock,
    Globe,
    Download,
    Power,
    Copy,
    CheckCircle,
    Edit2,
    Check,
    X,
    RefreshCw,
    QrCode
} from 'lucide-react';
import { AppConfig, ProxyConfig, CircuitBreakerConfig } from '../../types/config';
import { CliSyncCard } from './CliSyncCard';
import CircuitBreaker from '../settings/CircuitBreaker';
import AdvancedThinking from '../settings/AdvancedThinking';
import HelpTooltip from '../common/HelpTooltip';

interface ProxyStatus {
    running: boolean;
    port: number;
    base_url: string;
    active_accounts: number;
}

interface ProxySettingsTabProps {
    appConfig: AppConfig;
    status: ProxyStatus;
    onUpdateProxyConfig: (updates: Partial<ProxyConfig>) => void;
    onUpdateCircuitBreakerConfig: (newConfig: CircuitBreakerConfig) => void;
    isEditingApiKey: boolean;
    tempApiKey: string;
    setTempApiKey: (key: string) => void;
    onEditApiKey: () => void;
    onSaveApiKey: () => void;
    onCancelEditApiKey: () => void;
    onGenerateApiKey: () => void;
    isEditingAdminPassword: boolean;
    tempAdminPassword: string;
    setTempAdminPassword: (pw: string) => void;
    onEditAdminPassword: () => void;
    onSaveAdminPassword: () => void;
    onCancelEditAdminPassword: () => void;
    cfStatus: {
        installed: boolean;
        version?: string;
        running: boolean;
        url?: string;
        error?: string;
    };
    cfLoading: boolean;
    cfMode: 'quick' | 'auth';
    setCfMode: (mode: 'quick' | 'auth') => void;
    cfToken: string;
    setCfToken: (token: string) => void;
    cfUseHttp2: boolean;
    setCfUseHttp2: (use: boolean) => void;
    onCfInstall: () => void;
    onCfToggle: (enable: boolean) => void;
    onCfCopyUrl: () => void;
    onOpenMobileQr: () => void;
    copied: string | null;
    onCopy: (text: string, label: string) => void;
}

export const ProxySettingsTab: React.FC<ProxySettingsTabProps> = ({
    appConfig,
    status,
    onUpdateProxyConfig,
    onUpdateCircuitBreakerConfig,
    isEditingApiKey,
    tempApiKey,
    setTempApiKey,
    onEditApiKey,
    onSaveApiKey,
    onCancelEditApiKey,
    onGenerateApiKey,
    isEditingAdminPassword,
    tempAdminPassword,
    setTempAdminPassword,
    onEditAdminPassword,
    onSaveAdminPassword,
    onCancelEditAdminPassword,
    cfStatus,
    cfLoading,
    cfMode,
    setCfMode,
    cfToken,
    setCfToken,
    cfUseHttp2,
    setCfUseHttp2,
    onCfInstall,
    onCfToggle,
    onCfCopyUrl,
    onOpenMobileQr,
    copied,
    onCopy,
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Core Network Settings Card */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Settings size={18} style={{ color: 'var(--color-accent)' }} />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {t('proxy.settings.core_network_amp_listener_conf', "Core Network &amp; Listener Configuration")}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Port */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <span>{t('proxy.config.port', { defaultValue: 'Listening Port' })}</span>
                            <HelpTooltip
                                text={t('proxy.config.port_tooltip', { defaultValue: 'Local port for incoming proxy requests.' })}
                                ariaLabel={t('proxy.config.port', 'Port')}
                                placement="right"
                            />
                        </label>
                        <input
                            type="number"
                            value={appConfig?.proxy?.port ?? 8045}
                            onChange={(e) => onUpdateProxyConfig({ port: parseInt(e.target.value) || 8045 })}
                            min={8000}
                            max={65535}
                            disabled={status.running}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs text-gray-900 dark:text-gray-100 disabled:opacity-50"
                        />
                        <p className="text-[10px] text-gray-400">
                            {status.running ? t('proxy.settings.stop_proxy_to_change_port', "Stop proxy to change port") : t('proxy.settings.default_8045_or_8765', "Default: 8045 or 8765")}
                        </p>
                    </div>

                    {/* Timeout */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <span>{t('proxy.config.request_timeout', { defaultValue: 'Request Timeout (s)' })}</span>
                            <HelpTooltip
                                text={t('proxy.config.request_timeout_tooltip', { defaultValue: 'Maximum seconds before timing out long stream requests.' })}
                                ariaLabel={t('proxy.config.request_timeout', 'Timeout')}
                                placement="top"
                            />
                        </label>
                        <input
                            type="number"
                            value={appConfig?.proxy?.request_timeout || 120}
                            onChange={(e) => onUpdateProxyConfig({ request_timeout: parseInt(e.target.value) || 120 })}
                            min={30}
                            max={7200}
                            disabled={status.running}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs text-gray-900 dark:text-gray-100 disabled:opacity-50"
                        />
                        <p className="text-[10px] text-gray-400">
                            {t('proxy.settings.30_to_7200_seconds_recommended', "30 to 7200 seconds (recommended: 120s for code generation)")}
                        </p>
                    </div>

                    {/* Auto Start */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {t('proxy.settings.startup_behavior', "Startup Behavior")}
                        </label>
                        <div className="pt-1.5 flex items-center justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('proxy.settings.auto_start_on_app_launch', "Auto-start on app launch")}</span>
                            <input
                                type="checkbox"
                                checked={appConfig?.proxy?.auto_start || false}
                                onChange={(e) => onUpdateProxyConfig({ auto_start: e.target.checked })}
                                className="toggle toggle-sm"
                            />
                        </div>
                        <p className="text-[10px] text-gray-400">
                            {t('proxy.settings.automatically_activates_the_ga', "Automatically activates the gateway upon launching Antigravity Shield.")}
                        </p>
                    </div>
                </div>
            </div>

            {/* Security & Authentication Bento Card */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Shield size={18} style={{ color: 'var(--color-accent)' }} />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {t('proxy.settings.authentication_amp_access_cont', "Authentication &amp; Access Control")}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* API Key Box */}
                    <div className="p-4 bg-gray-50/70 dark:bg-[#141916] rounded-xl border border-gray-200/70 dark:border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                <Key size={14} style={{ color: 'var(--color-accent)' }} />
                                {t('proxy.settings.proxy_api_key_bearer_token', "Proxy API Key (Bearer Token)")}
                            </span>
                            <div className="flex items-center gap-1">
                                {isEditingApiKey ? (
                                    <>
                                        <button onClick={onSaveApiKey} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded" title={t('proxy.settings.save', "Save")}>
                                            <Check size={14} />
                                        </button>
                                        <button onClick={onCancelEditApiKey} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-[#141916] rounded" title={t('proxy.settings.cancel', "Cancel")}>
                                            <X size={14} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={onEditApiKey} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded" title={t('proxy.settings.edit', "Edit")}>
                                            <Edit2 size={13} />
                                        </button>
                                        <button onClick={onGenerateApiKey} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded" title={t('proxy.settings.regenerate', "Regenerate")}>
                                            <RefreshCw size={13} />
                                        </button>
                                        <button
                                            onClick={() => onCopy(appConfig?.proxy?.api_key || '', 'api-key')}
                                            className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded"
                                            title={t('proxy.settings.copy', "Copy")}
                                        >
                                            {copied === 'api-key' ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {isEditingApiKey ? (
                            <input
                                type="text"
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs font-mono text-gray-900 dark:text-gray-100"
                            />
                        ) : (
                            <div className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-[#0c100e] px-3 py-1.5 rounded border border-gray-200 dark:border-slate-800 truncate">
                                {appConfig?.proxy?.api_key || t('proxy.settings.no_key_set', 'No key set')}
                            </div>
                        )}
                        <p className="text-[10px] text-gray-400">
                            {t('proxy.settings.required_in_authorization_bear', "Required in Authorization: Bearer &lt;key&gt; header when auth is enabled.")}
                        </p>
                    </div>

                    {/* Admin Password Box */}
                    <div className="p-4 bg-gray-50/70 dark:bg-[#141916] rounded-xl border border-gray-200/70 dark:border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                <Lock size={14} style={{ color: 'var(--color-accent)' }} />
                                {t('proxy.settings.admin_dashboard_password', "Admin Dashboard Password")}
                            </span>
                            <div className="flex items-center gap-1">
                                {isEditingAdminPassword ? (
                                    <>
                                        <button onClick={onSaveAdminPassword} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded" title={t('proxy.settings.save_2', "Save")}>
                                            <Check size={14} />
                                        </button>
                                        <button onClick={onCancelEditAdminPassword} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-[#141916] rounded" title={t('proxy.settings.cancel_2', "Cancel")}>
                                            <X size={14} />
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={onEditAdminPassword} className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded" title={t('proxy.settings.edit_2', "Edit")}>
                                        <Edit2 size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {isEditingAdminPassword ? (
                            <input
                                type="password"
                                value={tempAdminPassword}
                                onChange={(e) => setTempAdminPassword(e.target.value)}
                                placeholder={t('proxy.settings.enter_new_admin_password', "Enter new admin password")}
                                className="w-full px-2.5 py-1.5 rounded border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs text-gray-900 dark:text-gray-100"
                            />
                        ) : (
                            <div className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-[#0c100e] px-3 py-1.5 rounded border border-gray-200 dark:border-slate-800">
                                {appConfig?.proxy?.admin_password ? '••••••••••••' : t('proxy.settings.none_open_access', "None (Open access)")}
                            </div>
                        )}
                        <p className="text-[10px] text-gray-400">
                            {t('proxy.settings.protects_management_web_endpoi', "Protects management web endpoints and remote monitoring views.")}
                        </p>
                    </div>
                </div>
            </div>

            {/* CLI Sync Card Embed */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm overflow-hidden p-5">
                <CliSyncCard
                    proxyUrl={status.running ? `http://127.0.0.1:${status.port}` : `http://127.0.0.1:${appConfig?.proxy?.port || 8045}`}
                    apiKey={appConfig?.proxy?.api_key || ''}
                />
            </div>

            {/* Public Access & Cloudflared Tunnel */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Globe size={18} className="text-amber-500" />
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                {t('proxy.settings.cloudflared_zero_trust_tunnel_', "Cloudflared Zero-Trust Tunnel (Egress &amp; Remote Access)")}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('proxy.settings.securely_expose_your_local_pro', "Securely expose your local proxy to your mobile devices or remote servers without opening router ports.")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!cfStatus.installed ? (
                            <button
                                onClick={onCfInstall}
                                disabled={cfLoading}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity flex items-center gap-1.5"
                                style={{ backgroundColor: 'var(--color-primary-btn)' }}
                            >
                                <Download size={14} />
                                <span>{cfLoading ? t('proxy.settings.installing', "Installing...") : t('proxy.settings.install_cloudflared', "Install Cloudflared")}</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => onCfToggle(!cfStatus.running)}
                                disabled={cfLoading}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    cfStatus.running
                                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50'
                                        : 'text-white'
                                }`}
                                style={!cfStatus.running ? { backgroundColor: 'var(--color-primary-btn)' } : undefined}
                            >
                                <Power size={14} />
                                <span>{cfStatus.running ? t('proxy.settings.stop_tunnel', "Stop Tunnel") : t('proxy.settings.start_tunnel', "Start Tunnel")}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Cloudflared Mode & Protocol Options */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-gray-100 dark:border-base-300">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {t('proxy.settings.tunnel_mode', "Tunnel Mode")}
                        </label>
                        <select
                            value={cfMode}
                            onChange={(e) => setCfMode(e.target.value as 'quick' | 'auth')}
                            disabled={cfStatus.running}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-base-300 bg-white dark:bg-base-100 text-xs text-gray-900 dark:text-base-content"
                        >
                            <option value="quick">{t('proxy.settings.quick_tunnel_zero_config', "Quick Tunnel (Zero Config)")}</option>
                            <option value="auth">{t('proxy.settings.named_tunnel_custom_token', "Named Tunnel (Custom Token)")}</option>
                        </select>
                    </div>

                    {cfMode === 'auth' && (
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {t('proxy.settings.tunnel_auth_token', "Tunnel Auth Token")}
                            </label>
                            <input
                                type="text"
                                value={cfToken}
                                onChange={(e) => setCfToken(e.target.value)}
                                disabled={cfStatus.running}
                                placeholder={t('proxy.settings.eyjhbgcioi', "eyJhbGciOi...")}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-base-300 bg-white dark:bg-base-100 text-xs text-gray-900 dark:text-base-content"
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {t('proxy.settings.transport_protocol', "Transport Protocol")}
                        </label>
                        <div className="pt-1.5 flex items-center justify-between">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('proxy.settings.use_http_2_egress', "Use HTTP/2 Egress")}</span>
                            <input
                                type="checkbox"
                                checked={cfUseHttp2}
                                onChange={(e) => setCfUseHttp2(e.target.checked)}
                                disabled={cfStatus.running}
                                className="toggle toggle-sm"
                            />
                        </div>
                    </div>
                </div>

                {cfStatus.running && cfStatus.url && (
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">{t('proxy.settings.public_live_url', "Public Live URL:")}</span>
                            <div className="text-xs font-mono font-semibold text-gray-900 dark:text-gray-100">
                                {cfStatus.url}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onCfCopyUrl}
                                className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                                title={t('proxy.settings.copy_url', "Copy URL")}
                            >
                                {copied === 'cf-url' ? <CheckCircle size={14} /> : <Copy size={14} />}
                            </button>
                            <button
                                onClick={onOpenMobileQr}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white flex items-center gap-1.5"
                            >
                                <QrCode size={14} />
                                <span>{t('proxy.settings.pair_mobile', "Pair Mobile")}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Advanced Thinking & Circuit Breaker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm">
                    <AdvancedThinking
                        config={appConfig.proxy}
                        onChange={(newProxy) => onUpdateProxyConfig(newProxy)}
                    />
                </div>

                <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm">
                    <CircuitBreaker
                        config={appConfig.circuit_breaker}
                        onChange={onUpdateCircuitBreakerConfig}
                    />
                </div>
            </div>
        </div>
    );
};
