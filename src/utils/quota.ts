import { Account, QuotaGroup } from '../types/account';

export interface ResetCycleInfo {
    resetTime: string | null;
    totalHours: number;
    totalMinutes: number;
    exactDaysRemaining: number;
    daysRemaining: number;
    hoursInDay: number;
    minutesInHour: number;
    isReady: boolean;
    isAvailable?: boolean;
}

/**
 * Converts remaining fraction (0.0 ..= 1.0) into integer percentage with strict non-rounding ceiling.
 * If even a small fraction of quota is consumed (fraction < 1.0), it strictly caps at 99%
 * so users immediately recognize consumption has started.
 */
export function safeQuotaPercentage(fraction?: number | null): number {
    if (fraction === undefined || fraction === null || isNaN(fraction)) return 0;
    if (fraction >= 1.0) return 100;
    if (fraction <= 0.0) return 0;
    const raw = fraction * 100;
    if (raw > 99) return 99;
    return Math.round(raw);
}

/**
 * Extracts and calculates cycle reset information for an account given a target window type and model category.
 * windowType: 'weekly' for 7-day quota groups, or 'five_hour' for 5-hour quota groups.
 * category: 'gemini' | 'claude' (default: 'gemini')
 */
export function getAccountCycleReset(
    account: Account,
    windowType: 'weekly' | 'five_hour',
    category: 'gemini' | 'claude' = 'gemini'
): ResetCycleInfo {
    let resetTime: string | null = null;
    let minDiffMs = Infinity;
    const now = Date.now();
    let hasMatchingCategory = false;

    // 1. Check bucket inside quota_groups
    if (account.quota?.quota_groups) {
        for (const group of account.quota.quota_groups) {
            const name = (group.display_name || '').toLowerCase();
            const isCategory = category === 'claude'
                ? (name.includes('claude') || name.includes('gpt'))
                : (name.includes('gemini') || !name.includes('claude'));

            if (!isCategory) continue;
            hasMatchingCategory = true;

            for (const b of group.buckets || []) {
                const bWindow = (b.window || '').toLowerCase();
                const bId = (b.bucket_id || '').toLowerCase();
                const bDisplay = (b.display_name || '').toLowerCase();

                const isWeekly = bWindow.includes('week') || bId.includes('week') || bDisplay.includes('week') || bWindow.includes('168') || bId.includes('168') || bWindow.includes('7d') || bId.includes('7d');
                const is5h = (bWindow.includes('5h') || bId.includes('5h') || bDisplay.includes('5h') || bWindow.includes('5 hour') || bDisplay.includes('5 hour') || bId.includes('5 hour') || bWindow.includes('five') || bId.includes('five') || bWindow.includes('18000') || bId.includes('18000')) ||
                    (!isWeekly && (bWindow.includes('hour') || bId.includes('hour') || bDisplay.includes('hour')));

                const matches = windowType === 'weekly' ? isWeekly : (is5h && !isWeekly);

                if (matches && b.reset_time) {
                    const target = new Date(b.reset_time).getTime();
                    const diff = target - now;
                    if (diff > 0 && diff < minDiffMs) {
                        minDiffMs = diff;
                        resetTime = b.reset_time;
                    } else if (!resetTime) {
                        resetTime = b.reset_time;
                    }
                }
            }
        }
    }

    // 2. Fallback to model reset_time if no matching quota_groups bucket found
    if (!resetTime && account.quota?.models) {
        for (const m of account.quota.models) {
            const mName = m.name.toLowerCase();
            const isCategory = category === 'claude'
                ? (mName.startsWith('claude') || mName.startsWith('gpt'))
                : (mName.startsWith('gemini') || !mName.startsWith('claude'));

            if (!isCategory) continue;
            hasMatchingCategory = true;

            if (m.reset_time) {
                const target = new Date(m.reset_time).getTime();
                const diff = target - now;
                if (diff > 0 && diff < minDiffMs) {
                    minDiffMs = diff;
                    resetTime = m.reset_time;
                }
            }
        }
    }

    // If Claude requested, but account has no Claude group or models (e.g. Free accounts)
    if (category === 'claude' && !hasMatchingCategory) {
        return {
            resetTime: null,
            totalHours: 0,
            totalMinutes: 0,
            exactDaysRemaining: 0,
            daysRemaining: 0,
            hoursInDay: 0,
            minutesInHour: 0,
            isReady: false,
            isAvailable: false,
        };
    }

    if (!resetTime) {
        return {
            resetTime: null,
            totalHours: 0,
            totalMinutes: 0,
            exactDaysRemaining: 0,
            daysRemaining: 0,
            hoursInDay: 0,
            minutesInHour: 0,
            isReady: true,
            isAvailable: true,
        };
    }

    const diffMs = new Date(resetTime).getTime() - now;
    if (diffMs <= 0) {
        return {
            resetTime,
            totalHours: 0,
            totalMinutes: 0,
            exactDaysRemaining: 0,
            daysRemaining: 0,
            hoursInDay: 0,
            minutesInHour: 0,
            isReady: true,
            isAvailable: true,
        };
    }

    const exactDaysRemaining = Math.max(0, Math.min(7, diffMs / (24 * 60 * 60 * 1000)));
    const totalMinutes = Math.max(0, Math.ceil(diffMs / (1000 * 60)));
    const totalHours = Math.floor(totalMinutes / 60);
    const daysRemaining = Math.floor(totalHours / 24);
    const hoursInDay = totalHours % 24;
    const minutesInHour = totalMinutes % 60;

    return {
        resetTime,
        totalHours,
        totalMinutes,
        exactDaysRemaining,
        daysRemaining,
        hoursInDay,
        minutesInHour,
        isReady: false,
        isAvailable: true,
    };
}

