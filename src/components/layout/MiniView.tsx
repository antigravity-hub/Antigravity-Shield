import { useEffect, useState, useRef } from 'react';
import { Maximize2, Clock, ShieldAlert, Tag, Activity, Sparkles, Check, X } from 'lucide-react';
import { useViewStore } from '../../stores/useViewStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { isTauri } from '../../utils/env';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { formatTimeRemaining, formatCompactNumber } from '../../utils/format';
import { enterMiniMode, exitMiniMode } from '../../utils/windowManager';
import { getModelDisplayName, findQuotaModel } from '../../config/modelConfig';
import { useAppVersion } from '../../constants/version';
import { listen } from '@tauri-apps/api/event';
import { useConfigStore } from '../../stores/useConfigStore';
import { CircularProgressRing } from './CircularProgressRing';
import { GeminiBrandIcon, ClaudeBrandIcon } from '../common/BrandModelIcons';
import { AntigravityPlatformIcon, AntigravityIdeIcon, AntigravityCliIcon } from '../common/TargetAppIcons';
import { getRecommendedBestAccount } from '../../utils/bestAccount';

interface ProxyRequestLog {
    id: string;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
    timestamp: number;
    status: number;
    duration: number;
    mapped_model?: string;
}

export default function MiniView() {
    const { setMiniView } = useViewStore();
    const { currentAccount, refreshQuota, fetchCurrentAccount, accounts, switchAccount } = useAccountStore();
    const { config } = useConfigStore();
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const hasInitializedRef = useRef(false);
    const appVersion = useAppVersion();

    const [latestLog, setLatestLog] = useState<ProxyRequestLog | null>(null);
    const [dimensions, setDimensions] = useState({ width: 320, height: 350 });

    // Switch Account Modal states
    const [switchModalOpen, setSwitchModalOpen] = useState(false);
    const [switchStep, setSwitchStep] = useState<'confirm' | 'target'>('confirm');
    const [isSwitching, setIsSwitching] = useState(false);
    const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

    // Track dynamic size with ResizeObserver for adaptive layout morphing
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Subscribe to proxy logs
    useEffect(() => {
        let unlistenFn: (() => void) | null = null;

        const setupListener = async () => {
            if (!isTauri()) return;
            try {
                unlistenFn = await listen<ProxyRequestLog>('proxy://request', (event) => {
                    setLatestLog(event.payload);
                });
            } catch (e) {
                console.error('Failed to setup log listener:', e);
            }
        };

        setupListener();

        return () => {
            if (unlistenFn) unlistenFn();
        };
    }, []);

    // Background auto-refresh logic (no manual refresh button needed)
    useEffect(() => {
        if (!config?.auto_refresh || !config?.refresh_interval || config.refresh_interval <= 0) return;

        const intervalId = setInterval(() => {
            if (currentAccount) {
                refreshQuota(currentAccount.id).then(() => fetchCurrentAccount());
            }
        }, config.refresh_interval * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [config?.auto_refresh, config?.refresh_interval, currentAccount]);

    // Initial enter mini mode on mount only (preserves user manual resize)
    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        const initMiniMode = async () => {
            if (isTauri()) {
                await enterMiniMode(350);
            }
        };
        initMiniMode();
    }, []);

    // Keyboard shortcut (Escape to maximize/restore full view)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (switchModalOpen) {
                    setSwitchModalOpen(false);
                } else {
                    handleMaximize();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [switchModalOpen]);

    const handleMaximize = async () => {
        setMiniView(false);
        await exitMiniMode();
    };

    // Global surface drag handling (Pannable from anywhere)
    const handleSurfaceMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[data-no-drag="true"]')) {
            return;
        }
        if (isTauri()) {
            getCurrentWindow().startDragging();
        }
    };

    // Best account recommendation calculation
    const recommended = getRecommendedBestAccount(accounts, currentAccount?.id);
    const bestAccount = recommended.account;

    const handleOpenSwitchModal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSwitchStep('confirm');
        setSwitchFeedback(null);
        setSwitchModalOpen(true);
    };

    const handleConfirmSwitch = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSwitchStep('target');
    };

    const handleSelectTarget = async (target: 'platform' | 'ide' | 'agy', e: React.MouseEvent) => {
        e.stopPropagation();
        if (!bestAccount || isSwitching) return;
        setIsSwitching(true);
        try {
            await switchAccount(bestAccount.id, target);
            setSwitchFeedback(t('common.switch_success', 'سوییچ با موفقیت انجام شد'));
            setTimeout(() => {
                setSwitchModalOpen(false);
                setIsSwitching(false);
                setSwitchFeedback(null);
            }, 900);
        } catch (err) {
            console.error('Failed to switch account:', err);
            setIsSwitching(false);
        }
    };

    // Extract specific models to match AccountRow
    const geminiProModel = findQuotaModel(currentAccount?.quota?.models, 'gemini-pro');
    const geminiFlashModel = findQuotaModel(currentAccount?.quota?.models, 'gemini-flash');
    const claudeModel = findQuotaModel(currentAccount?.quota?.models, 'claude');

    // Aggregate percentages for compact display
    const geminiPercentage = geminiProModel?.percentage ?? geminiFlashModel?.percentage ?? 0;
    const claudePercentage = claudeModel?.percentage ?? 0;
    const hasClaude = Boolean(claudeModel);

    // Adaptive Breakpoint calculations
    const isMicro = dimensions.width < 155 || dimensions.height < 115;
    const isCompact = !isMicro && (dimensions.width < 255 || dimensions.height < 205);

    // Helper to render standard model row
    const renderModelRow = (model: any, displayName: string, colorClass: string) => {
        if (!model) return null;

        const getStatusColor = (p: number) => {
            if (p >= 50) return 'text-[#93B93B]';
            if (p >= 20) return 'text-amber-500';
            return 'text-rose-500';
        };

        const getBarColor = (p: number) => {
            if (p >= 50) return colorClass === 'cyan' ? 'bg-gradient-to-r from-cyan-400 to-[#93B93B]' : 'bg-gradient-to-r from-emerald-400 to-[#93B93B]';
            if (p >= 20) return colorClass === 'cyan' ? 'bg-gradient-to-r from-orange-400 to-amber-500' : 'bg-gradient-to-r from-amber-400 to-amber-500';
            return 'bg-gradient-to-r from-rose-400 to-rose-500';
        };

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1.5"
            >
                <div className="flex justify-between items-baseline">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{displayName}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                            {model.reset_time ? `R: ${formatTimeRemaining(model.reset_time)}` : t('common.unknown')}
                        </span>
                        <span className={clsx("text-xs font-bold font-mono", getStatusColor(model.percentage))}>
                            {model.percentage}%
                        </span>
                    </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${model.percentage}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={clsx("h-full rounded-full shadow-[0_0_8px_currentColor]", getBarColor(model.percentage))}
                    />
                </div>
            </motion.div>
        );
    };

    return (
        <div
            ref={containerRef}
            onMouseDown={handleSurfaceMouseDown}
            data-tauri-drag-region
            className="w-full h-full flex flex-col bg-white/95 dark:bg-[#111622]/95 backdrop-blur-md border border-gray-200/60 dark:border-white/10 rounded-xl overflow-hidden shadow-2xl select-none relative cursor-grab active:cursor-grabbing"
        >
            {/* 1. ULTRA-COMPACT / MICRO RING MODE (width < 155 or height < 115) */}
            {isMicro && (
                <div 
                    className="w-full h-full flex flex-col items-center justify-center p-2 relative group select-none"
                    data-tauri-drag-region
                >
                    {/* Floating top micro-actions on hover */}
                    <div 
                        className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        data-no-drag="true"
                    >
                        <button
                            onClick={handleOpenSwitchModal}
                            className="p-1 rounded-md bg-white/40 dark:bg-black/60 hover:bg-white/80 dark:hover:bg-white/20 text-amber-500 transition-colors shadow-sm"
                            title={t('common.switch_best', 'سوییچ به بهترین حساب')}
                            data-no-drag="true"
                        >
                            <Sparkles size={11} />
                        </button>
                        <button
                            onClick={handleMaximize}
                            className="p-1 rounded-md bg-white/40 dark:bg-black/60 hover:bg-white/80 dark:hover:bg-white/20 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
                            title={`${t('common.maximize', 'Full View')} (Esc)`}
                            data-no-drag="true"
                        >
                            <Maximize2 size={11} />
                        </button>
                    </div>

                    {/* Circular Rings in Theme Color #93B93B */}
                    <div className="flex items-center justify-center gap-2" data-tauri-drag-region>
                        <CircularProgressRing
                            percentage={geminiPercentage}
                            size={Math.min(dimensions.width - 24, dimensions.height - 24, 46)}
                            strokeWidth={3.5}
                            color="#93B93B"
                            title={`Gemini: ${geminiPercentage}%`}
                        >
                            <GeminiBrandIcon size={18} />
                        </CircularProgressRing>

                        {hasClaude && dimensions.width > 95 && (
                            <CircularProgressRing
                                percentage={claudePercentage}
                                size={Math.min(dimensions.width - 24, dimensions.height - 24, 46)}
                                strokeWidth={3.5}
                                color="#93B93B"
                                title={`Claude: ${claudePercentage}%`}
                            >
                                <ClaudeBrandIcon size={18} />
                            </CircularProgressRing>
                        )}
                    </div>
                </div>
            )}

            {/* 2. COMPACT CAPSULE MODE (width < 255 or height < 205) */}
            {isCompact && (
                <div 
                    className="w-full h-full flex flex-col justify-between p-2.5 space-y-2 select-none"
                    data-tauri-drag-region
                >
                    {/* Compact Header */}
                    <div className="flex items-center justify-between" data-tauri-drag-region>
                        <div className="flex items-center gap-1.5 overflow-hidden" data-tauri-drag-region>
                            <div className="w-2 h-2 rounded-full bg-[#93B93B] shadow-[0_0_6px_#93B93B] animate-pulse shrink-0" />
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[120px]" title={currentAccount?.email}>
                                {currentAccount?.email?.split('@')[0] || 'No Account'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" data-no-drag="true">
                            <button
                                onClick={handleOpenSwitchModal}
                                className="p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-white/10 text-amber-500 hover:scale-105 active:scale-95 transition-all"
                                title={t('common.switch_best', 'سوییچ به بهترین حساب')}
                                data-no-drag="true"
                            >
                                <Sparkles size={13} />
                            </button>
                            <button
                                onClick={handleMaximize}
                                className="p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-white/10 text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                                title={`${t('common.maximize', 'Full View')} (Esc)`}
                                data-no-drag="true"
                            >
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Dual Capsule Badges */}
                    <div className="flex-1 flex flex-col justify-center gap-1.5" data-tauri-drag-region>
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-100/80 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <GeminiBrandIcon size={16} />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Gemini</span>
                            </div>
                            <span className={clsx("text-xs font-bold font-mono", geminiPercentage >= 50 ? "text-[#93B93B]" : geminiPercentage >= 20 ? "text-amber-500" : "text-rose-500")}>
                                {geminiPercentage}%
                            </span>
                        </div>

                        {hasClaude && (
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-100/80 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <ClaudeBrandIcon size={16} />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Claude</span>
                                </div>
                                <span className={clsx("text-xs font-bold font-mono", claudePercentage >= 50 ? "text-[#93B93B]" : claudePercentage >= 20 ? "text-amber-500" : "text-rose-500")}>
                                    {claudePercentage}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. STANDARD DETAILED MODE (width >= 255 and height >= 205) */}
            {!isMicro && !isCompact && (
                <div className="w-full h-full flex flex-col overflow-hidden" data-tauri-drag-region>
                    {/* Header / Drag Region */}
                    <div
                        className="flex-none flex items-center justify-between px-3.5 h-10 bg-gray-50/90 dark:bg-white/5 border-b border-gray-200/50 dark:border-white/10 select-none cursor-grab active:cursor-grabbing"
                        data-tauri-drag-region
                    >
                        <div
                            className="flex items-center gap-2 text-xs font-semibold text-gray-900 dark:text-white overflow-hidden"
                            data-tauri-drag-region
                        >
                            <div className="w-2 h-2 rounded-full bg-[#93B93B] shadow-[0_0_8px_#93B93B] animate-pulse shrink-0" />
                            <span className="truncate" title={currentAccount?.email}>
                                {currentAccount?.email?.split('@')[0] || 'No Account'}
                            </span>
                        </div>

                        <div
                            className="flex items-center gap-1 shrink-0"
                            data-no-drag="true"
                        >
                            <button
                                onClick={handleOpenSwitchModal}
                                data-no-drag="true"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium transition-all"
                                title={t('common.switch_best', 'سوییچ به بهترین حساب')}
                            >
                                <Sparkles size={13} />
                                <span>{t('common.switch', 'سوییچ')}</span>
                            </button>
                            <div className="w-px h-3 bg-gray-300 dark:bg-white/20 mx-0.5" />
                            <button
                                onClick={handleMaximize}
                                data-no-drag="true"
                                className="p-1.5 rounded-lg hover:bg-gray-200/60 dark:hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                title={`${t('common.maximize', 'Full View')} (Esc)`}
                            >
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Content Scroll Area */}
                    <div 
                        className="mini-content-scroll flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10"
                        data-tauri-drag-region
                    >
                        {!currentAccount ? (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-2">
                                <ShieldAlert size={32} />
                                <p className="text-sm">No account selected</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Custom Label if present */}
                                {currentAccount.custom_label && (
                                    <div className="flex flex-wrap gap-2">
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold shadow-sm shrink-0">
                                            <Tag className="w-2.5 h-2.5" />
                                            {currentAccount.custom_label}
                                        </span>
                                    </div>
                                )}

                                {/* Models List */}
                                <AnimatePresence mode="popLayout">
                                    <div className="space-y-3.5">
                                        {renderModelRow(geminiProModel, getModelDisplayName(geminiProModel), 'emerald')}
                                        {renderModelRow(geminiFlashModel, getModelDisplayName(geminiFlashModel), 'emerald')}
                                        {renderModelRow(claudeModel, getModelDisplayName(claudeModel, t('common.claude_series', 'Claude 系列')), 'cyan')}

                                        {!geminiProModel && !geminiFlashModel && !claudeModel && (
                                            <div className="text-center py-4 text-xs text-gray-400">
                                                No quota data available
                                            </div>
                                        )}
                                    </div>
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    {/* Footer Status / Latest Log */}
                    <div 
                        className="flex-none h-8 bg-gray-50 dark:bg-black/20 flex items-center justify-between px-3 text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 overflow-hidden"
                        data-tauri-drag-region
                    >
                        {latestLog ? (
                            <motion.div
                                key={latestLog.id}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center w-full gap-2"
                            >
                                <span title={latestLog.status.toString()} className={`w-1.5 h-1.5 rounded-full ${latestLog.status >= 200 && latestLog.status < 400 ? 'bg-[#93B93B]' : 'bg-red-500'}`}></span>
                                <span className="font-bold truncate max-w-[100px]" title={latestLog.model}>
                                    {latestLog.mapped_model || latestLog.model}
                                </span>

                                <div className="flex-1 flex items-center justify-end gap-2">
                                    <div className="flex items-center gap-1.5 text-[9px]" title="Input/Output Tokens">
                                        <Activity size={10} className="text-blue-500" />
                                        <span className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
                                            I:<span className="font-mono text-gray-900 dark:text-gray-200">{formatCompactNumber(latestLog.input_tokens || 0)}</span>
                                        </span>
                                        <span className="text-gray-300 dark:text-gray-600">/</span>
                                        <span className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
                                            O:<span className="font-mono text-gray-900 dark:text-gray-200">{formatCompactNumber(latestLog.output_tokens || 0)}</span>
                                        </span>
                                    </div>

                                    <div className="w-px h-2.5 bg-gray-300 dark:bg-white/10" />

                                    <div className="flex items-center gap-0.5" title="Duration">
                                        <Clock size={10} className="text-gray-400" />
                                        <span className="font-mono">{(latestLog.duration / 1000).toFixed(2)}s</span>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#93B93B]" />
                                    <span>Connected</span>
                                </div>
                                <span className="font-mono opacity-50">v{appVersion}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 4. SMART BEST-ACCOUNT SWITCH MODAL (2-Step Dialog) */}
            <AnimatePresence>
                {switchModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        data-no-drag="true"
                        className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 z-50 select-none"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-[280px] bg-white dark:bg-[#1a202c] border border-gray-200 dark:border-white/10 rounded-xl p-3.5 shadow-2xl space-y-3"
                            data-no-drag="true"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                                    <Sparkles size={14} className="text-amber-500" />
                                    <span>{switchStep === 'confirm' ? t('common.switch_best_title', 'سوییچ به بهترین حساب') : t('common.select_target_title', 'انتخاب محیط مقصد')}</span>
                                </div>
                                <button
                                    onClick={() => setSwitchModalOpen(false)}
                                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                    data-no-drag="true"
                                >
                                    <X size={13} />
                                </button>
                            </div>

                            {/* STEP 1: CONFIRMATION PROMPT */}
                            {switchStep === 'confirm' && (
                                <div className="space-y-3">
                                    {!bestAccount ? (
                                        <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400">
                                            {t('common.no_alternative_account', 'هیچ حساب جایگزین فعالی با سهمیه کافی یافت نشد.')}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-xs text-gray-600 dark:text-gray-300">
                                                {t('common.switch_confirm_prompt', 'آیا می‌خواهید به بهترین اکانت سوییچ کنید؟')}
                                            </p>

                                            {/* Preview Best Account Box */}
                                            <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 space-y-1.5">
                                                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                                                    <span className="truncate max-w-[150px]">{bestAccount.email}</span>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">Best</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                                    <span>Gemini: <strong className="text-[#93B93B]">{recommended.geminiScore}%</strong></span>
                                                    <span>Claude: <strong className="text-cyan-500">{recommended.claudeScore}%</strong></span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            onClick={() => setSwitchModalOpen(false)}
                                            className="px-2.5 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                            data-no-drag="true"
                                        >
                                            {t('common.cancel', 'انصراف')}
                                        </button>
                                        {bestAccount && (
                                            <button
                                                onClick={handleConfirmSwitch}
                                                className="px-3 py-1 text-xs rounded-lg bg-[#93B93B] hover:bg-[#83a734] text-black font-semibold shadow-md transition-all active:scale-95"
                                                data-no-drag="true"
                                            >
                                                {t('common.confirm_proceed', 'بله، ادامه')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: SELECT TARGET ENVIRONMENT */}
                            {switchStep === 'target' && (
                                <div className="space-y-3">
                                    <p className="text-[11px] text-gray-600 dark:text-gray-300">
                                        {t('common.select_target_desc', 'محیطی که می‌خواهید سهمیه در آن فعال شود را انتخاب کنید:')}
                                    </p>

                                    {/* 3 Interactive Target Icons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* 1. Platform */}
                                        <button
                                            onClick={(e) => handleSelectTarget('platform', e)}
                                            disabled={isSwitching}
                                            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-blue-500/10 hover:border-blue-500/30 border border-gray-200/50 dark:border-white/10 transition-all group active:scale-95"
                                            title="Antigravity Platform"
                                            data-no-drag="true"
                                        >
                                            <AntigravityPlatformIcon size={24} className="transition-transform group-hover:scale-110" />
                                            <span className="text-[10px] font-semibold mt-1.5 text-gray-700 dark:text-gray-300 group-hover:text-blue-500">Platform</span>
                                        </button>

                                        {/* 2. IDE */}
                                        <button
                                            onClick={(e) => handleSelectTarget('ide', e)}
                                            disabled={isSwitching}
                                            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-purple-500/10 hover:border-purple-500/30 border border-gray-200/50 dark:border-white/10 transition-all group active:scale-95"
                                            title="Antigravity IDE"
                                            data-no-drag="true"
                                        >
                                            <AntigravityIdeIcon size={24} className="transition-transform group-hover:scale-110" />
                                            <span className="text-[10px] font-semibold mt-1.5 text-gray-700 dark:text-gray-300 group-hover:text-purple-500">IDE</span>
                                        </button>

                                        {/* 3. CLI */}
                                        <button
                                            onClick={(e) => handleSelectTarget('agy', e)}
                                            disabled={isSwitching}
                                            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-gray-200/50 dark:border-white/10 transition-all group active:scale-95"
                                            title="Antigravity CLI (agy)"
                                            data-no-drag="true"
                                        >
                                            <AntigravityCliIcon size={24} className="transition-transform group-hover:scale-110" />
                                            <span className="text-[10px] font-semibold mt-1.5 text-gray-700 dark:text-gray-300 group-hover:text-emerald-500">CLI</span>
                                        </button>
                                    </div>

                                    {/* Feedback Toast */}
                                    {switchFeedback && (
                                        <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-[#93B93B] font-bold animate-pulse">
                                            <Check size={14} />
                                            <span>{switchFeedback}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
