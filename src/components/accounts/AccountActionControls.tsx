import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    RefreshCw,
    Info,
    MoreHorizontal,
    Fingerprint,
    Tag,
    Sparkles,
    ToggleLeft,
    ToggleRight,
    Download,
    Trash2,
    Loader2
} from 'lucide-react';
import { Account } from '../../types/account';
import { cn } from '../../utils/cn';
import {
    AntigravityClassicIcon,
    AntigravityIdeIcon,
    AntigravityCliIcon
} from '../common/TargetAppIcons';

interface AccountActionControlsProps {
    account: Account;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching: boolean;
    isDisabled: boolean;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onViewDevice: () => void;
    onViewDetails: () => void;
    onExport: () => void;
    onDelete: () => void;
    onToggleProxy: () => void;
    onWarmup?: () => void;
    onEditLabel?: () => void;
    layout?: 'table' | 'card';
}

export function AccountActionControls({
    account,
    isCurrent,
    isRefreshing,
    isSwitching,
    isDisabled,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onWarmup,
    onEditLabel,
    layout = 'table',
}: AccountActionControlsProps) {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

    // Calculate fixed menu position on open
    const handleToggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isMenuOpen) {
            setIsMenuOpen(false);
            return;
        }

        if (menuButtonRef.current) {
            const rect = menuButtonRef.current.getBoundingClientRect();
            const right = window.innerWidth - rect.right;
            const top = rect.bottom + 6;
            setMenuPos({ top, right });
            setIsMenuOpen(true);
        }
    };

    // Close on outside click, window resize or scroll
    useEffect(() => {
        if (!isMenuOpen) return;

        const handleClose = () => setIsMenuOpen(false);
        window.addEventListener('click', handleClose);
        window.addEventListener('resize', handleClose);
        window.addEventListener('scroll', handleClose, true);

        return () => {
            window.removeEventListener('click', handleClose);
            window.removeEventListener('resize', handleClose);
            window.removeEventListener('scroll', handleClose, true);
        };
    }, [isMenuOpen]);

    const isCard = layout === 'card';

    return (
        <div 
            className={cn(
                "flex items-center gap-1.5",
                isCard ? "w-full justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80" : "justify-center"
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Primary Target Switch Hub */}
            <div className={cn(
                "flex items-center rounded-xl p-0.5 border shadow-sm transition-all",
                isCurrent
                    ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40 shadow-emerald-500/10"
                    : "bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60"
            )}>
                {/* Active Indicator Badge when Current */}
                {isCurrent && (
                    <span 
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 select-none mr-0.5 tracking-tight"
                        title={t('accounts.current_active', 'Active Account')}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        {t('common.active', 'Active')}
                    </span>
                )}

                {/* Switch Target 1: Antigravity Classic */}
                <button
                    type="button"
                    className={cn(
                        "p-1.5 rounded-lg transition-all relative group/btn",
                        (isSwitching || isDisabled)
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                    )}
                    onClick={() => onSwitch()}
                    disabled={isSwitching || isDisabled}
                    title={isDisabled ? t('accounts.disabled_tooltip') : t('accounts.switch_to_classic', 'Switch to Antigravity (Classic)')}
                >
                    {isSwitching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    ) : (
                        <AntigravityClassicIcon className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                    )}
                </button>

                {/* Switch Target 2: Antigravity IDE */}
                <button
                    type="button"
                    className={cn(
                        "p-1.5 rounded-lg transition-all relative group/btn",
                        (isSwitching || isDisabled)
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400"
                    )}
                    onClick={() => onSwitch('ide')}
                    disabled={isSwitching || isDisabled}
                    title={isDisabled ? t('accounts.disabled_tooltip') : t('accounts.switch_to_ide', 'Switch to Antigravity IDE')}
                >
                    <AntigravityIdeIcon className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                </button>

                {/* Switch Target 3: Antigravity CLI (agy) */}
                <button
                    type="button"
                    className={cn(
                        "p-1.5 rounded-lg transition-all relative group/btn",
                        (isSwitching || isDisabled)
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                    )}
                    onClick={() => onSwitch('agy')}
                    disabled={isSwitching || isDisabled}
                    title={isDisabled ? t('accounts.disabled_tooltip') : t('accounts.switch_to_agy', 'Switch to Antigravity CLI (agy)')}
                >
                    <AntigravityCliIcon className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                </button>
            </div>

            {/* Quick Actions Group */}
            <div className="flex items-center gap-1">
                {/* Refresh Quota Button */}
                <button
                    type="button"
                    className={cn(
                        "p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all",
                        isRefreshing && "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50"
                    )}
                    onClick={onRefresh}
                    disabled={isRefreshing || isDisabled}
                    title={isDisabled ? t('accounts.disabled_tooltip') : (isRefreshing ? t('common.refreshing') : t('common.refresh'))}
                >
                    <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-emerald-500")} />
                </button>

                {/* Quota Details Modal Button */}
                <button
                    type="button"
                    className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 border border-transparent hover:border-cyan-200 dark:hover:border-cyan-800/50 transition-all"
                    onClick={onViewDetails}
                    title={t('common.details')}
                >
                    <Info className="w-3.5 h-3.5" />
                </button>

                {/* More Options Dropdown Trigger */}
                <button
                    ref={menuButtonRef}
                    type="button"
                    className={cn(
                        "p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all",
                        isMenuOpen && "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    )}
                    onClick={handleToggleMenu}
                    title={t('common.more_actions', 'More Actions')}
                >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Portal Dropdown Menu */}
            {isMenuOpen && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: `${menuPos.top}px`,
                        right: `${menuPos.right}px`,
                        zIndex: 9999,
                    }}
                    className="w-56 rounded-2xl bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 select-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                        {t('common.account_options', 'Account Options')}
                    </div>

                    {/* Menu Item: Device Fingerprint */}
                    <button
                        type="button"
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
                        onClick={() => {
                            setIsMenuOpen(false);
                            onViewDevice();
                        }}
                    >
                        <Fingerprint className="w-4 h-4 text-indigo-500" />
                        <span>{t('accounts.device_fingerprint', 'Device Fingerprint')}</span>
                    </button>

                    {/* Menu Item: Edit Label */}
                    {onEditLabel && (
                        <button
                            type="button"
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left"
                            onClick={() => {
                                setIsMenuOpen(false);
                                onEditLabel();
                            }}
                        >
                            <Tag className="w-4 h-4 text-amber-500" />
                            <span>{t('accounts.edit_label', 'Edit Custom Label')}</span>
                        </button>
                    )}

                    {/* Menu Item: Warmup */}
                    {onWarmup && (
                        <button
                            type="button"
                            className={cn(
                                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors text-left",
                                (isRefreshing || isDisabled)
                                    ? "opacity-50 cursor-not-allowed text-slate-400"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600 dark:hover:text-orange-400"
                            )}
                            onClick={() => {
                                setIsMenuOpen(false);
                                onWarmup();
                            }}
                            disabled={isRefreshing || isDisabled}
                        >
                            <Sparkles className="w-4 h-4 text-orange-500" />
                            <span>{t('accounts.warmup_this', 'Pre-warm Account')}</span>
                        </button>
                    )}

                    {/* Menu Item: Toggle Proxy Pool */}
                    <button
                        type="button"
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-left"
                        onClick={() => {
                            setIsMenuOpen(false);
                            onToggleProxy();
                        }}
                    >
                        <div className="flex items-center gap-2.5">
                            {account.proxy_disabled ? (
                                <ToggleLeft className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ToggleRight className="w-4 h-4 text-emerald-500" />
                            )}
                            <span>{account.proxy_disabled ? t('accounts.enable_proxy', 'Enable in Proxy Pool') : t('accounts.disable_proxy', 'Disable in Proxy Pool')}</span>
                        </div>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
                            account.proxy_disabled
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}>
                            {account.proxy_disabled ? t('common.off', 'OFF') : t('common.on', 'ON')}
                        </span>
                    </button>

                    {/* Menu Item: Export Account */}
                    <button
                        type="button"
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-600 dark:hover:text-sky-400 transition-colors text-left"
                        onClick={() => {
                            setIsMenuOpen(false);
                            onExport();
                        }}
                    >
                        <Download className="w-4 h-4 text-sky-500" />
                        <span>{t('common.export', 'Export JSON')}</span>
                    </button>

                    {/* Danger Zone Divider */}
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

                    {/* Menu Item: Delete Account */}
                    <button
                        type="button"
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left"
                        onClick={() => {
                            setIsMenuOpen(false);
                            onDelete();
                        }}
                    >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        <span>{t('common.delete', 'Delete Account')}</span>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}