/**
 * Convenient wrapper to calculate weekly reset cycle for an account.
 */
export function getAccountWeeklyReset(
    account: Account,
    category: 'gemini' | 'claude' = 'gemini'
): ResetCycleInfo {
    return getAccountCycleReset(account, 'weekly', category);
}

/**
 * Convenient wrapper to calculate 5-hour reset cycle for an account.
 */
export function getAccountFiveHourReset(
    account: Account,
    category: 'gemini' | 'claude' = 'gemini'
): ResetCycleInfo {
    return getAccountCycleReset(account, 'five_hour', category);
}

/**
 * Returns the weekly token quota percentage (0-100) and whether the provider is available on this account.
 */
export function getWeeklyTokenQuota(
    account: Account,
    category: 'gemini' | 'claude' = 'gemini'
): { percentage: number | null; isAvailable: boolean } {
    if (!account.quota) return { percentage: null, isAvailable: false };

    // Check availability for Claude (e.g. Free accounts do not support Claude)
    const claudeGroup = (account.quota.quota_groups || []).find(g => {
        const name = (g.display_name || '').toLowerCase();
        return name.includes('claude') || name.includes('gpt');
    });
    const claudeModels = (account.quota.models || []).filter(m => {
        const name = m.name.toLowerCase();
        return name.startsWith('claude') || name.startsWith('gpt');
    });
    const isClaudeAvailable = Boolean(claudeGroup || claudeModels.length > 0);

    if (category === 'claude' && !isClaudeAvailable) {
        return { percentage: null, isAvailable: false };
    }

    const bucketPct = getBucketPercentage(account.quota.quota_groups, category, 'weekly');
    if (bucketPct !== null) {
        return { percentage: bucketPct, isAvailable: true };
    }

    // Fallback to average of models for that category
    const targetModels = (account.quota.models || []).filter(m => {
        const name = m.name.toLowerCase();
        return category === 'claude'
            ? (name.startsWith('claude') || name.startsWith('gpt'))
            : (name.startsWith('gemini') || !name.startsWith('claude'));
    });

    if (targetModels.length > 0) {
        const sum = targetModels.reduce((acc, m) => acc + (m.percentage ?? 0), 0);
        return { percentage: Math.round(sum / targetModels.length), isAvailable: true };
    }

    return { percentage: null, isAvailable: true };
}

/**
 * Extracts percentage (0-100) for a given category ('gemini' | 'claude') and window ('5h' | 'weekly') from quota_groups.
 */
