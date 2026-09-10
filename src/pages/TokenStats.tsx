import React, { useEffect, useState, useRef, useCallback } from 'react';
import { request as invoke } from '../utils/request';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Clock, Calendar, CalendarDays, Users, Zap, TrendingUp, RefreshCw, Cpu, History, CheckCircle2, CalendarRange, Filter } from 'lucide-react';
import { TokenHeatmap, DailyTokenActivity } from '../components/stats/TokenHeatmap';

interface TokenStatsAggregated {
    period: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    request_count: number;
    uncached_input_tokens?: number;
}

interface AccountTokenStats {
    account_email: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTokenStats {
    model: string;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface ModelTrendPoint {
    period: string;
    model_data: Record<string, number>;
}

interface AccountTrendPoint {
    period: string;
    account_data: Record<string, number>;
}

interface TokenStatsSummary {
    total_input_tokens: number;
    total_output_tokens: number;
    total_cached_tokens: number;
    total_tokens: number;
    total_requests: number;
    unique_accounts: number;
}

interface BrainScanResult {
    conversations_found: number;
    conversations_scanned: number;
    conversations_skipped: number;
    total_new_tokens: number;
    errors: string[];
}

type TimeRange = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type ViewMode = 'model' | 'account';
type SourceFilter = 'all' | 'Antigravity IDE' | 'Antigravity Platform' | 'Antigravity CLI';

const MODEL_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#06b6d4', '#6366f1', '#f43f5e', '#84cc16', '#a855f7',
    '#14b8a6', '#f97316', '#64748b', '#0ea5e9', '#d946ef'
];

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#f43f5e'];

const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

const shortenModelName = (model: string): string => {
    return model
        .replace(/^gemini-/i, 'g-')
        .replace(/^claude-/i, 'c-')
        .replace(/^deepseek-/i, 'ds-')
        .replace(/^gpt-/i, 'gpt-')
        .replace(/-preview[a-zA-Z0-9\-_]*/i, '')
        .replace(/-latest/i, '');
};

const TokenStats: React.FC = () => {
    const { t } = useTranslation();
    const [timeRange, setTimeRange] = useState<TimeRange>('daily');
    const [viewMode, setViewMode] = useState<ViewMode>('model');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [chartData, setChartData] = useState<TokenStatsAggregated[]>([]);
    const [accountData, setAccountData] = useState<AccountTokenStats[]>([]);
    const [modelData, setModelData] = useState<ModelTokenStats[]>([]);
    const [modelTrendData, setModelTrendData] = useState<any[]>([]);
    const [accountTrendData, setAccountTrendData] = useState<any[]>([]);
    const [allModels, setAllModels] = useState<string[]>([]);
    const [allAccounts, setAllAccounts] = useState<string[]>([]);
    const [summary, setSummary] = useState<TokenStatsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<BrainScanResult | null>(null);
    const [heatmapData, setHeatmapData] = useState<DailyTokenActivity[]>([]);
    const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null);

    // Refs to avoid stale closures in event listeners
    const timeRangeRef = useRef<TimeRange>(timeRange);
    const sourceFilterRef = useRef<SourceFilter>(sourceFilter);
    const customStartDateRef = useRef<string>(customStartDate);
    const customEndDateRef = useRef<string>(customEndDate);

    useEffect(() => {
        timeRangeRef.current = timeRange;
    }, [timeRange]);

    useEffect(() => {
        sourceFilterRef.current = sourceFilter;
    }, [sourceFilter]);

    useEffect(() => {
        customStartDateRef.current = customStartDate;
    }, [customStartDate]);

    useEffect(() => {
        customEndDateRef.current = customEndDate;
    }, [customEndDate]);

    const handleScanBrain = async () => {
        setScanning(true);
        try {
            const res = await invoke<BrainScanResult>('scan_brain_conversations');
            setScanResult(res);
            await fetchData(false);
        } catch (error) {
            console.error('Brain scan failed:', error);
        } finally {
            setScanning(false);
        }
    };

