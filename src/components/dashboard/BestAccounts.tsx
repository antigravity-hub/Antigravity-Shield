import { useState } from 'react';
import { TrendingUp, ExternalLink, ArrowRightLeft, ShieldCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Account } from '../../types/account';
import { findQuotaModel } from '../../config/modelConfig';
import { useTranslation } from 'react-i18next';
import { getBucketPercentage, getAccountCycleReset } from '../../utils/quota';

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

    // Candidates: exclude current active account and disabled accounts
    const candidates = accounts.filter(
        a => a.id !== currentAccountId && !a.disabled && !a.proxy_disabled
    );

    // ── 1. Gemini Ranking ──────────────────────────────────────────────────
    // - Unified bucket: Gemini Pro and Flash share the same quota bucket in Google Antigravity.
    // - Weekly threshold: Disqualify ONLY if weekly quota is depleted (< 1%).
    // - Safe buffer: Prioritize accounts with >= 20m remaining on 5h window or ready.
    const geminiSorted = candidates
        .map(a => {
            const pro5h = findQuotaModel(a.quota?.models, 'gemini-pro')?.percentage ?? null;
            const flash5h = findQuotaModel(a.quota?.models, 'gemini-flash')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', '5h');

            let fiveHourScore = fiveHourGroup ?? pro5h ?? flash5h ?? weeklyGroup ?? 0;
            const weeklyScore = weeklyGroup ?? 0;

            // Disqualify only if weekly quota is depleted (< 1%)
            if (weeklyGroup !== null && weeklyGroup < 1) {
                fiveHourScore = 0;
            }

            const resetInfo = getAccountCycleReset(a, 'five_hour', 'gemini');
            const minutesRemaining = resetInfo.totalMinutes;
            const hasSafeBuffer = resetInfo.isReady || minutesRemaining === 0 || minutesRemaining >= 20;

            return {
                ...a,
                fiveHourScore,
                weeklyScore,
                quotaVal: fiveHourScore,
                hasSafeBuffer,
                minutesRemaining,
            };
        })
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => {
            // Priority 1: Safe buffer (> 20m or ready)
            if (a.hasSafeBuffer !== b.hasSafeBuffer) {
                return a.hasSafeBuffer ? -1 : 1;
            }
            // Priority 2: Highest 5h percentage
            if (b.fiveHourScore !== a.fiveHourScore) {
                return b.fiveHourScore - a.fiveHourScore;
            }
            // Priority 3: Weekly tiebreaker
            return b.weeklyScore - a.weeklyScore;
        });

    // ── 2. Claude Ranking ──────────────────────────────────────────────────
    // - Prioritize Opus if available, then general Claude model.
    // - Weekly threshold: Disqualify ONLY if Claude weekly quota is depleted (< 1%).
    // - Safe buffer: Prioritize accounts with >= 20m remaining on 5h window or ready.
    const claudeSorted = candidates
        .map(a => {
            const claudeOpus = a.quota?.models?.find(m => m.name.toLowerCase().includes('opus'))?.percentage ?? null;
            const claudeGeneral = findQuotaModel(a.quota?.models, 'claude')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', '5h');

            let fiveHourScore = fiveHourGroup ?? claudeOpus ?? claudeGeneral ?? weeklyGroup ?? 0;
            const weeklyScore = weeklyGroup ?? 0;

            // Disqualify only if Claude weekly quota is depleted (< 1%)
            if (weeklyGroup !== null && weeklyGroup < 1) {
                fiveHourScore = 0;
            }

            const resetInfo = getAccountCycleReset(a, 'five_hour', 'claude');
            const minutesRemaining = resetInfo.totalMinutes;
            const hasSafeBuffer = resetInfo.isReady || minutesRemaining === 0 || minutesRemaining >= 20;

            return {
                ...a,
                fiveHourScore,
                weeklyScore,
                quotaVal: fiveHourScore,
                hasSafeBuffer,
                minutesRemaining,
            };
        })
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => {
            // Priority 1: Safe buffer (> 20m or ready)
            if (a.hasSafeBuffer !== b.hasSafeBuffer) {
                return a.hasSafeBuffer ? -1 : 1;
            }
            // Priority 2: Highest 5h percentage
            if (b.fiveHourScore !== a.fiveHourScore) {
                return b.fiveHourScore - a.fiveHourScore;
            }
            // Priority 3: Weekly tiebreaker
            return b.weeklyScore - a.weeklyScore;
        });

    let bestGemini = geminiSorted[0];
    let bestClaude = claudeSorted[0];

    // Pairing optimization: if both point to the same account and user views both, diversify if viable
    if (switchMode === 'both' && bestGemini && bestClaude && bestGemini.id === bestClaude.id) {
        const nextGemini = geminiSorted[1];
        const nextClaude = claudeSorted[1];

        const calcScore = (acc?: { fiveHourScore: number; weeklyScore: number; hasSafeBuffer: boolean }) =>
            acc ? (acc.hasSafeBuffer ? 100000 : 0) + acc.fiveHourScore * 1000 + acc.weeklyScore : 0;

        const scoreA = calcScore(bestGemini) + calcScore(nextClaude);
        const scoreB = calcScore(nextGemini) + calcScore(bestClaude);

        if (nextClaude && (!nextGemini || scoreA >= scoreB)) {
            bestClaude = nextClaude;
        } else if (nextGemini) {
            bestGemini = nextGemini;
        }
    }

    const bestGeminiRender = bestGemini ? {
        ...bestGemini,
        geminiQuota: bestGemini.quotaVal,
    } : undefined;

    const bestClaudeRender = bestClaude ? {
        ...bestClaude,
        claudeQuota: bestClaude.quotaVal,
    } : undefined;

    // Resolve target account for the main switch button based on mode
    let mainTargetId: string | undefined;
    if (switchMode === 'gemini') {
        mainTargetId = bestGeminiRender?.id;
    } else if (switchMode === 'claude') {
        mainTargetId = bestClaudeRender?.id;
    } else {
        // Both: choose higher 5h quota, preferring Gemini if equal
        if (bestGeminiRender && bestClaudeRender) {
            mainTargetId = bestClaudeRender.claudeQuota > bestGeminiRender.geminiQuota
                ? bestClaudeRender.id
                : bestGeminiRender.id;
        } else {
            mainTargetId = bestGeminiRender?.id || bestClaudeRender?.id;
        }
    }

    const showGemini = (switchMode === 'gemini' || switchMode === 'both') && bestGeminiRender;
    const showClaude = (switchMode === 'claude' || switchMode === 'both') && bestClaudeRender;

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200 h-full flex flex-col">
            {/* Header with Title and Mode Switcher */}
            <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-base-content flex items-center gap-1.5 shrink-0">
                    <TrendingUp className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    <span>{t('dashboard.best_accounts')}</span>
                </h2>

                {/* Segmented Mode Selector */}
                <div className="flex items-center bg-gray-100 dark:bg-base-200/80 p-0.5 rounded-lg text-[11px] font-medium">
                    <button
                        type="button"
                        onClick={() => handleModeChange('gemini')}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                            switchMode === 'gemini'
                                ? 'bg-white dark:bg-base-300 text-green-600 dark:text-green-400 font-semibold shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-base-content'
                        }`}
                        title={t('dashboard.mode_gemini')}
                    >
                        Gemini
                    </button>
                    <button
                        type="button"
                        onClick={() => handleModeChange('claude')}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                            switchMode === 'claude'
                                ? 'bg-white dark:bg-base-300 text-cyan-600 dark:text-cyan-400 font-semibold shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-base-content'
                        }`}
                        title={t('dashboard.mode_claude')}
                    >
                        Claude
                    </button>
                    <button
                        type="button"
                        onClick={() => handleModeChange('both')}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                            switchMode === 'both'
                                ? 'bg-white dark:bg-base-300 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-base-content'
                        }`}
                        title={t('dashboard.mode_both')}
                    >
                        {t('dashboard.mode_both', 'All')}
                    </button>
                </div>
            </div>

            {/* Cards List */}
            <div className="space-y-2.5 flex-1">
                {/* Gemini Recommendation */}
                {showGemini && (
                    <div className="flex items-center justify-between p-2.5 bg-green-50/70 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30 transition-all hover:shadow-xs">
                        <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] text-green-700 dark:text-green-400 font-semibold uppercase tracking-wider">
                                    {t('dashboard.for_gemini')}
                                </span>
                                {bestGeminiRender.hasSafeBuffer ? (
                                    <span
                                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-green-200/60 dark:bg-green-800/50 text-green-800 dark:text-green-300 rounded font-medium"
                                        title={t('dashboard.safe_window', 'Safe window > 20 min')}
                                    >
                                        <ShieldCheck className="w-2.5 h-2.5" />
                                        &gt;20m
                                    </span>
                                ) : (
                                    <span
                                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-medium"
                                        title={`Reset in ${bestGeminiRender.minutesRemaining}m`}
                                    >
                                        <Clock className="w-2.5 h-2.5" />
                                        {bestGeminiRender.minutesRemaining}m
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm text-gray-900 dark:text-base-content truncate" title={bestGeminiRender.email}>
                                    {bestGeminiRender.email}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/accounts', { state: { email: bestGeminiRender.email } });
                                    }}
                                    title={t('dashboard.view_in_accounts', 'View in Accounts')}
                                    className="p-1 rounded-md text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-100/50 dark:hover:bg-green-900/40 transition-colors cursor-pointer shrink-0"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Quota Badges & Quick Switch */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {bestGeminiRender.weeklyScore > 0 && (
                                <span
                                    className="px-1.5 py-0.5 bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300 text-[10px] font-semibold rounded"
                                    title={`${t('dashboard.quota_weekly', 'Weekly')}: ${bestGeminiRender.weeklyScore}%`}
                                >
                                    W: {bestGeminiRender.weeklyScore}%
                                </span>
                            )}
                            <div
                                className="px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-full shadow-xs"
                                title={`${t('dashboard.quota_5h', '5h Quota')}: ${bestGeminiRender.geminiQuota}%`}
                            >
                                {bestGeminiRender.geminiQuota}%
                            </div>
                            {onSwitch && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSwitch(bestGeminiRender.id);
                                    }}
                                    className="p-1.5 ml-0.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors cursor-pointer shadow-xs"
                                    title={`${t('dashboard.switch_to', 'Switch')} (${bestGeminiRender.email})`}
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Claude Recommendation */}
                {showClaude && (
                    <div className="flex items-center justify-between p-2.5 bg-cyan-50/70 dark:bg-cyan-900/20 rounded-lg border border-cyan-100 dark:border-cyan-900/30 transition-all hover:shadow-xs">
                        <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold uppercase tracking-wider">
                                    {t('dashboard.for_claude')}
                                </span>
                                {bestClaudeRender.hasSafeBuffer ? (
                                    <span
                                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-cyan-200/60 dark:bg-cyan-800/50 text-cyan-800 dark:text-cyan-300 rounded font-medium"
                                        title={t('dashboard.safe_window', 'Safe window > 20 min')}
                                    >
                                        <ShieldCheck className="w-2.5 h-2.5" />
                                        &gt;20m
                                    </span>
                                ) : (
                                    <span
                                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-medium"
                                        title={`Reset in ${bestClaudeRender.minutesRemaining}m`}
                                    >
                                        <Clock className="w-2.5 h-2.5" />
                                        {bestClaudeRender.minutesRemaining}m
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm text-gray-900 dark:text-base-content truncate" title={bestClaudeRender.email}>
                                    {bestClaudeRender.email}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/accounts', { state: { email: bestClaudeRender.email } });
                                    }}
                                    title={t('dashboard.view_in_accounts', 'View in Accounts')}
                                    className="p-1 rounded-md text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-100/50 dark:hover:bg-cyan-900/40 transition-colors cursor-pointer shrink-0"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Quota Badges & Quick Switch */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {bestClaudeRender.weeklyScore > 0 && (
                                <span
                                    className="px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-800/40 text-cyan-700 dark:text-cyan-300 text-[10px] font-semibold rounded"
                                    title={`${t('dashboard.quota_weekly', 'Weekly')}: ${bestClaudeRender.weeklyScore}%`}
                                >
                                    W: {bestClaudeRender.weeklyScore}%
                                </span>
                            )}
                            <div
                                className="px-2 py-0.5 bg-cyan-500 text-white text-xs font-semibold rounded-full shadow-xs"
                                title={`${t('dashboard.quota_5h', '5h Quota')}: ${bestClaudeRender.claudeQuota}%`}
                            >
                                {bestClaudeRender.claudeQuota}%
                            </div>
                            {onSwitch && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSwitch(bestClaudeRender.id);
                                    }}
                                    className="p-1.5 ml-0.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors cursor-pointer shadow-xs"
                                    title={`${t('dashboard.switch_to', 'Switch')} (${bestClaudeRender.email})`}
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!showGemini && !showClaude && (
                    <div className="text-center py-6 text-gray-400 text-xs">
                        {t('accounts.no_data', 'No suitable accounts available')}
                    </div>
                )}
            </div>

            {/* Primary Action Button */}
            {mainTargetId && onSwitch && (
                <div className="mt-auto pt-3">
                    <button
                        type="button"
                        className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
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
            )}
        </div>
    );
}

export default BestAccounts;
