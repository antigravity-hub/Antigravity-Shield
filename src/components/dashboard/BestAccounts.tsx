/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { useState } from 'react';
import { TrendingUp, ArrowRightLeft, ShieldCheck, Clock, ArrowUpRight, Sparkles, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Account } from '../../types/account';
import { findQuotaModel } from '../../config/modelConfig';
import { getBucketPercentage } from '../../utils/quota';

interface BestAccountsProps {
    accounts: Account[];
    currentAccountId?: string;
    onSwitch?: (accountId: string) => void;
}

type SwitchMode = 'gemini' | 'claude' | 'both';

function BestAccounts({ accounts, currentAccountId, onSwitch }: BestAccountsProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Mode persistent in localStorage, defaults to 'gemini'
    const [switchMode, setSwitchMode] = useState<SwitchMode>(() => {
        const saved = localStorage.getItem('best_account_switch_mode');
        return (saved === 'claude' || saved === 'both') ? saved : 'gemini';
    });

    const handleModeChange = (mode: SwitchMode) => {
        setSwitchMode(mode);
        localStorage.setItem('best_account_switch_mode', mode);
    };

    // Candidates: exclude current active account, disabled, proxy_disabled, and blocked accounts
    const candidates = accounts.filter(
        a => a.id !== currentAccountId && !a.disabled && !a.proxy_disabled && !a.validation_blocked && !a.quota?.is_forbidden
    );

    // ── 1. Gemini Ranking ──────────────────────────────────────────────────
    const geminiSorted = candidates
        .map(a => {
            const pro5h = findQuotaModel(a.quota?.models, 'gemini-pro')?.percentage ?? null;
            const flash5h = findQuotaModel(a.quota?.models, 'gemini-flash')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', '5h');

            const modelScore = pro5h ?? flash5h ?? fiveHourGroup ?? 0;
            let fiveHourScore = Math.min(
                fiveHourGroup ?? modelScore,
                weeklyGroup ?? 100,
                modelScore
            );
            const weeklyScore = weeklyGroup ?? 0;

            if ((weeklyGroup !== null && weeklyGroup < 1) || fiveHourScore <= 0) {
                fiveHourScore = 0;
            }

            const modelObj = findQuotaModel(a.quota?.models, 'gemini-pro') || findQuotaModel(a.quota?.models, 'gemini-flash');
            let resetTime = modelObj?.reset_time ? new Date(modelObj.reset_time).getTime() : 0;

            const now = Date.now();
            const minutesRemaining = resetTime > now ? Math.ceil((resetTime - now) / 60000) : 0;
            const hasSafeBuffer = minutesRemaining >= 20 || resetTime === 0;

            return {
                account: a,
                effectiveScore: fiveHourScore,
                weeklyScore,
                hasSafeBuffer,
                minutesRemaining,
            };
        })
        .filter(item => item.effectiveScore > 0)
        .sort((a, b) => {
            if (a.hasSafeBuffer !== b.hasSafeBuffer) {
                return a.hasSafeBuffer ? -1 : 1;
            }
            if (Math.abs(b.effectiveScore - a.effectiveScore) >= 1) {
                return b.effectiveScore - a.effectiveScore;
            }
            return b.weeklyScore - a.weeklyScore;
        });

    const bestGemini = geminiSorted[0];

    // ── 2. Claude Ranking ──────────────────────────────────────────────────
    const claudeSorted = candidates
        .map(a => {
            const claude5h = findQuotaModel(a.quota?.models, 'claude')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', '5h');

            const modelScore = claude5h ?? fiveHourGroup ?? 0;
            let fiveHourScore = Math.min(
                fiveHourGroup ?? modelScore,
                weeklyGroup ?? 100,
                modelScore
            );
            const weeklyScore = weeklyGroup ?? 0;

            if ((weeklyGroup !== null && weeklyGroup < 1) || fiveHourScore <= 0) {
                fiveHourScore = 0;
            }

            const modelObj = findQuotaModel(a.quota?.models, 'claude');
            let resetTime = modelObj?.reset_time ? new Date(modelObj.reset_time).getTime() : 0;

            const now = Date.now();
            const minutesRemaining = resetTime > now ? Math.ceil((resetTime - now) / 60000) : 0;
            const hasSafeBuffer = minutesRemaining >= 20 || resetTime === 0;

            return {
                account: a,
                effectiveScore: fiveHourScore,
                weeklyScore,
                hasSafeBuffer,
                minutesRemaining,
            };
        })
        .filter(item => item.effectiveScore > 0)
        .sort((a, b) => {
            if (a.hasSafeBuffer !== b.hasSafeBuffer) {
                return a.hasSafeBuffer ? -1 : 1;
            }
            if (Math.abs(b.effectiveScore - a.effectiveScore) >= 1) {
                return b.effectiveScore - a.effectiveScore;
            }
            return b.weeklyScore - a.weeklyScore;
        });

    const bestClaude = claudeSorted[0];

    // ── 3. Unified Decision ────────────────────────────────────────────────
    let mainTargetId: string | null = null;
    let showGemini = false;
    let showClaude = false;

    if (switchMode === 'gemini') {
        showGemini = !!bestGemini;
        mainTargetId = bestGemini?.account.id || null;
    } else if (switchMode === 'claude') {
        showClaude = !!bestClaude;
        mainTargetId = bestClaude?.account.id || null;
    } else {
        showGemini = !!bestGemini;
        showClaude = !!bestClaude && bestClaude.account.id !== bestGemini?.account.id;
        mainTargetId = bestGemini?.account.id || bestClaude?.account.id || null;
    }

    return (
        <div className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-[#93e9be]/30 transition-all duration-300 h-full flex flex-col justify-between min-h-[380px]">
            {/* Header */}
            <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border border-cyan-500/25">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                {t('dashboard.best_accounts')}
                            </h2>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {t('dashboard.widget_best.dynamic_fleet_routing', "Dynamic Fleet Routing")}
                            </span>
                        </div>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 p-0.5 rounded-xl text-[11px] font-semibold">
                        <button
                            type="button"
                            onClick={() => handleModeChange('gemini')}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                switchMode === 'gemini'
                                    ? 'bg-white dark:bg-white/10 text-emerald-700 dark:text-[#93e9be] shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                            title={t('dashboard.mode_gemini')}
                        >
                            Gemini
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('claude')}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                switchMode === 'claude'
                                    ? 'bg-white dark:bg-white/10 text-cyan-600 dark:text-cyan-400 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                            title={t('dashboard.mode_claude')}
                        >
                            Claude
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('both')}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                switchMode === 'both'
                                    ? 'bg-white dark:bg-white/10 text-purple-600 dark:text-purple-400 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                            title={t('dashboard.mode_both')}
                        >
                            {t('dashboard.mode_both', 'All')}
                        </button>
                    </div>
                </div>

                {/* Recommendations Body */}
                <div className="space-y-3">
                    {/* Gemini Recommendation */}
                    {showGemini && bestGemini && (
                        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-2 hover:border-[var(--color-badge-border)] transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span 
                                        className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)]"
                                    >
                                        <Sparkles className="w-3 h-3" style={{ color: 'var(--color-accent)' }} />
                                        {t('dashboard.for_gemini', 'For Gemini')}
                                    </span>
                                    {bestGemini.hasSafeBuffer ? (
                                        <span 
                                            className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-md font-bold"
                                            style={{
                                                backgroundColor: 'var(--color-badge-bg)',
                                                color: 'var(--color-badge-text)',
                                            }}
                                        >
                                            <ShieldCheck className="w-2.5 h-2.5" />
                                            {t('dashboard.widget_best.gt_20m', "&gt;20m")}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-md font-bold">
                                            <Clock className="w-2.5 h-2.5" />
                                            {bestGemini.minutesRemaining}m
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {bestGemini.weeklyScore > 0 && (
                                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold rounded">
                                            W: {bestGemini.weeklyScore}%
                                        </span>
                                    )}
                                    <span 
                                        className="px-2 py-0.5 text-xs font-mono font-black rounded-lg border"
                                        style={{
                                            backgroundColor: 'var(--color-badge-bg)',
                                            color: 'var(--color-badge-text)',
                                            borderColor: 'var(--color-badge-border)',
                                        }}
                                    >
                                        {bestGemini.effectiveScore}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate" title={bestGemini.account.email}>
                                    {bestGemini.account.email}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/accounts', { state: { email: bestGemini.account.email } })}
                                        title={t('dashboard.view_in_accounts', 'View in Accounts')}
                                        className="p-1 rounded-md text-slate-400 hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                                    >
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </button>
                                    {onSwitch && (
                                        <button
                                            type="button"
                                            onClick={() => onSwitch(bestGemini.account.id)}
                                            className="p-1.5 rounded-lg transition-colors cursor-pointer border"
                                            style={{
                                                backgroundColor: 'var(--color-badge-bg)',
                                                color: 'var(--color-badge-text)',
                                                borderColor: 'var(--color-badge-border)',
                                            }}
                                            title={`${t('dashboard.switch_to', 'Switch')} (${bestGemini.account.email})`}
                                        >
                                            <ArrowRightLeft className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Claude Recommendation */}
                    {showClaude && bestClaude && (
                        <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-2 hover:border-cyan-500/30 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Bot className="w-3 h-3 text-cyan-400" />
                                        {t('dashboard.for_claude', 'For Claude')}
                                    </span>
                                    {bestClaude.hasSafeBuffer ? (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 rounded-md font-bold">
                                            <ShieldCheck className="w-2.5 h-2.5" />
                                            {t('dashboard.widget_best.gt_20m_2', "&gt;20m")}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-md font-bold">
                                            <Clock className="w-2.5 h-2.5" />
                                            {bestClaude.minutesRemaining}m
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {bestClaude.weeklyScore > 0 && (
                                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold rounded">
                                            W: {bestClaude.weeklyScore}%
                                        </span>
                                    )}
                                    <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-xs font-mono font-black rounded-lg border border-cyan-500/20">
                                        {bestClaude.effectiveScore}%
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate" title={bestClaude.account.email}>
                                    {bestClaude.account.email}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/accounts', { state: { email: bestClaude.account.email } })}
                                        title={t('dashboard.view_in_accounts', 'View in Accounts')}
                                        className="p-1 rounded-md text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                                    >
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </button>
                                    {onSwitch && (
                                        <button
                                            type="button"
                                            onClick={() => onSwitch(bestClaude.account.id)}
                                            className="p-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-400 rounded-lg transition-colors cursor-pointer border border-cyan-500/30"
                                            title={`${t('dashboard.switch_to', 'Switch')} (${bestClaude.account.email})`}
                                        >
                                            <ArrowRightLeft className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!showGemini && !showClaude && (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-medium">
                            {t('accounts.no_data', 'No suitable standby accounts available')}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Button Action */}
            {mainTargetId && onSwitch ? (
                <div className="pt-4 mt-auto">
                    <button
                        type="button"
                        className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        style={{
                            backgroundColor: 'var(--color-primary-btn, #129a5f)',
                            boxShadow: '0 2px 10px var(--color-accent-glow, rgba(147, 233, 190, 0.2))',
                        }}
                        onClick={() => {
                            if (mainTargetId) {
                                onSwitch(mainTargetId);
                            }
                        }}
                    >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>{t('dashboard.switch_best')}</span>
                    </button>
                </div>
            ) : (
                <div className="pt-4 mt-auto opacity-0 pointer-events-none">
                    <div className="py-2.5" />
                </div>
            )}
        </div>
    );
}

export default BestAccounts;
