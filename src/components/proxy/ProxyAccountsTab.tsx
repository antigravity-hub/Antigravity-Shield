/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Users,
    Clock,
    RotateCcw,
    Trash2,
    CheckCircle2,
    Sliders,
    Layers,
    Activity,
    Lock,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';
import { listAccounts } from '../../services/accountService';
import { Account, LiveLimitStatus } from '../../types/account';
import { AppConfig, StickySessionConfig, ProxyConfig } from '../../types/config';

interface ProxyAccountsTabProps {
    availableAccounts: Array<{ id: string; email: string }>;
    preferredAccountId: string | null;
    onSetPreferredAccount: (accountId: string | null) => void;
    onClearRateLimits: () => void;
    onClearSessionBindings: () => void;
    appConfig: AppConfig;
    onUpdateScheduling: (updates: Partial<StickySessionConfig>) => void;
    onUpdateProxyConfig: (updates: Partial<ProxyConfig>) => void;
}

export const ProxyAccountsTab: React.FC<ProxyAccountsTabProps> = ({
    preferredAccountId,
    onSetPreferredAccount,
    onClearRateLimits,
    onClearSessionBindings,
    appConfig,
    onUpdateScheduling,
    onUpdateProxyConfig,
}) => {
    const { t } = useTranslation();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Load full account objects with quotas
    const fetchAccounts = async () => {
        try {
            const accs = await listAccounts();
            setAccounts(accs);
        } catch (err) {
            console.error('Failed to load accounts in ProxyAccountsTab:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
        const pollInterval = setInterval(fetchAccounts, 5000);
        const ticker = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => {
            clearInterval(pollInterval);
            clearInterval(ticker);
        };
    }, []);

    // Extract all models currently in cooldown across all accounts
    const activeCooldowns: Array<{
        accountId: string;
        accountEmail: string;
        model: string;
        limit: LiveLimitStatus;
        remainingSec: number;
    }> = [];

    accounts.forEach((acc) => {
        if (acc.live_limited_models) {
            Object.entries(acc.live_limited_models).forEach(([model, limit]) => {
                if (limit.until && limit.until > currentTime) {
                    const remainingSec = Math.max(0, Math.ceil((limit.until - currentTime) / 1000));
                    activeCooldowns.push({
                        accountId: acc.id,
                        accountEmail: acc.email,
                        model,
                        limit,
                        remainingSec,
                    });
                }
            });
        }
    });

    const scheduling: StickySessionConfig = appConfig?.proxy?.scheduling || {
        mode: 'Balance',
        max_wait_seconds: 30,
    };

    const blockedAccountsCount = accounts.filter(
        (a) => a.validation_blocked || a.disabled || a.proxy_disabled || a.quota?.is_forbidden
    ).length;
    const activeAccountsCount = accounts.length - blockedAccountsCount;

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Top Stat Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-[#0c100e] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium">
                        <Users size={15} style={{ color: 'var(--color-accent)' }} />
                        <span>Total Accounts</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1 flex items-baseline gap-1.5">
                        <span>{accounts.length}</span>
                        <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                            ({activeAccountsCount} active{blockedAccountsCount > 0 ? `, ${blockedAccountsCount} suspended` : ''})
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c100e] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium">
                        <Activity size={15} className="text-amber-500" />
                        <span>Active Cooldowns</span>
                    </div>
                    <div className={`text-xl font-bold mt-1 ${activeCooldowns.length > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        {activeCooldowns.length}
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c100e] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium">
                        <Lock size={15} style={{ color: 'var(--color-accent)' }} />
                        <span>Preferred Route</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-2 truncate">
                        {preferredAccountId
                            ? accounts.find((a) => a.id === preferredAccountId)?.email || preferredAccountId
                            : 'Smart Tiered Rotation'}
                    </div>
                </div>

                <div className="bg-white dark:bg-[#0c100e] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Cooldown Actions</div>
                        <div className="text-xs text-gray-400 pt-0.5">Reset active 429 timers</div>
                    </div>
                    <button
                        onClick={onClearRateLimits}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#141916] transition-colors flex items-center gap-1.5 text-gray-700 dark:text-gray-300"
                        title={t('proxy.config.scheduling.clear_rate_limits_tooltip', { defaultValue: 'Clear all rate limit records' })}
                    >
                        <Trash2 size={13} className="text-rose-500" />
                        <span>Clear</span>
                    </button>
                </div>
            </div>

            {/* Active Cooldown Pool HUD */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className={activeCooldowns.length > 0 ? 'text-amber-500 animate-pulse' : 'text-gray-400'} />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-base-content">
                            Active Cooldown Pool &amp; Countdown Timers
                        </h3>
                    </div>
                    <span className="text-[11px] text-gray-400">
                        {activeCooldowns.length === 0 ? 'All accounts healthy' : `${activeCooldowns.length} rate limits active`}
                    </span>
                </div>

                {activeCooldowns.length === 0 ? (
                    <div className="p-4 rounded-xl bg-gray-50/60 dark:bg-[#141916] border border-dashed border-gray-200 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                        <span>Zero active 429 cooldowns. All accounts in pool are available for high-throughput dispatch.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeCooldowns.map((item) => (
                            <div
                                key={`${item.accountId}-${item.model}`}
                                className="bg-amber-50/40 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 flex flex-col justify-between"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-[170px]">
                                            {item.accountEmail}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                                            {item.remainingSec}s
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300">
                                        {item.model}
                                    </div>
                                </div>
                                <div className="mt-3 pt-2 border-t border-amber-200/40 dark:border-amber-900/40 flex items-center justify-between text-[10px] text-gray-400">
                                    <span>Status 429 Quota Exhausted</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Failover OK</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Per-Account Quota Health Gauges */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Layers size={16} style={{ color: 'var(--color-accent)' }} />
                            Per-Account Quota Health Gauges
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Live telemetry and remaining usage percentages across all connected Google Pro accounts.
                        </p>
                    </div>

                    {preferredAccountId && (
                        <button
                            onClick={() => onSetPreferredAccount(null)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#141916] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#1a201c] transition-colors"
                        >
                            Reset to Auto Rotation
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="py-12 text-center text-xs text-gray-400">Loading accounts and quota metrics...</div>
                ) : accounts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400">No accounts configured yet.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {accounts.map((acc) => {
                            const isPreferred = preferredAccountId === acc.id;
                            const isBlocked = !!(acc.validation_blocked || acc.disabled || acc.proxy_disabled || acc.quota?.is_forbidden);
                            const blockReason = acc.validation_blocked_reason || acc.disabled_reason || acc.proxy_disabled_reason || (acc.quota?.is_forbidden ? 'Google TOS / Forbidden' : '');
                            const tier = acc.quota?.subscription_tier || 'PRO';
                            const models = acc.quota?.models || [];

                            return (
                                <div
                                    key={acc.id}
                                    className={`p-4 rounded-xl border transition-all ${
                                        isBlocked
                                            ? 'bg-rose-50/10 dark:bg-rose-950/10 border-rose-500/30 dark:border-rose-900/40 opacity-75'
                                            : isPreferred
                                            ? 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                                            : 'bg-white dark:bg-[#141916] border-gray-200/70 dark:border-slate-800/80 dark:text-gray-100'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-200/50 dark:border-base-300">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                                                    {acc.email}
                                                </span>
                                                <span
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                                                    style={{
                                                        backgroundColor: 'var(--color-badge-bg)',
                                                        color: 'var(--color-badge-text)',
                                                        borderColor: 'var(--color-badge-border)',
                                                    }}
                                                >
                                                    {tier}
                                                </span>
                                                {isBlocked && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                                        <ShieldAlert size={11} />
                                                        Suspended
                                                    </span>
                                                )}
                                            </div>
                                            {acc.custom_label && (
                                                <div className="text-[10px] text-gray-400">{acc.custom_label}</div>
                                            )}
                                        </div>

                                        <button
                                            disabled={isBlocked}
                                            onClick={() => !isBlocked && onSetPreferredAccount(isPreferred ? null : acc.id)}
                                            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                                isBlocked
                                                    ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-base-200 text-gray-400 border border-gray-200 dark:border-base-300'
                                                    : isPreferred
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-gray-100 dark:bg-base-200 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-base-300 hover:bg-gray-200 dark:hover:bg-base-300'
                                            }`}
                                        >
                                            {isBlocked ? 'Blocked' : isPreferred ? 'Pinned Preferred' : 'Pin Route'}
                                        </button>
                                    </div>

                                    {/* Suspended Notice Banner */}
                                    {isBlocked && (
                                        <div className="mt-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
                                            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-rose-500" />
                                            <div className="leading-tight">
                                                <span className="font-semibold">Isolated from rotation: </span>
                                                <span>{blockReason || 'Account suspended by Google (Appeal required)'}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Quota Progress Bars */}
                                    <div className={`pt-3 space-y-2.5 ${isBlocked ? 'opacity-40' : ''}`}>
                                        {models.length === 0 ? (
                                            <div className="text-[11px] text-gray-400 py-1">No detailed quota stats received yet.</div>
                                        ) : (
                                            models.slice(0, 4).map((m) => {
                                                const pct = typeof m.percentage === 'number' ? m.percentage : 100;
                                                return (
                                                    <div key={m.name} className="space-y-1">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-mono text-gray-600 dark:text-gray-300">
                                                                {m.name}
                                                            </span>
                                                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                                {pct}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-300"
                                                                style={{
                                                                    width: `${Math.min(100, Math.max(0, pct))}%`,
                                                                    backgroundColor:
                                                                        pct > 40
                                                                            ? 'var(--color-primary-btn)'
                                                                            : pct > 15
                                                                            ? '#f59e0b'
                                                                            : '#ef4444',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Scheduling & Session Sticky Card */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sliders size={16} style={{ color: 'var(--color-accent)' }} />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            Rotation &amp; Sticky Session Policies
                        </h3>
                    </div>

                    <button
                        onClick={onClearSessionBindings}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#141916] transition-colors flex items-center gap-1.5 text-gray-700 dark:text-gray-300"
                    >
                        <RotateCcw size={13} />
                        <span>Clear Session Bindings</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Scheduling Strategy
                        </label>
                        <select
                            value={scheduling.mode}
                            onChange={(e) => onUpdateScheduling({ mode: e.target.value as any })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-base-300 bg-white dark:bg-base-100 text-xs text-gray-900 dark:text-base-content focus:outline-none"
                            style={{ borderColor: 'var(--color-accent)' }}
                        >
                            <option value="Balance">Balanced (Priority Tiered)</option>
                            <option value="FillFirst">Fill-First (Drain Pro Primary)</option>
                            <option value="Random">Randomized Dispatch</option>
                        </select>
                        <p className="text-[10px] text-gray-400">
                            Balanced automatically rotates requests across healthy ULTRA and PRO accounts.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Max Wait Cooldown (s)
                        </label>
                        <input
                            type="number"
                            value={scheduling.max_wait_seconds || 30}
                            onChange={(e) => onUpdateScheduling({ max_wait_seconds: parseInt(e.target.value) || 30 })}
                            min={1}
                            max={300}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-base-300 bg-white dark:bg-base-100 text-xs text-gray-900 dark:text-base-content focus:outline-none"
                        />
                        <p className="text-[10px] text-gray-400">
                            Maximum wait threshold before initiating instant failover.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            Strict Quota Model Catalog
                        </label>
                        <div className="pt-1.5 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Only Raw Quota Models</span>
                            <input
                                type="checkbox"
                                checked={appConfig?.proxy?.only_raw_quota_models || false}
                                onChange={(e) => onUpdateProxyConfig({ only_raw_quota_models: e.target.checked })}
                                className="toggle toggle-sm"
                            />
                        </div>
                        <p className="text-[10px] text-gray-400">
                            Hides virtual aliases and only displays models reported by upstream tokens.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
