import { TrendingUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Account, QuotaGroup } from '../../types/account';
import { findQuotaModel } from '../../config/modelConfig';
import { useTranslation } from 'react-i18next';

interface BestAccountsProps {
    accounts: Account[];
    currentAccountId?: string;
    onSwitch?: (accountId: string) => void;
}

/** 从 quota_groups 中提取 5h 或 Weekly 桶百分比 (0-100) */
function getBucketPercentage(
    quotaGroups: QuotaGroup[] | undefined,
    category: 'gemini' | 'claude',
    targetWindow: '5h' | 'weekly'
): number | null {
    if (!quotaGroups || quotaGroups.length === 0) return null;

    for (const group of quotaGroups) {
        const name = (group.display_name || '').toLowerCase();
        const isTarget = category === 'claude'
            ? (name.includes('claude') || name.includes('gpt'))
            : (name.includes('gemini') || !name.includes('claude'));

        if (isTarget) {
            const bucket = group.buckets?.find(b => {
                const win = (b.window || '').toLowerCase();
                const id = (b.bucket_id || '').toLowerCase();
                if (targetWindow === 'weekly') {
                    return win.includes('week') || id.includes('week');
                } else {
                    return win.includes('5h') || id.includes('5h') || win.includes('hour') || id.includes('hour');
                }
            });

            if (bucket && typeof bucket.remaining_fraction === 'number') {
                return Math.round(bucket.remaining_fraction * 100);
            }
        }
    }
    return null;
}

