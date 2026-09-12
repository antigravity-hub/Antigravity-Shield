import { Account } from '../types/account';
import { findQuotaModel } from '../config/modelConfig';
import { getBucketPercentage } from './quota';

export interface RecommendedAccountResult {
    account: Account | null;
    geminiScore: number;
    claudeScore: number;
    weeklyScore: number;
}

/**
 * Calculates the optimal recommended account based on real-time 5-hour quota
 * (weighted 70% Gemini Pro + 30% Gemini Flash) and weekly quota tiebreakers.
 */
export function getRecommendedBestAccount(
    accounts: Account[],
    currentAccountId?: string
): RecommendedAccountResult {
    const candidates = accounts.filter(
        a => a.id !== currentAccountId && !a.disabled && !a.proxy_disabled
    );

    if (candidates.length === 0) {
        return {
            account: null,
            geminiScore: 0,
            claudeScore: 0,
            weeklyScore: 0,
        };
    }

    const scored = candidates
        .map(a => {
            const pro5h = findQuotaModel(a.quota?.models, 'gemini-pro')?.percentage ?? null;
            const flash5h = findQuotaModel(a.quota?.models, 'gemini-flash')?.percentage ?? null;
            const weeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', 'weekly');
            const fiveHourGroup = getBucketPercentage(a.quota?.quota_groups, 'gemini', '5h');

            let fiveHourScore = 0;
            if (pro5h !== null && flash5h !== null) {
                fiveHourScore = Math.round(pro5h * 0.7 + flash5h * 0.3);
            } else if (fiveHourGroup !== null) {
                fiveHourScore = fiveHourGroup;
            } else if (pro5h !== null) {
                fiveHourScore = pro5h;
            } else if (flash5h !== null) {
                fiveHourScore = flash5h;
            } else if (weeklyGroup !== null) {
                fiveHourScore = weeklyGroup;
            }

            const weeklyScore = weeklyGroup ?? 0;
            // If weekly quota is exhausted (<= 5%), disqualify
            if (weeklyGroup !== null && weeklyGroup <= 5) {
                fiveHourScore = 0;
            }

            const claude5h = findQuotaModel(a.quota?.models, 'claude')?.percentage ?? null;
            const claudeWeekly = getBucketPercentage(a.quota?.quota_groups, 'claude', 'weekly');
            const claudeScore = claude5h ?? claudeWeekly ?? 0;

            return {
                account: a,
                fiveHourScore,
                weeklyScore,
                claudeScore,
            };
        })
        .sort((a, b) => {
            if (b.fiveHourScore !== a.fiveHourScore) {
                return b.fiveHourScore - a.fiveHourScore;
            }
            return b.weeklyScore - a.weeklyScore;
        });

    const best = scored[0];
    return {
        account: best ? best.account : null,
        geminiScore: best ? best.fiveHourScore : 0,
        claudeScore: best ? best.claudeScore : 0,
        weeklyScore: best ? best.weeklyScore : 0,
    };
}
