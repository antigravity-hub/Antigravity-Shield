import { Account } from '../types/account';

export interface ResetCycleInfo {
    resetTime: string | null;
    totalHours: number;
    totalMinutes: number;
    daysRemaining: number;
    hoursInDay: number;
    minutesInHour: number;
    isReady: boolean;
}

/**
 * Extracts and calculates cycle reset information for an account given a target window type.
 * windowType: 'week' for 7-day quota groups, or '5h' / 'hour' for 5-hour quota groups.
 */
export function getAccountCycleReset(
    account: Account,
    windowType: 'weekly' | 'five_hour'
): ResetCycleInfo {
    let resetTime: string | null = null;
    let minDiffMs = Infinity;
    const now = Date.now();

    // 1. Check bucket inside quota_groups
    if (account.quota?.quota_groups) {
        for (const group of account.quota.quota_groups) {
            for (const b of group.buckets || []) {
                const bWindow = (b.window || '').toLowerCase();
                const bId = (b.bucket_id || '').toLowerCase();

                const matches =
                    windowType === 'weekly'
                        ? bWindow.includes('week') || bId.includes('week')
                        : bWindow.includes('5h') || bWindow.includes('5 hour') || bId.includes('5h') || bId.includes('five');

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

    if (!resetTime) {
        return {
            resetTime: null,
            totalHours: 0,
            totalMinutes: 0,
            daysRemaining: 0,
            hoursInDay: 0,
            minutesInHour: 0,
            isReady: true,
        };
    }

    const diffMs = new Date(resetTime).getTime() - now;
    if (diffMs <= 0) {
        return {
            resetTime,
            totalHours: 0,
            totalMinutes: 0,
            daysRemaining: 0,
            hoursInDay: 0,
            minutesInHour: 0,
            isReady: true,
        };
    }

    const totalMinutes = Math.ceil(diffMs / (1000 * 60));
    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const daysRemaining = Math.floor(totalHours / 24);
    const hoursInDay = totalHours % 24;
    const minutesInHour = totalMinutes % 60;

    return {
        resetTime,
        totalHours,
        totalMinutes,
        daysRemaining,
        hoursInDay,
        minutesInHour,
        isReady: false,
    };
}

/**
 * Convenient wrapper to calculate weekly reset cycle for an account.
 */
export function getAccountWeeklyReset(account: Account): ResetCycleInfo {
    return getAccountCycleReset(account, 'weekly');
}

/**
 * Convenient wrapper to calculate 5-hour reset cycle for an account.
 */
export function getAccountFiveHourReset(account: Account): ResetCycleInfo {
    return getAccountCycleReset(account, 'five_hour');
}