    const fetchData = async (silent: boolean = false) => {
        if (!silent) {
            setLoading(true);
        }
        try {
            const currentRange = timeRangeRef.current;
            const currentSource = sourceFilterRef.current;
            const currentCustomStart = customStartDateRef.current;
            const currentCustomEnd = customEndDateRef.current;

            // Log active source filter when not all
            if (currentSource !== 'all') {
                console.debug(`Applying source filter: ${currentSource}`);
            }

            let hours = 24;
            let data: TokenStatsAggregated[] = [];
            let modelTrend: ModelTrendPoint[] = [];
            let accountTrend: AccountTrendPoint[] = [];

            switch (currentRange) {
                case 'hourly':
                    hours = 24;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_hourly', { hours: 24 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_hourly', { hours: 24 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_hourly', { hours: 24 });
                    break;
                case 'daily':
                    hours = 168;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_daily', { days: 7 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 7 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 7 });
                    break;
                case 'weekly':
                    hours = 720;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_weekly', { weeks: 4 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 30 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 30 });
                    break;
                case 'monthly':
                    hours = 720; // 30 days
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_daily', { days: 30 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 30 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 30 });
                    break;
                case 'yearly':
                    hours = 8760; // 365 days
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_daily', { days: 365 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 365 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 365 });
                    break;
                case 'custom':
                    hours = 8760;
                    data = await invoke<TokenStatsAggregated[]>('get_token_stats_daily', { days: 365 });
                    modelTrend = await invoke<ModelTrendPoint[]>('get_token_stats_model_trend_daily', { days: 365 });
                    accountTrend = await invoke<AccountTrendPoint[]>('get_token_stats_account_trend_daily', { days: 365 });

                    if (currentCustomStart || currentCustomEnd) {
                        data = data.filter((d) => {
                            const p = d.period.slice(0, 10);
                            if (currentCustomStart && p < currentCustomStart) return false;
                            if (currentCustomEnd && p > currentCustomEnd) return false;
                            return true;
                        });
                        modelTrend = modelTrend.filter((d) => {
                            const p = d.period.slice(0, 10);
                            if (currentCustomStart && p < currentCustomStart) return false;
                            if (currentCustomEnd && p > currentCustomEnd) return false;
                            return true;
                        });
                        accountTrend = accountTrend.filter((d) => {
                            const p = d.period.slice(0, 10);
                            if (currentCustomStart && p < currentCustomStart) return false;
                            if (currentCustomEnd && p > currentCustomEnd) return false;
                            return true;
                        });
                    }
                    break;
            }

            // Always fetch 365 days for annual heatmap
            try {
                const yearDaily = await invoke<TokenStatsAggregated[]>('get_token_stats_daily', { days: 365 });
                const heatActivities: DailyTokenActivity[] = yearDaily.map((d) => ({
                    date: d.period.slice(0, 10),
                    total_tokens: d.total_tokens || 0,
                    input_tokens: d.total_input_tokens || 0,
                    output_tokens: d.total_output_tokens || 0,
                    cached_tokens: d.total_cached_tokens || 0,
                    request_count: d.request_count || 0,
                }));
                setHeatmapData(heatActivities);
            } catch (err) {
                console.error('Failed to load heatmap data:', err);
            }

            setChartData(data.map(point => ({
                ...point,
                total_cached_tokens: point.total_cached_tokens || 0,
                uncached_input_tokens: Math.max((point.total_input_tokens || 0) - (point.total_cached_tokens || 0), 0)
            })));

            const models = new Set<string>();
            modelTrend.forEach(point => {
                Object.keys(point.model_data).forEach(m => models.add(m));
            });
            const modelList = Array.from(models);
            setAllModels(modelList);

            const transformedTrend = modelTrend.map(point => {
                const row: Record<string, any> = { period: point.period };
                modelList.forEach(model => {
                    row[model] = point.model_data[model] || 0;
                });
                return row;
            });
            setModelTrendData(transformedTrend);

            // Process Account Trend Data
            const accountsSet = new Set<string>();
            accountTrend.forEach(point => {
                Object.keys(point.account_data).forEach(acc => accountsSet.add(acc));
            });
            const accountList = Array.from(accountsSet);
            setAllAccounts(accountList);

            const transformedAccountTrend = accountTrend.map(point => {
                const row: Record<string, any> = { period: point.period };
                accountList.forEach(acc => {
                    row[acc] = point.account_data[acc] || 0;
                });
                return row;
            });
            setAccountTrendData(transformedAccountTrend);

            const [accounts, models_stats, summaryData] = await Promise.all([
                invoke<AccountTokenStats[]>('get_token_stats_by_account', { hours }),
                invoke<ModelTokenStats[]>('get_token_stats_by_model', { hours }),
                invoke<TokenStatsSummary>('get_token_stats_summary', { hours })
            ]);

            setAccountData(accounts);
            setModelData(models_stats);
            setSummary(summaryData);
        } catch (error) {
            console.error('Failed to fetch token stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(false);
    }, [timeRange, sourceFilter, customStartDate, customEndDate]);

    useEffect(() => {
        let unlistenFn: (() => void) | null = null;
        (async () => {
            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlistenFn = await listen('live_token_stats_update', () => {
                    // Silent refresh so user selection is never interrupted or flickered
                    fetchData(true);
                });
            } catch (e) {
                // Ignore if not in Tauri window
            }
        })();

        return () => {
            if (unlistenFn) unlistenFn();
        };
    }, []);

    const pieData = accountData.slice(0, 8).map((account, index) => ({
        name: account.account_email.split('@')[0] + '...',
        value: account.total_tokens,
        fullEmail: account.account_email,
        color: COLORS[index % COLORS.length]
    }));

    const trendChartContainerRef = useRef<HTMLDivElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | undefined>(undefined);

    // Ref and state for pie chart tooltip position
    const pieChartContainerRef = useRef<HTMLDivElement>(null);
    const [pieTooltipPosition, setPieTooltipPosition] = useState<{ x: number; y: number } | undefined>(undefined);

    // Handle mouse move to calculate tooltip position
    const handleTrendChartMouseMove = useCallback((e: any) => {
        if (!trendChartContainerRef.current || !e?.activeCoordinate) return;

        const containerRect = trendChartContainerRef.current.getBoundingClientRect();
        const tooltipWidth = 200; // Approximate tooltip width
        const rightEdgeThreshold = containerRect.width - tooltipWidth - 20; // 20px buffer

        const mouseXInContainer = e.activeCoordinate.x;

        if (mouseXInContainer > rightEdgeThreshold) {
            setTooltipPosition({
                x: e.activeCoordinate.x - tooltipWidth - 15,
                y: e.activeCoordinate.y
            });
        } else {
            setTooltipPosition(undefined); // Use default positioning
        }
    }, []);

    // Handle mouse move for pie chart to calculate tooltip position
    const handlePieChartMouseMove = useCallback((e: any) => {
        if (!pieChartContainerRef.current) return;

        const containerRect = pieChartContainerRef.current.getBoundingClientRect();
        const tooltipWidth = 180; // Approximate tooltip width for pie chart

        // Get mouse position relative to container
        if (e?.activeCoordinate) {
            const mouseXInContainer = e.activeCoordinate.x;
            const rightEdgeThreshold = containerRect.width - tooltipWidth - 20;

            if (mouseXInContainer > rightEdgeThreshold) {
                setPieTooltipPosition({
                    x: e.activeCoordinate.x - tooltipWidth - 15,
                    y: e.activeCoordinate.y
                });
            } else {
                setPieTooltipPosition(undefined);
            }
        }
    }, []);

    // Custom Tooltip for Trend Chart
    const CustomTrendTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;

        // Sort payload by value descending
        const sortedPayload = [...payload].sort((a: any, b: any) => b.value - a.value);

        return (
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-2.5 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 text-xs z-[100] min-w-[180px] pointer-events-none">
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5 border-b border-gray-100 dark:border-gray-700 pb-1.5">
                    {label}
                </p>
                <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                    {sortedPayload.map((entry: any, index: number) => {
                        const name = entry.name;
                        const displayName = viewMode === 'model' ? shortenModelName(name) : name.split('@')[0];
                        return (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span className="text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={name}>
                                        {displayName}
                                    </span>
                                </div>
                                <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                                    {formatNumber(entry.value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const UsageTrendTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const row = payload[0]?.payload || {};
        const items = [
            { label: t('token_stats.total', '合计'), value: row.total_tokens || 0, color: '#111827' },
            { label: t('token_stats.input', '输入'), value: row.total_input_tokens || 0, color: '#3b82f6' },
            { label: t('token_stats.cached_token', '缓存命中'), value: row.total_cached_tokens || 0, color: '#93c5fd' },
            { label: t('token_stats.output', '输出'), value: row.total_output_tokens || 0, color: '#8b5cf6' },
        ];
        return (
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-2.5 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 text-xs z-[100] pointer-events-none min-w-[170px]">
                {label && <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">{label}</p>}
                <div className="space-y-1">
                    {items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-gray-500 dark:text-gray-400">
                                    {item.label}:
                                </span>
                            </div>
                            <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                                {formatNumber(item.value)}
                            </span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500 dark:text-gray-400">
                            {t('token_stats.requests', '请求数')}:
                        </span>
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                            {(row.request_count || 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // Custom Tooltip for Pie Chart
    const CustomPieTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;
        const entry = payload[0];
        return (
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-2.5 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 text-xs z-[100] pointer-events-none">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.payload.color || entry.color }} />
                    <span className="text-gray-500 dark:text-gray-400">
                        {entry.payload.fullEmail || entry.name}:
                    </span>
                    <span className="font-mono font-medium text-gray-700 dark:text-gray-200">
                        {formatNumber(entry.value)}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-5 space-y-4 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Zap className="w-6 h-6 text-blue-500" />
                            {t('token_stats.title', 'Token 消费统计')}
                        </h1>
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{t('token_stats.live_sync', 'Live IDE / CLI Sync')}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
                        {/* Time Range Pills */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap gap-0.5">
                            <button
                                onClick={() => { setTimeRange('hourly'); setSelectedHeatmapDate(null); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'hourly'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                {t('token_stats.hourly', 'ساعت')}
                            </button>
                            <button
                                onClick={() => { setTimeRange('daily'); setSelectedHeatmapDate(null); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'daily'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                {t('token_stats.daily', 'روز')}
                            </button>
                            <button
                                onClick={() => { setTimeRange('weekly'); setSelectedHeatmapDate(null); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'weekly'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <CalendarDays className="w-3.5 h-3.5" />
                                {t('token_stats.weekly', 'هفته')}
                            </button>
                            <button
                                onClick={() => { setTimeRange('monthly'); setSelectedHeatmapDate(null); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'monthly'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <CalendarRange className="w-3.5 h-3.5" />
                                {t('token_stats.monthly', 'ماه')}
                            </button>
                            <button
                                onClick={() => { setTimeRange('yearly'); setSelectedHeatmapDate(null); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'yearly'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <CalendarRange className="w-3.5 h-3.5" />
                                {t('token_stats.yearly', 'سال')}
                            </button>
                            <button
                                onClick={() => { setTimeRange('custom'); setSelectedHeatmapDate(null); }}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'custom'
                                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                {t('token_stats.custom_range', 'بازه انتخابی')}
                            </button>
                        </div>

                        <button
                            onClick={handleScanBrain}
                            disabled={scanning}
                            title={t('token_stats.scan_history', 'اسکن تاریخچه گفتگوها')}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                            <History className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                            <span>{scanning ? t('token_stats.scanning', 'در حال اسکن...') : t('token_stats.scan_history', 'Scan History')}</span>
                        </button>
                        <button
                            onClick={() => fetchData(false)}
                            disabled={loading}
                            title={t('common.refresh', 'تازه سازی')}
                            className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Source Filter Tabs & Custom Date Inputs */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-200/80 dark:border-gray-700/80">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5" />
                            {t('token_stats.filter_source', 'فیلتر منبع')}:
                        </span>
                        <button
                            onClick={() => setSourceFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                sourceFilter === 'all'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {t('token_stats.source_all', 'همه منابع')}
                        </button>
                        <button
                            onClick={() => setSourceFilter('Antigravity IDE')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                sourceFilter === 'Antigravity IDE'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {t('token_stats.source_ide', 'Antigravity IDE')}
                        </button>
                        <button
                            onClick={() => setSourceFilter('Antigravity Platform')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                sourceFilter === 'Antigravity Platform'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {t('token_stats.source_platform', 'Antigravity Platform')}
                        </button>
                        <button
                            onClick={() => setSourceFilter('Antigravity CLI')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                sourceFilter === 'Antigravity CLI'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {t('token_stats.source_cli', 'Antigravity CLI (agy)')}
                        </button>
                    </div>

                    {timeRange === 'custom' && (
                        <div className="flex items-center gap-2 text-xs">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-xs focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-gray-400">→</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 text-xs focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>

                {scanResult && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center justify-between text-xs text-indigo-800 dark:text-indigo-200">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                            <span>
                                {t('token_stats.scan_success', 'اسکن تاریخچه تکمیل شد:')}{' '}
                                <strong>{scanResult.conversations_found}</strong> {t('token_stats.scan_summary_prefix', 'گفتگو بررسی شد')} ({scanResult.conversations_scanned} {t('token_stats.scan_new_scans', 'اسکن جدید')}، {scanResult.conversations_skipped} {t('token_stats.scan_already_up_to_date', 'از قبل به‌روز')})،{' '}
                                <strong>{formatNumber(scanResult.total_new_tokens)}</strong> {t('token_stats.scan_tokens_recovered', 'توکن تاریخی بازیابی گردید')}.
                            </span>
                        </div>
                        <button 
                            onClick={() => setScanResult(null)}
                            className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium px-2 py-0.5"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Annual GitHub-style Activity Heatmap */}
                <TokenHeatmap
                    dailyData={heatmapData}
                    selectedDate={selectedHeatmapDate}
                    onSelectDate={(dt) => {
                        setSelectedHeatmapDate(dt);
                        if (dt) {
                            setTimeRange('custom');
                            setCustomStartDate(dt);
                            setCustomEndDate(dt);
                        }
                    }}
                />

                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
                                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                                    <Zap className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                </div>
                                {t('token_stats.total_tokens', '总 Token')}
                            </div>
                            <div className="text-2xl font-bold text-gray-800 dark:text-white">
                                {formatNumber(summary.total_tokens)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/10 dark:to-gray-800 rounded-xl p-4 shadow-sm border border-blue-100 dark:border-blue-900/30 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 text-blue-600/80 dark:text-blue-400/80 text-sm mb-2">
                                <div className="p-1.5 rounded-lg bg-blue-100/50 dark:bg-blue-900/30">
                                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                {t('token_stats.input_tokens', '输入 Token')}
                            </div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {formatNumber(summary.total_input_tokens)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-900/10 dark:to-gray-800 rounded-xl p-4 shadow-sm border border-purple-100 dark:border-purple-900/30 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 text-purple-600/80 dark:text-purple-400/80 text-sm mb-2">
                                <div className="p-1.5 rounded-lg bg-purple-100/50 dark:bg-purple-900/30">
                                    <TrendingUp className="w-4 h-4 rotate-180 text-purple-600 dark:text-purple-400" />
                                </div>
                                {t('token_stats.output_tokens', '输出 Token')}
                            </div>
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {formatNumber(summary.total_output_tokens)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-sky-50/50 to-white dark:from-sky-900/10 dark:to-gray-800 rounded-xl p-4 shadow-sm border border-sky-100 dark:border-sky-900/30 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 text-sky-600/80 dark:text-sky-400/80 text-sm mb-2">
                                <div className="p-1.5 rounded-lg bg-sky-100/50 dark:bg-sky-900/30">
                                    <Zap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                </div>
                                {t('token_stats.cached_token', '缓存命中')}
                            </div>
                            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                                {formatNumber(summary.total_cached_tokens)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/10 dark:to-gray-800 rounded-xl p-4 shadow-sm border border-green-100 dark:border-green-900/30 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 text-green-600/80 dark:text-green-400/80 text-sm mb-2">
                                <div className="p-1.5 rounded-lg bg-green-100/50 dark:bg-green-900/30">
                                    <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                {t('token_stats.accounts_used', '活跃账号')}
                            </div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {summary.unique_accounts}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-900/10 dark:to-gray-800 rounded-xl p-4 shadow-sm border border-orange-100 dark:border-orange-900/30 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 text-orange-600/80 dark:text-orange-400/80 text-sm mb-2">
                                <div className="p-1.5 rounded-lg bg-orange-100/50 dark:bg-orange-900/30">
                                    <Cpu className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                </div>
                                {t('token_stats.models_used', '使用模型')}
                            </div>
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                {modelData.length}
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            {viewMode === 'model' ? (
                                <Cpu className="w-5 h-5 text-purple-500" />
                            ) : (
                                <Users className="w-5 h-5 text-green-500" />
                            )}
                            {viewMode === 'model'
                                ? t('token_stats.model_trend', '分模型使用趋势')
                                : t('token_stats.account_trend', '分账号使用趋势')
                            }
                        </h2>
                        <div className="flex bg-gray-100/80 dark:bg-gray-700/50 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('model')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'model'
                                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                {t('token_stats.by_model', '按模型')}
                            </button>
                            <button
                                onClick={() => setViewMode('account')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'account'
                                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                {t('token_stats.by_account_view', '按账号')}
                            </button>
                        </div>
                    </div>
                    <div className="h-72" ref={trendChartContainerRef}>
                        {modelTrendData.length > 0 && allModels.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={viewMode === 'model' ? modelTrendData : accountTrendData}
                                    onMouseMove={handleTrendChartMouseMove}
                                    onMouseLeave={() => setTooltipPosition(undefined)}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.15} />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        tickFormatter={(val) => {
                                            if (timeRange === 'hourly') return val.split(' ')[1] || val;
                                            if (timeRange === 'daily') return val.split('-').slice(1).join('/');
                                            return val;
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#6b7280' }}
                                        tickFormatter={(val) => formatNumber(val)}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        content={<CustomTrendTooltip />}
                                        cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4', fill: 'transparent' }}
                                        allowEscapeViewBox={{ x: true, y: true }}
                                        position={tooltipPosition}
                                        wrapperStyle={{ zIndex: 100 }}
                                    />
                                    <Legend
                                        formatter={(value) => viewMode === 'model' ? shortenModelName(value) : value.split('@')[0]}
                                        wrapperStyle={{
                                            fontSize: '11px',
                                            paddingTop: '10px',
                                            maxHeight: '60px',
                                            overflowY: 'auto',
                                            zIndex: 0
                                        }}
                                    />
                                    {(viewMode === 'model' ? allModels : allAccounts).map((item, index) => (
                                        <Area
                                            key={item}
                                            type="monotone"
                                            dataKey={item}
                                            stackId="1"
                                            stroke={viewMode === 'model' ? MODEL_COLORS[index % MODEL_COLORS.length] : COLORS[index % COLORS.length]}
                                            fill={viewMode === 'model' ? MODEL_COLORS[index % MODEL_COLORS.length] : COLORS[index % COLORS.length]}
                                            fillOpacity={0.6}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                {loading ? t('common.loading', '加载中...') : t('token_stats.no_data', '暂无数据')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                            {t('token_stats.usage_trend', 'Token 使用趋势')}
                        </h2>
                        <div className="flex-1 min-h-[16rem]">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.15} />
                                        <XAxis
                                            dataKey="period"
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            tickFormatter={(val) => {
                                                if (timeRange === 'hourly') return val.split(' ')[1] || val;
                                                if (timeRange === 'daily') return val.split('-').slice(1).join('/');
                                                return val;
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            tickFormatter={(val) => formatNumber(val)}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            content={<UsageTrendTooltip />}
                                            cursor={{ fill: 'transparent' }}
                                            allowEscapeViewBox={{ x: true, y: true }}
                                            wrapperStyle={{ zIndex: 100 }}
                                        />
                                        <Bar dataKey="total_cached_tokens" name={t('token_stats.cached_token', '缓存命中')} stackId="input" fill="#93c5fd" radius={[0, 0, 4, 4]} maxBarSize={50} />
                                        <Bar dataKey="uncached_input_tokens" name={t('token_stats.input', '输入')} stackId="input" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="total_output_tokens" name={t('token_stats.output', '输出')} fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    {loading ? t('common.loading', '加载中...') : t('token_stats.no_data', '暂无数据')}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                            {t('token_stats.by_account', '分账号统计')}
                        </h2>
                        <div className="h-48" ref={pieChartContainerRef}>
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart
                                        onMouseMove={handlePieChartMouseMove}
                                        onMouseLeave={() => setPieTooltipPosition(undefined)}
                                    >
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={70}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            content={<CustomPieTooltip />}
                                            allowEscapeViewBox={{ x: true, y: true }}
                                            position={pieTooltipPosition}
                                            wrapperStyle={{ zIndex: 100 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    {loading ? t('common.loading', '加载中...') : t('token_stats.no_data', '暂无数据')}
                                </div>
                            )}
                        </div>
                        <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                            {accountData.slice(0, 5).map((account, index) => (
                                <div key={account.account_email} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <span className="text-gray-600 dark:text-gray-300 truncate max-w-[120px]">
                                            {account.account_email.split('@')[0]}
                                        </span>
                                    </div>
                                    <span className="font-medium text-gray-800 dark:text-white">
                                        {formatNumber(account.total_tokens)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>


                {
                    modelData.length > 0 && viewMode === 'model' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-blue-500" />
                                {t('token_stats.model_details', '分模型详细统计')}
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.model', '模型')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.requests', '请求数')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.input', '输入')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.output', '输出')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.cached_token', '缓存命中')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.total', '合计')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.percentage', '占比')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {modelData.map((model, index) => {
                                            const percentage = summary ? ((model.total_tokens / summary.total_tokens) * 100).toFixed(1) : '0';
                                            return (
                                                <tr
                                                    key={model.model}
                                                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }}
                                                            />
                                                            <span className="text-gray-800 dark:text-white font-medium">
                                                                {model.model}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">
                                                        {model.request_count.toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-blue-600">
                                                        {formatNumber(model.total_input_tokens)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-purple-600">
                                                        {formatNumber(model.total_output_tokens)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-sky-600">
                                                        {formatNumber(model.total_cached_tokens)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold text-gray-800 dark:text-white">
                                                        {formatNumber(model.total_tokens)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                <div
                                                                    className="h-2 rounded-full"
                                                                    style={{
                                                                        width: `${percentage}%`,
                                                                        backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length]
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-gray-600 dark:text-gray-300 w-12 text-right">
                                                                {percentage}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }



                {
                    accountData.length > 0 && viewMode === 'account' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                                {t('token_stats.account_details', '账号详细统计')}
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.account', '账号')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.requests', '请求数')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.input', '输入')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.output', '输出')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.cached_token', '缓存命中')}
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                                                {t('token_stats.total', '合计')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accountData.map((account) => (
                                            <tr
                                                key={account.account_email}
                                                className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                            >
                                                <td className="py-3 px-4 text-gray-800 dark:text-white">
                                                    {account.account_email}
                                                </td>
                                                <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">
                                                    {account.request_count.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-right text-blue-600">
                                                    {formatNumber(account.total_input_tokens)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-purple-600">
                                                    {formatNumber(account.total_output_tokens)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-sky-600">
                                                    {formatNumber(account.total_cached_tokens)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-gray-800 dark:text-white">
                                                    {formatNumber(account.total_tokens)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
};

export default TokenStats;