export function getBucketPercentage(
    quotaGroups: QuotaGroup[] | undefined,
    category: 'gemini' | 'claude',
    targetWindow: '5h' | 'weekly'
): number | null {
    if (!quotaGroups || quotaGroups.length === 0) return null;

    const findMatchingBucket = (group: QuotaGroup) => {
        return group.buckets?.find(b => {
            const win = (b.window || '').toLowerCase();
            const id = (b.bucket_id || '').toLowerCase();
            const dName = (b.display_name || '').toLowerCase();

            const isWeekly = win.includes('week') || id.includes('week') || dName.includes('week') || win.includes('168') || id.includes('168') || win.includes('7d') || id.includes('7d');
            const is5h = (win.includes('5h') || id.includes('5h') || dName.includes('5h') || win.includes('5 hour') || dName.includes('5 hour') || id.includes('5 hour') || win.includes('five') || id.includes('five') || win.includes('18000') || id.includes('18000')) ||
                (!isWeekly && (win.includes('hour') || id.includes('hour') || dName.includes('hour')));

            return targetWindow === 'weekly' ? isWeekly : (is5h && !isWeekly);
        });
    };

    // 1. Try explicit matching groups first
    for (const group of quotaGroups) {
        const name = (group.display_name || '').toLowerCase();
        const isExplicit = category === 'claude'
            ? (name.includes('claude') || name.includes('gpt'))
            : name.includes('gemini');

        if (isExplicit) {
            const bucket = findMatchingBucket(group);
            if (bucket && typeof bucket.remaining_fraction === 'number') {
                return safeQuotaPercentage(bucket.remaining_fraction);
            }
        }
    }

    // 2. Fallback for gemini if no group explicitly named "gemini" exists
    if (category === 'gemini') {
        for (const group of quotaGroups) {
            const name = (group.display_name || '').toLowerCase();
            if (!name.includes('claude') && !name.includes('gpt')) {
                const bucket = findMatchingBucket(group);
                if (bucket && typeof bucket.remaining_fraction === 'number') {
                    return safeQuotaPercentage(bucket.remaining_fraction);
                }
            }
        }
    }

    return null;
}

/**
 * Determines whether an account's quota is completely exhausted (0% weekly and 0% 5-hour)
 * across both Gemini and Claude (or where Claude is unavailable/unsupported).
 * If the weekly cycle timer has already elapsed (isReady === true), the account is considered
 * eligible for fresh quota and not locked out.
 */
export function isAccountQuotaExhausted(account: Account): boolean {
    if (!account.quota) return false;

    // If weekly cycle has ended (timer finished and ready for reset), not exhausted
    const weeklyReset = getAccountWeeklyReset(account);
    if (weeklyReset.isReady) {
        return false;
    }

    // 1. Evaluate Gemini Quota
    const geminiWeekly = getBucketPercentage(account.quota.quota_groups, 'gemini', 'weekly');
    const gemini5h = getBucketPercentage(account.quota.quota_groups, 'gemini', '5h');

    const geminiModels = (account.quota.models || []).filter(m =>
        m.name.toLowerCase().startsWith('gemini')
    );
    const hasGeminiModels = geminiModels.length > 0;
    const allGeminiModelsZero = hasGeminiModels && geminiModels.every(m => (m.percentage ?? 0) <= 0);

    let isGeminiExhausted = false;
    if (geminiWeekly !== null && gemini5h !== null) {
        isGeminiExhausted = geminiWeekly <= 0 && gemini5h <= 0;
    } else if (geminiWeekly !== null) {
        isGeminiExhausted = geminiWeekly <= 0 && (gemini5h === 0 || allGeminiModelsZero);
    } else if (gemini5h !== null) {
        isGeminiExhausted = gemini5h <= 0 && allGeminiModelsZero;
    } else if (hasGeminiModels) {
        isGeminiExhausted = allGeminiModelsZero;
    }

    // If Gemini is not exhausted, the account still has usable Gemini quota
    if (!isGeminiExhausted) {
        return false;
    }

    // 2. Evaluate Claude Availability & Quota
    const claudeGroup = (account.quota.quota_groups || []).find(g => {
        const name = (g.display_name || '').toLowerCase();
        return name.includes('claude') || name.includes('gpt');
    });

    const claudeModels = (account.quota.models || []).filter(m => {
        const name = m.name.toLowerCase();
        return name.startsWith('claude') || name.startsWith('gpt');
    });

    const isClaudeAvailable = Boolean(claudeGroup || claudeModels.length > 0);

    // If Claude is not available on this account (e.g. Free tier), Gemini exhaustion determines state
    if (!isClaudeAvailable) {
        return true;
    }

    // If Claude is available, both Claude weekly and Claude 5-hour must also be exhausted
    const claudeWeekly = getBucketPercentage(account.quota.quota_groups, 'claude', 'weekly');
    const claude5h = getBucketPercentage(account.quota.quota_groups, 'claude', '5h');
    const allClaudeModelsZero = claudeModels.length > 0 && claudeModels.every(m => (m.percentage ?? 0) <= 0);

    let isClaudeExhausted = false;
    if (claudeWeekly !== null && claude5h !== null) {
        isClaudeExhausted = claudeWeekly <= 0 && claude5h <= 0;
    } else if (claudeWeekly !== null) {
        isClaudeExhausted = claudeWeekly <= 0 && (claude5h === 0 || allClaudeModelsZero);
    } else if (claude5h !== null) {
        isClaudeExhausted = claude5h <= 0 && allClaudeModelsZero;
    } else if (claudeModels.length > 0) {
        isClaudeExhausted = allClaudeModelsZero;
    }

    return isClaudeExhausted;
}

