import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle2 } from 'lucide-react';
import { Account } from '../../types/account';
import { cn } from '../../utils/cn';

interface WeeklyCountdownProps {
    account: Account;
    layout?: 'table' | 'card';
    className?: string;
}

export interface WeeklyResetInfo {
    resetTime: string | null;
    totalHours: number;
    daysRemaining: number;
    hoursInDay: number;
    isReady: boolean;
}

/**
 * Extracts and calculates weekly reset cycle data for an account
 */
export function getAccountWeeklyReset(account: Account): WeeklyResetInfo {
    let resetTime: string | null = null;
    let minDiffMs = Infinity;
    const now = Date.now();

    // 1. Check weekly bucket inside quota_groups first
    if (account.quota?.quota_groups) {
        for (const group of account.quota.quota_groups) {
            for (const b of group.buckets || []) {
                const isWeeklyBucket =
                    b.window?.toLowerCase().includes('week') ||
                    b.bucket_id?.toLowerCase().includes('week');

                if (isWeeklyBucket && b.reset_time) {
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

    // 2. Fallback to model reset_time if no quota_groups bucket found
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
            daysRemaining: 0,
            hoursInDay: 0,
            isReady: true,
        };
    }

    const diffMs = new Date(resetTime).getTime() - now;
    if (diffMs <= 0) {
        return {
            resetTime,
            totalHours: 0,
            daysRemaining: 0,
            hoursInDay: 0,
            isReady: true,
        };
    }

    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
    // 7-day cycle: e.g. 7, 6, 5, 4, 3, 2, 1
    const daysRemaining = Math.min(7, Math.max(1, Math.ceil(totalHours / 24)));
    const hoursInDay = totalHours % 24;

    return {
        resetTime,
        totalHours,
        daysRemaining,
        hoursInDay,
        isReady: false,
    };
}

export function WeeklyCountdown({
    account,
    layout = 'table',
    className,
}: WeeklyCountdownProps) {
    const { t } = useTranslation();
    const info = useMemo(() => getAccountWeeklyReset(account), [account]);

    // 7-day stepper array: 7 down to 1
    const weekDays = [7, 6, 5, 4, 3, 2, 1];

    if (info.isReady) {
        return (
            <div
                className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 select-none shadow-xs transition-all",
                    className
                )}
                title={t('accounts.weekly_reset_ready', 'Weekly Quota is Fresh / Ready (0h remaining)')}
            >
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="text-[11px] font-mono font-bold">0h</span>
                <span className="text-[10px] opacity-85 font-medium">{t('common.ready', 'Ready')}</span>
            </div>
        );
    }

    const tooltipText = `${info.totalHours}h remaining (${info.daysRemaining} days left in 7-day cycle)\nReset: ${new Date(info.resetTime!).toLocaleString()}`;

    if (layout === 'card') {
        return (
            <div
                className={cn(
                    "flex flex-col gap-1.5 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 transition-all",
                    className
                )}
                title={tooltipText}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-500" />
                        <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">
                            {info.totalHours}h
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {t('accounts.weekly_remaining', 'remaining')}
                        </span>
                    </div>
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        {info.daysRemaining} / 7d
                    </span>
                </div>

                {/* 7-day Stepper (7 6 5 4 3 2 1) */}
                <div className="flex items-center justify-between gap-1 w-full pt-0.5">
                    {weekDays.map((dayNum) => {
                        const isCurrentDay = dayNum === info.daysRemaining;
                        const isPassedDay = dayNum > info.daysRemaining;
                        const isUpcomingDay = dayNum < info.daysRemaining;

                        return (
                            <div
                                key={dayNum}
                                className={cn(
                                    "flex-1 h-6 rounded-md text-[10px] font-mono font-bold flex items-center justify-center transition-all relative select-none",
                                    isCurrentDay && "bg-gradient-to-t from-cyan-600 to-emerald-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.65)] ring-1 ring-cyan-300 scale-105 z-10",
                                    isPassedDay && "bg-slate-200/60 dark:bg-slate-700/40 text-slate-400 dark:text-slate-500 line-through opacity-50",
                                    isUpcomingDay && "bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300"
                                )}
                            >
                                {dayNum}
                                {isCurrentDay && (
                                    <span className="absolute -top-1 -right-0.5 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_4px_#34d399]"></span>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Table view (compact, stylish)
    return (
        <div
            className={cn("flex flex-col gap-1 select-none", className)}
            title={tooltipText}
        >
            <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
                <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                    {info.totalHours}h
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    ({info.daysRemaining}d)
                </span>
            </div>

            {/* 7-day Stepper (7 6 5 4 3 2 1) */}
            <div className="flex items-center gap-0.5">
                {weekDays.map((dayNum) => {
                    const isCurrentDay = dayNum === info.daysRemaining;
                    const isPassedDay = dayNum > info.daysRemaining;
                    const isUpcomingDay = dayNum < info.daysRemaining;

                    return (
                        <div
                            key={dayNum}
                            className={cn(
                                "w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition-all relative",
                                isCurrentDay && "bg-gradient-to-t from-cyan-600 to-emerald-400 text-white shadow-[0_0_8px_rgba(6,182,212,0.6)] ring-1 ring-cyan-300 scale-110 z-10",
                                isPassedDay && "bg-slate-200/50 dark:bg-slate-700/40 text-slate-400 dark:text-slate-500 line-through opacity-50",
                                isUpcomingDay && "border border-slate-200/80 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/40"
                            )}
                        >
                            {dayNum}
                            {isCurrentDay && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
