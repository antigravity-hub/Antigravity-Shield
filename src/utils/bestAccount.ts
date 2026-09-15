import { Account } from '../types/account';
import { findQuotaModel } from '../config/modelConfig';
import { getBucketPercentage, getAccountCycleReset } from './quota';

export interface RecommendedAccountResult {
    account: Account | null;
    geminiScore: number;
    claudeScore: number;
    weeklyScore: number;
    hasSafeBuffer: boolean;
    remainingMinutes: number;
}

export interface BestAccountOptions {
    /** 
     * Target category for selection:
     * - 'gemini': Select best account optimized for Gemini (Default)
     * - 'claude': Select best account optimized for Claude (prioritizes Opus/Sonnet)
     * - 'both': Compare overall highest
     */
    category?: 'gemini' | 'claude' | 'both';
    /** Minimum remaining minutes on 5h cycle to be considered in safe buffer (default: 20) */
    minResetMinutes?: number;
    /** Preferred Claude model filter if evaluating Claude (default: 'claude-opus') */
    targetClaudeModel?: string;
}

export interface ScoredCandidate {
    account: Account;
    fiveHourScore: number;
    weeklyScore: number;
    claudeScore: number;
    claudeWeeklyScore: number;
    geminiResetMinutes: number;
    geminiSafeBuffer: boolean;
    claudeResetMinutes: number;
    claudeSafeBuffer: boolean;
}

/**
 * Calculates the optimal recommended account based on real-time 5-hour quota,
 * safe reset window buffer (> 20m), and weekly quota tiebreakers (> 1% threshold).
 */
export function getRecommendedBestAccount(
    accounts: Account[],
    currentAccountId?: string,
    options: BestAccountOptions = {}
): RecommendedAccountResult {
    const {
        category = 'gemini',
        minResetMinutes = 20,
        targetClaudeModel = 'claude-opus',
    } = options;

    const candidates = accounts.filter(
        a => a.id !== currentAccountId && !a.disabled && !a.proxy_disabled
    );

    if (candidates.length === 0) {
        return {
            account: null,
            geminiScore: 0,
            claudeScore: 0,
            weeklyScore: 0,
            hasSafeBuffer: true,
            remainingMinutes: 0,
        };
    }

    const scored: ScoredCandidate[] = candidates.map(a => {
        // ── 1. Gemini Quota Calculation ──────────────────────────────────────
        // In Google Antigravity, Flash and Pro draw from the unified Gemini token bucket.
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

        const geminiReset = getAccountCycleReset(a, 'five_hour', 'gemini');
        const geminiMinutes = geminiReset.totalMinutes;
        // Safe buffer: either ready/unlimited, or remaining window is at least minResetMinutes
        const geminiSafeBuffer = geminiReset.isReady || geminiMinutes === 0 || geminiMinutes >= minResetMinutes;

        // ── 2. Claude Quota Calculation ──────────────────────────────────────
        const claudeTargetKeyword = targetClaudeModel ? targetClaudeModel.toLowerCase() : 'opus';
        const claudeOpusModel = a.quota?.models?.find(m => m.name.toLowerCase().includes(claudeTargetKeyword) || m.name.toLowerCase().includes('opus'))?.percentage ?? null;
        const claudeGeneralModel = findQuotaModel(a.quota?.models, 'claude')?.percentage ?? null;
        const claude5hGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', '5h');
        const claudeWeeklyGroup = getBucketPercentage(a.quota?.quota_groups, 'claude', 'weekly');

        let claudeScore = claude5hGroup ?? claudeOpusModel ?? claudeGeneralModel ?? claudeWeeklyGroup ?? 0;
        const claudeWeeklyScore = claudeWeeklyGroup ?? 0;

        // Disqualify Claude only if Claude weekly quota is depleted (< 1%)
        if (claudeWeeklyGroup !== null && claudeWeeklyGroup < 1) {
            claudeScore = 0;
        }

        const claudeReset = getAccountCycleReset(a, 'five_hour', 'claude');
        const claudeMinutes = claudeReset.totalMinutes;
        const claudeSafeBuffer = claudeReset.isReady || claudeMinutes === 0 || claudeMinutes >= minResetMinutes;

        return {
            account: a,
            fiveHourScore,
            weeklyScore,
            claudeScore,
            claudeWeeklyScore,
            geminiResetMinutes: geminiMinutes,
            geminiSafeBuffer,
            claudeResetMinutes: claudeMinutes,
            claudeSafeBuffer,
        };
    });

    // Sort according to requested category
    const sorted = [...scored].sort((a, b) => {
        if (category === 'claude') {
            // Claude sorting:
            // 1. Safe buffer (> 20m) takes priority
            if (a.claudeSafeBuffer !== b.claudeSafeBuffer) {
                return a.claudeSafeBuffer ? -1 : 1;
            }
            // 2. Highest 5h percentage
            if (b.claudeScore !== a.claudeScore) {
                return b.claudeScore - a.claudeScore;
            }
            // 3. Weekly tiebreaker
            return b.claudeWeeklyScore - a.claudeWeeklyScore;
        } else if (category === 'both') {
            // Overall combined/best comparison
            const scoreA = Math.max(a.fiveHourScore, a.claudeScore);
            const scoreB = Math.max(b.fiveHourScore, b.claudeScore);
            const safeA = a.fiveHourScore >= a.claudeScore ? a.geminiSafeBuffer : a.claudeSafeBuffer;
            const safeB = b.fiveHourScore >= b.claudeScore ? b.geminiSafeBuffer : b.claudeSafeBuffer;

            if (safeA !== safeB) return safeA ? -1 : 1;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return Math.max(b.weeklyScore, b.claudeWeeklyScore) - Math.max(a.weeklyScore, a.claudeWeeklyScore);
        } else {
            // Gemini (Default):
            // 1. Safe buffer (> 20m) takes priority
            if (a.geminiSafeBuffer !== b.geminiSafeBuffer) {
                return a.geminiSafeBuffer ? -1 : 1;
            }
            // 2. Highest 5h percentage
            if (b.fiveHourScore !== a.fiveHourScore) {
                return b.fiveHourScore - a.fiveHourScore;
            }
            // 3. Weekly tiebreaker
            return b.weeklyScore - a.weeklyScore;
        }
    });

    const best = sorted[0];
    const isClaude = category === 'claude';
    return {
        account: best ? best.account : null,
        geminiScore: best ? best.fiveHourScore : 0,
        claudeScore: best ? best.claudeScore : 0,
        weeklyScore: best ? (isClaude ? best.claudeWeeklyScore : best.weeklyScore) : 0,
        hasSafeBuffer: best ? (isClaude ? best.claudeSafeBuffer : best.geminiSafeBuffer) : true,
        remainingMinutes: best ? (isClaude ? best.claudeResetMinutes : best.geminiResetMinutes) : 0,
    };
}
