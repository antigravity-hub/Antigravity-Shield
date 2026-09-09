import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DailyTokenActivity {
    date: string; // YYYY-MM-DD
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    request_count: number;
}

interface TokenHeatmapProps {
    dailyData: DailyTokenActivity[];
    selectedDate?: string | null;
    onSelectDate?: (date: string | null) => void;
    className?: string;
}

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
};

export const TokenHeatmap: React.FC<TokenHeatmapProps> = ({
    dailyData,
    selectedDate,
    onSelectDate,
    className,
}) => {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');

    // Available years from data or current year
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        const currentYear = new Date().getFullYear();
        years.add(currentYear);
        dailyData.forEach((d) => {
            const y = parseInt(d.date.slice(0, 4), 10);
            if (!isNaN(y)) years.add(y);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [dailyData]);

    const [selectedYear, setSelectedYear] = useState<number>(() => {
        return availableYears[0] || new Date().getFullYear();
    });

    // Map date -> activity
    const activityMap = useMemo(() => {
        const map = new Map<string, DailyTokenActivity>();
        dailyData.forEach((item) => {
            map.set(item.date, item);
        });
        return map;
    }, [dailyData]);

    // Calculate max tokens for color scaling
    const maxTokens = useMemo(() => {
        let max = 0;
        dailyData.forEach((item) => {
            if (item.total_tokens > max) max = item.total_tokens;
        });
        return Math.max(max, 10000);
    }, [dailyData]);

    // Quantize into 5 activity levels (0..4)
    const getLevel = (tokens: number): number => {
        if (!tokens || tokens <= 0) return 0;
        const ratio = tokens / maxTokens;
        if (ratio <= 0.15) return 1;
        if (ratio <= 0.40) return 2;
        if (ratio <= 0.75) return 3;
        return 4;
    };

    // Color definitions for light / dark modes
    const getCellColor = (level: number, isSelected: boolean): string => {
        if (isSelected) {
            return 'bg-amber-400 dark:bg-amber-400 ring-2 ring-amber-500 scale-125 z-10 shadow-md';
        }
        switch (level) {
            case 1:
                return 'bg-emerald-200 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 hover:ring-1 hover:ring-emerald-400';
            case 2:
                return 'bg-emerald-350 bg-[#6ee7b7] dark:bg-emerald-800 border border-emerald-400 dark:border-emerald-700 hover:ring-1 hover:ring-emerald-400';
            case 3:
                return 'bg-emerald-500 dark:bg-emerald-600 hover:ring-1 hover:ring-emerald-300 shadow-xs';
            case 4:
                return 'bg-emerald-700 dark:bg-emerald-400 text-white shadow-sm hover:ring-1 hover:ring-emerald-200';
            default:
                return 'bg-gray-100 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/40 hover:border-gray-400 dark:hover:border-gray-600';
        }
    };

    // Generate weeks matrix for the selected year (Sunday to Saturday, 52/53 weeks)
    const yearGrid = useMemo(() => {
        const start = new Date(selectedYear, 0, 1);
        const end = new Date(selectedYear, 11, 31);
        
        // Pad to preceding Sunday
        const startDayOfWeek = start.getDay(); // 0 = Sun
        const calendarStart = new Date(start);
        calendarStart.setDate(start.getDate() - startDayOfWeek);

        const weeks: Array<Array<{ dateStr: string; inYear: boolean; data?: DailyTokenActivity }>> = [];
        let currentWeek: Array<{ dateStr: string; inYear: boolean; data?: DailyTokenActivity }> = [];

        const cur = new Date(calendarStart);
        while (cur <= end || currentWeek.length > 0) {
            const dateStr = cur.toISOString().slice(0, 10);
            const inYear = cur.getFullYear() === selectedYear;
            const data = activityMap.get(dateStr);

            currentWeek.push({
                dateStr,
                inYear,
                data,
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
                if (cur > end) break;
            }
            cur.setDate(cur.getDate() + 1);
        }

        return weeks;
    }, [selectedYear, activityMap]);

    // Month headers positioning
    const monthLabels = useMemo(() => {
        const labels: Array<{ name: string; weekIndex: number }> = [];
        let lastMonth = -1;

        yearGrid.forEach((week, wIdx) => {
            const firstValidDay = week.find((d) => d.inYear);
            if (firstValidDay) {
                const monthIndex = parseInt(firstValidDay.dateStr.slice(5, 7), 10) - 1;
                if (monthIndex !== lastMonth) {
                    const monthDate = new Date(selectedYear, monthIndex, 1);
                    const monthName = monthDate.toLocaleString('default', { month: 'short' });
                    labels.push({ name: monthName, weekIndex: wIdx });
                    lastMonth = monthIndex;
                }
            }
        });

        return labels;
    }, [yearGrid, selectedYear]);

    // Weekly aggregated view
    const weeklyData = useMemo(() => {
        return yearGrid.map((week, idx) => {
            let total = 0;
            let inT = 0;
            let outT = 0;
            let reqs = 0;
            const firstDay = week[0]?.dateStr;
            const lastDay = week[6]?.dateStr;

            week.forEach((day) => {
                if (day.inYear && day.data) {
                    total += day.data.total_tokens || 0;
                    inT += day.data.input_tokens || 0;
                    outT += day.data.output_tokens || 0;
                    reqs += day.data.request_count || 0;
                }
            });

            return {
                weekIndex: idx + 1,
                dateRange: `${firstDay} ~ ${lastDay}`,
                total_tokens: total,
                input_tokens: inT,
                output_tokens: outT,
                request_count: reqs,
            };
        });
    }, [yearGrid]);

    const yearSummary = useMemo(() => {
        let total = 0;
        let activeDays = 0;
        dailyData.forEach((item) => {
            if (item.date.startsWith(selectedYear.toString())) {
                total += item.total_tokens;
                if (item.total_tokens > 0) activeDays++;
            }
        });
        return { total, activeDays };
    }, [dailyData, selectedYear]);

    return (
        <div className={cn("bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700", className)}>
            {/* Header: Title + Year Navigator + View Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                        {t('token_stats.heatmap_title', 'Annual Activity Heatmap')}
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                            ({yearSummary.activeDays} days active, {formatNumber(yearSummary.total)} tokens)
                        </span>
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Switch: Daily vs Weekly */}
                    <div className="flex bg-gray-100 dark:bg-gray-700/60 rounded-lg p-0.5 text-xs font-medium">
                        <button
                            onClick={() => setViewMode('daily')}
                            className={cn(
                                "px-2.5 py-1 rounded-md transition-all",
                                viewMode === 'daily'
                                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                            )}
                        >
                            {t('token_stats.heatmap_daily_view', 'Daily (365)')}
                        </button>
                        <button
                            onClick={() => setViewMode('weekly')}
                            className={cn(
                                "px-2.5 py-1 rounded-md transition-all",
                                viewMode === 'weekly'
                                    ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                            )}
                        >
                            {t('token_stats.heatmap_weekly_view', 'Weekly')}
                        </button>
                    </div>

                    {/* Year Selector */}
                    {availableYears.length > 1 ? (
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                            <button
                                onClick={() => {
                                    const nextIdx = availableYears.indexOf(selectedYear) + 1;
                                    if (nextIdx < availableYears.length) setSelectedYear(availableYears[nextIdx]);
                                }}
                                disabled={availableYears.indexOf(selectedYear) >= availableYears.length - 1}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-1">{selectedYear}</span>
                            <button
                                onClick={() => {
                                    const prevIdx = availableYears.indexOf(selectedYear) - 1;
                                    if (prevIdx >= 0) setSelectedYear(availableYears[prevIdx]);
                                }}
                                disabled={availableYears.indexOf(selectedYear) <= 0}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {selectedYear}
                        </span>
                    )}
                </div>
            </div>

            {viewMode === 'daily' ? (
                /* GitHub-Style 53 Weeks x 7 Days Grid */
                <div className="overflow-x-auto pb-2">
                    <div className="inline-block min-w-[760px] select-none">
                        {/* Month Headers */}
                        <div className="flex text-[10px] text-gray-400 dark:text-gray-500 mb-1 pl-6">
                            {yearGrid.map((_, idx) => {
                                const m = monthLabels.find((lbl) => lbl.weekIndex === idx);
                                return (
                                    <div key={idx} className="w-3.5 text-center flex-shrink-0">
                                        {m ? m.name : ''}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Days Grid: 7 rows (Sun to Sat) */}
                        <div className="flex">
                            {/* Day labels (Sun, Tue, Thu, Sat) */}
                            <div className="flex flex-col justify-between text-[9px] text-gray-400 dark:text-gray-500 pr-1.5 py-0.5 w-6 select-none leading-none">
                                <span>Sun</span>
                                <span className="opacity-0">Mon</span>
                                <span>Tue</span>
                                <span className="opacity-0">Wed</span>
                                <span>Thu</span>
                                <span className="opacity-0">Fri</span>
                                <span>Sat</span>
                            </div>

                            {/* 53 Column Weeks */}
                            <div className="flex gap-1">
                                {yearGrid.map((week, wIdx) => (
                                    <div key={wIdx} className="flex flex-col gap-1">
                                        {week.map((day, dIdx) => {
                                            if (!day.inYear) {
                                                return (
                                                    <div
                                                        key={dIdx}
                                                        className="w-3 h-3 rounded-xs opacity-0 pointer-events-none"
                                                    />
                                                );
                                            }

                                            const tokens = day.data?.total_tokens || 0;
                                            const level = getLevel(tokens);
                                            const isSelected = selectedDate === day.dateStr;

                                            const tooltip = day.data
                                                ? `${day.dateStr}\nTotal: ${formatNumber(day.data.total_tokens)} tokens\nInput: ${formatNumber(day.data.input_tokens)}\nOutput: ${formatNumber(day.data.output_tokens)}\nRequests: ${day.data.request_count}`
                                                : `${day.dateStr}: ${t('token_stats.heatmap_no_activity', 'No token activity')}`;

                                            return (
                                                <div
                                                    key={dIdx}
                                                    title={tooltip}
                                                    onClick={() => {
                                                        if (onSelectDate) {
                                                            onSelectDate(isSelected ? null : day.dateStr);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "w-3 h-3 rounded-xs cursor-pointer transition-all",
                                                        getCellColor(level, isSelected)
                                                    )}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Weekly Mode: 52 bars / cards */
                <div className="overflow-x-auto pb-2">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2 min-w-[720px]">
                        {weeklyData.map((wk) => {
                            return (
                                <div
                                    key={wk.weekIndex}
                                    title={`Week ${wk.weekIndex} (${wk.dateRange})\nTotal: ${formatNumber(wk.total_tokens)} tokens\nInput: ${formatNumber(wk.input_tokens)}\nOutput: ${formatNumber(wk.output_tokens)}`}
                                    className={cn(
                                        "flex flex-col p-2 rounded-lg border text-center transition-all cursor-default",
                                        wk.total_tokens > 0
                                            ? "bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/20 dark:border-emerald-800/40"
                                            : "bg-gray-50 border-gray-200/50 dark:bg-gray-800/40 dark:border-gray-700/40 opacity-50"
                                    )}
                                >
                                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                                        W{wk.weekIndex}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200 mt-1">
                                        {formatNumber(wk.total_tokens)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Footer: Selected Date Detail & Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-500 dark:text-gray-400">
                {selectedDate ? (
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {selectedDate}:
                        </span>
                        {activityMap.get(selectedDate) ? (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                {formatNumber(activityMap.get(selectedDate)!.total_tokens)} tokens (
                                {formatNumber(activityMap.get(selectedDate)!.input_tokens)} in / {formatNumber(activityMap.get(selectedDate)!.output_tokens)} out)
                            </span>
                        ) : (
                            <span>{t('token_stats.heatmap_no_activity', 'No token activity')}</span>
                        )}
                        <button
                            onClick={() => onSelectDate && onSelectDate(null)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 ml-1"
                        >
                            ✕ Clear
                        </button>
                    </div>
                ) : (
                    <span>
                        {t('token_stats.heatmap_tip', 'Click any square to inspect and filter by that day')}
                    </span>
                )}

                {/* GitHub Level Legend */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">{t('token_stats.heatmap_less', 'Less')}</span>
                    <div className="w-2.5 h-2.5 rounded-xs bg-gray-100 dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50" />
                    <div className="w-2.5 h-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60" />
                    <div className="w-2.5 h-2.5 rounded-xs bg-[#6ee7b7] dark:bg-emerald-800 border border-emerald-400 dark:border-emerald-700" />
                    <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500 dark:bg-emerald-600" />
                    <div className="w-2.5 h-2.5 rounded-xs bg-emerald-700 dark:bg-emerald-400" />
                    <span className="text-[10px]">{t('token_stats.heatmap_more', 'More')}</span>
                </div>
            </div>
        </div>
    );
};
