import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle2, Sparkles, Bot } from 'lucide-react';
import { Account } from '../../types/account';
import { cn } from '../../utils/cn';
import { getAccountWeeklyReset, getWeeklyTokenQuota, ResetCycleInfo } from '../../utils/quota';

interface WeeklyCountdownProps {
    account: Account;
    provider?: 'gemini' | 'claude';
    layout?: 'table' | 'card';
    className?: string;
}

export type WeeklyResetInfo = ResetCycleInfo;
export { getAccountWeeklyReset };

export function WeeklyCountdown({
    account,
    provider = 'gemini',
    layout = 'table',
    className,
}: WeeklyCountdownProps) {
    const { t } = useTranslation();
    const info = useMemo(() => getAccountWeeklyReset(account, provider), [account, provider]);
    const quota = useMemo(() => getWeeklyTokenQuota(account, provider), [account, provider]);

    // 7-day stepper array: 1 to 7 (Left to Right, drains from right to left)
    const weekDays = [1, 2, 3, 4, 5, 6, 7];

    if (!info.isAvailable) {
        return (
            <div
                className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 text-slate-400 dark:text-slate-500 text-[10px] select-none",
                    className
                )}
                title={t('accounts.provider_not_available', 'Claude quota is not available on Free tier')}
            >
                <Sparkles className="w-3 h-3 opacity-40 shrink-0" />
                <span className="font-medium">N/A (Free)</span>
            </div>
        );
    }

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

    const tooltipText = `${provider.toUpperCase()} Reset: ${info.totalHours}h remaining (${info.daysRemaining}d ${info.hoursInDay}h left in 7-day cycle)\nWeekly Token Quota: ${quota.percentage !== null ? `${quota.percentage}%` : 'N/A'}\nReset: ${new Date(info.resetTime!).toLocaleString()}`;

    // Exact fractional days remaining (0 to 7)
    const exactDays = info.exactDaysRemaining;

    // Card Layout (Generous, full fluid wave & burning fuse bar)
    if (layout === 'card') {
        return (
            <div
                className={cn(
                    "flex flex-col gap-2 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 transition-all",
                    className
                )}
                title={tooltipText}
            >
                {/* Header: Time countdown without redundant (6d) */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">
                            {info.totalHours}h
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {t('accounts.weekly_remaining', 'remaining')}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-semibold">
                        {provider === 'claude' ? (
                            <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                        ) : (
                            <Bot className="w-2.5 h-2.5 text-cyan-500" />
                        )}
                        <span className="capitalize">{provider}</span>
                    </div>
                </div>

                {/* 7-day Stepper Boxes: 1 to 7 Left to Right, draining from Right to Left with partial liquid water & wave */}
                <div dir="ltr" className="flex items-center justify-between gap-1 w-full">
                    {weekDays.map((dayNum) => {
                        // Day calculation:
                        // If exactDays >= dayNum: 100% full
                        // If exactDays <= dayNum - 1: 0% full (empty)
                        // If dayNum - 1 < exactDays < dayNum: active draining day with partial water fill!
                        const isFull = exactDays >= dayNum;
                        const isEmpty = exactDays <= dayNum - 1;
                        const isActive = !isFull && !isEmpty;

                        // Fill percentage inside this specific day box (0% to 100%)
                        let fillPercentage = 0;
                        if (isFull) {
                            fillPercentage = 100;
                        } else if (isActive) {
                            fillPercentage = Math.max(4, Math.min(96, Math.round((exactDays - (dayNum - 1)) * 100)));
                        }

                        return (
                            <div
                                key={dayNum}
                                className={cn(
                                    "flex-1 h-6 rounded-md text-[10px] font-mono font-bold flex items-center justify-center transition-all relative overflow-hidden select-none border",
                                    isFull && "border-cyan-500/35 dark:border-cyan-400/40 bg-gradient-to-t from-cyan-600 to-emerald-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.35)]",
                                    isEmpty && "bg-slate-100/60 dark:bg-slate-800/40 border-dashed border-slate-200/80 dark:border-slate-700/50 text-slate-300 dark:text-slate-600 opacity-40 line-through",
                                    isActive && "border-cyan-400/80 dark:border-cyan-400 bg-slate-100/80 dark:bg-slate-800/60 ring-1 ring-cyan-400/60 shadow-[0_0_10px_rgba(6,182,212,0.45)] scale-105 z-10 text-white"
                                )}
                                title={`Day ${dayNum}: ${isFull ? '100% (Upcoming)' : isEmpty ? '0% (Passed)' : `${fillPercentage}% water remaining`}`}
                            >
                                {/* Active Day Liquid Water Fill */}
                                {isActive && (
                                    <>
                                        {/* Water fluid layer filling up to fillPercentage */}
                                        <div
                                            className="absolute inset-y-0 left-0 bg-gradient-to-t from-cyan-600 via-cyan-500 to-emerald-400 z-0 transition-all duration-300"
                                            style={{ width: `${fillPercentage}%` }}
                                        />

                                        {/* Oscillating soft wave ripple on the right meniscus edge */}
                                        <div
                                            className="absolute inset-y-0 w-2.5 z-1 pointer-events-none flex items-center justify-center opacity-85"
                                            style={{ left: `calc(${fillPercentage}% - 5px)` }}
                                        >
                                            {/* Vertical gentle sine-wave oscillation */}
                                            <svg
                                                className="w-full h-full text-emerald-200 animate-pulse"
                                                viewBox="0 0 10 30"
                                                preserveAspectRatio="none"
                                            >
                                                <path
                                                    d="M 3,0 Q 8,7.5 3,15 Q -2,22.5 3,30 L 6,30 Q 1,22.5 6,15 Q 11,7.5 6,0 Z"
                                                    fill="currentColor"
                                                    opacity="0.7"
                                                />
                                            </svg>
                                        </div>

                                        {/* Surface reflection shimmer on top */}
                                        <div
                                            className="absolute top-0 left-0 h-[2px] bg-white/40 z-1 pointer-events-none"
                                            style={{ width: `${fillPercentage}%` }}
                                        />
                                    </>
                                )}

                                {/* Centered Day Number */}
                                <span className={cn(
                                    "relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]",
                                    isEmpty && "drop-shadow-none text-slate-300 dark:text-slate-600"
                                )}>
                                    {dayNum}
                                </span>

                                {/* Ping indicator on the active draining day */}
                                {isActive && (
                                    <span className="absolute -top-1 -right-0.5 flex h-2 w-2 z-20 pointer-events-none">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_4px_#34d399]"></span>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Burning Fuse Bar (#93b93b) under the 7 boxes with ember glow and percentage on the right */}
                <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex-1 relative flex items-center">
                        {/* Background track */}
                        <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden relative shadow-inner">
                            {/* Burning Fuse Progress Bar in vibrant #93b93b */}
                            <div
                                className="h-full rounded-full transition-all duration-500 relative"
                                style={{
                                    width: `${Math.min(100, Math.max(0, quota.percentage ?? 0))}%`,
                                    background: 'linear-gradient(90deg, rgba(147, 185, 59, 0.75) 0%, #93b93b 80%, #a8cf44 100%)',
                                    boxShadow: '0 0 6px rgba(147, 185, 59, 0.45)',
                                }}
                            />
                        </div>

                        {/* Burning Ember / Spark Tip at the edge of the burning fuse */}
                        {(quota.percentage ?? 0) > 0 && (
                            <div
                                className="absolute top-1/2 -translate-y-1/2 pointer-events-none -ml-1 transition-all duration-500 z-10"
                                style={{ left: `${Math.min(99, Math.max(1, quota.percentage ?? 0))}%` }}
                            >
                                <span className="relative flex h-2 w-2">
                                    <span
                                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-80"
                                        style={{ backgroundColor: '#93b93b' }}
                                    />
                                    <span
                                        className="relative inline-flex rounded-full h-2 w-2 shadow-[0_0_8px_#93b93b,0_0_3px_#ffffff]"
                                        style={{ backgroundColor: '#d4ed73' }}
                                    />
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Percentage counter on the right */}
                    <span
                        className="text-[11px] font-mono font-extrabold shrink-0 drop-shadow-xs min-w-[32px] text-right"
                        style={{ color: '#93b93b' }}
                        title={`${t('accounts.quota_weekly', 'Weekly Quota')}: ${quota.percentage ?? 0}%`}
                    >
                        {quota.percentage !== null ? `${quota.percentage}%` : '0%'}
                    </span>
                </div>
            </div>
        );
    }

    // Table view (Compact with partial water fill & mini burning bar)
    return (
        <div
            className={cn("flex flex-col gap-1 select-none", className)}
            title={tooltipText}
        >
            {/* Header: Clock + Remaining Hours without redundant (6d) */}
            <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
                <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                    {info.totalHours}h
                </span>
            </div>

            {/* 7-day Stepper: Compact Left to Right */}
            <div dir="ltr" className="flex items-center gap-[1.5px]">
                {weekDays.map((dayNum) => {
                    const isFull = exactDays >= dayNum;
                    const isEmpty = exactDays <= dayNum - 1;
                    const isActive = !isFull && !isEmpty;

                    let fillPercentage = 0;
                    if (isFull) {
                        fillPercentage = 100;
                    } else if (isActive) {
                        fillPercentage = Math.max(5, Math.min(95, Math.round((exactDays - (dayNum - 1)) * 100)));
                    }

                    return (
                        <div
                            key={dayNum}
                            className={cn(
                                "w-3.5 h-3.5 rounded text-[8px] font-mono font-bold flex items-center justify-center transition-all relative overflow-hidden border",
                                isFull && "border-cyan-500/35 dark:border-cyan-400/35 bg-gradient-to-t from-cyan-600 to-emerald-500 text-white shadow-[0_0_6px_rgba(6,182,212,0.4)]",
                                isEmpty && "bg-slate-100/70 dark:bg-slate-800/40 border-dashed border-slate-200/80 dark:border-slate-700/60 text-slate-300 dark:text-slate-600 opacity-40 line-through",
                                isActive && "border-cyan-400 bg-slate-100 dark:bg-slate-800/60 ring-1 ring-cyan-400 scale-110 z-10 text-white shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                            )}
                        >
                            {/* Water layer for active day */}
                            {isActive && (
                                <div
                                    className="absolute inset-y-0 left-0 bg-gradient-to-t from-cyan-600 to-emerald-400 z-0"
                                    style={{ width: `${fillPercentage}%` }}
                                />
                            )}

                            <span className={cn(
                                "relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]",
                                isEmpty && "drop-shadow-none text-slate-300 dark:text-slate-600"
                            )}>
                                {dayNum}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Mini Burning Fuse Bar for Table */}
            <div className="flex items-center gap-1 w-[90px] pt-0.5">
                <div className="flex-1 h-1 rounded-full bg-slate-200/80 dark:bg-slate-700/60 overflow-hidden relative shadow-inner">
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                            width: `${Math.min(100, Math.max(0, quota.percentage ?? 0))}%`,
                            background: '#93b93b',
                            boxShadow: '0 0 4px #93b93b',
                        }}
                    />
                </div>
                <span
                    className="text-[9px] font-mono font-bold shrink-0 leading-none"
                    style={{ color: '#93b93b' }}
                >
                    {quota.percentage !== null ? `${quota.percentage}%` : '0%'}
                </span>
            </div>
        </div>
    );
}