function BestAccounts({ accounts, currentAccountId, onSwitch }: BestAccountsProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // 1. 获取按 5h 优先 + 周配额 Tie-breaker 排序的列表 (排除当前账号及已禁用账号)
    const geminiSorted = accounts
        .filter(a => a.id !== currentAccountId && !a.disabled && !a.proxy_disabled)
        .map(a => {
            const pro5hModel = findQuotaModel(a.quota?.models, 'gemini-pro')?.percentage ?? null;
            const flash5hModel = findQuotaModel(a.quota?.models, 'gemini-flash')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', '5h');

            // 5h 基础分：Pro 权重 70%，Flash 权重 30%；或以 group 5h 为准；无 5h 则以周配额回退
            let fiveHourScore = 0;
            if (pro5hModel !== null && flash5hModel !== null) {
                fiveHourScore = Math.round(pro5hModel * 0.7 + flash5hModel * 0.3);
            } else if (fiveHourGroup !== null) {
                fiveHourScore = fiveHourGroup;
            } else if (pro5hModel !== null) {
                fiveHourScore = pro5hModel;
            } else if (flash5hModel !== null) {
                fiveHourScore = flash5hModel;
            } else if (weeklyGroup !== null) {
                fiveHourScore = weeklyGroup;
            }

            const weeklyScore = weeklyGroup ?? 0;

            // 若周额度见底 (<= 5%)，直接淘汰
            if (weeklyGroup !== null && weeklyGroup <= 5) {
                fiveHourScore = 0;
            }

            return {
                ...a,
                fiveHourScore,
                weeklyScore,
                quotaVal: fiveHourScore,
            };
        })
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => {
            // 第一主序：5小时可用额度（当下立即可用）
            if (b.fiveHourScore !== a.fiveHourScore) {
                return b.fiveHourScore - a.fiveHourScore;
            }
            // 第二次序 (Tie-breaker)：周额度剩余更多者优先
            return b.weeklyScore - a.weeklyScore;
        });

    const claudeSorted = accounts
        .filter(a => a.id !== currentAccountId && !a.disabled && !a.proxy_disabled)
        .map(a => {
            const claude5hModel = findQuotaModel(a.quota?.models, 'claude')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', '5h');

            let fiveHourScore = fiveHourGroup ?? claude5hModel ?? weeklyGroup ?? 0;
            const weeklyScore = weeklyGroup ?? 0;

            // 若周额度见底 (<= 5%)，直接淘汰
            if (weeklyGroup !== null && weeklyGroup <= 5) {
                fiveHourScore = 0;
            }

            return {
                ...a,
                fiveHourScore,
                weeklyScore,
                quotaVal: fiveHourScore,
            };
        })
        .filter(a => a.quotaVal > 0)
        .sort((a, b) => {
            // 第一主序：5小时可用额度
            if (b.fiveHourScore !== a.fiveHourScore) {
                return b.fiveHourScore - a.fiveHourScore;
            }
            // 第二次序：周额度
            return b.weeklyScore - a.weeklyScore;
        });

    let bestGemini = geminiSorted[0];
    let bestClaude = claudeSorted[0];

    // 2. 如果推荐是同一个账号，且有其他选择，尝试寻找最优的"不同账号"组合
    if (bestGemini && bestClaude && bestGemini.id === bestClaude.id) {
        const nextGemini = geminiSorted[1];
        const nextClaude = claudeSorted[1];

        // 综合度量：5h 占主导地位 (x1000)，周配额辅助平衡
        const calcScore = (acc?: { fiveHourScore: number; weeklyScore: number }) =>
            acc ? acc.fiveHourScore * 1000 + acc.weeklyScore : 0;

        const scoreA = calcScore(bestGemini) + calcScore(nextClaude);
        const scoreB = calcScore(nextGemini) + calcScore(bestClaude);

        if (nextClaude && (!nextGemini || scoreA >= scoreB)) {
            // 选方案A：换 Claude
            bestClaude = nextClaude;
        } else if (nextGemini) {
            // 选方案B：换 Gemini
            bestGemini = nextGemini;
        }
    }

    // 构造最终用于显示的视图模型
    const bestGeminiRender = bestGemini ? {
        ...bestGemini,
        geminiQuota: bestGemini.quotaVal,
    } : undefined;

    const bestClaudeRender = bestClaude ? {
        ...bestClaude,
        claudeQuota: bestClaude.quotaVal,
    } : undefined;

    return (
        <div className="bg-white dark:bg-base-100 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-base-200 h-full flex flex-col">
            <h2 className="text-base font-semibold text-gray-900 dark:text-base-content mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                {t('dashboard.best_accounts')}
            </h2>

            <div className="space-y-2 flex-1">
                {/* Gemini 最佳 */}
                {bestGeminiRender && (
                    <div className="flex items-center justify-between p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30 transition-all hover:shadow-sm">
                        <div className="flex-1 min-w-0 pr-2">
                            <div className="text-[10px] text-green-600 dark:text-green-400 font-medium mb-0.5">
                                {t('dashboard.for_gemini')}
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
                                className="px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-full shadow-sm"
                                title={`${t('dashboard.quota_5h', '5h Quota')}: ${bestGeminiRender.geminiQuota}%`}
                            >
                                {bestGeminiRender.geminiQuota}%
                            </div>
                        </div>
                    </div>
                )}

                {/* Claude 最佳 */}
                {bestClaudeRender && (
                    <div className="flex items-center justify-between p-2.5 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-100 dark:border-cyan-900/30 transition-all hover:shadow-sm">
                        <div className="flex-1 min-w-0 pr-2">
                            <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium mb-0.5">
                                {t('dashboard.for_claude')}
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
                                className="px-2 py-0.5 bg-cyan-500 text-white text-xs font-semibold rounded-full shadow-sm"
                                title={`${t('dashboard.quota_5h', '5h Quota')}: ${bestClaudeRender.claudeQuota}%`}
                            >
                                {bestClaudeRender.claudeQuota}%
                            </div>
                        </div>
                    </div>
                )}

                {(!bestGeminiRender && !bestClaudeRender) && (
                    <div className="text-center py-4 text-gray-400 text-sm">
                        {t('accounts.no_data')}
                    </div>
                )}
            </div>

            {(bestGeminiRender || bestClaudeRender) && onSwitch && (
                <div className="mt-auto pt-3">
                    <button
                        className="w-full px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                        onClick={() => {
                            // 优先切换到 5h 配额更高的账号
                            let targetId = bestGeminiRender?.id;
                            if (bestClaudeRender && (!bestGeminiRender || bestClaudeRender.claudeQuota > bestGeminiRender.geminiQuota)) {
                                targetId = bestClaudeRender.id;
                            }

                            if (onSwitch && targetId) {
                                onSwitch(targetId);
                            }
                        }}
                    >
                        {t('dashboard.switch_best')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default BestAccounts;
