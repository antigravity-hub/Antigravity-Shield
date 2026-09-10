import { useMemo, useState } from 'react';
import { Lock, Ban, Diamond, Gem, Circle, X, Check, Clock, Bot, Sparkles, Tag } from 'lucide-react';
import { Account, ModelQuota } from '../../types/account';
import { cn } from '../../utils/cn';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { QuotaItem } from './QuotaItem';
import { MODEL_CONFIG, sortModels, getModelProtectionKey, resolveQuotaModels, ensurePinnedImageSelector } from '../../config/modelConfig';
import { getValidationBlockedStatusLabel } from './accountValidationStatus';
import { getLiveLimitForModel } from '../../utils/liveLimit';
import { AccountActionControls } from './AccountActionControls';
import { WeeklyCountdown } from './WeeklyCountdown';
import { useAccountStore } from '../../stores/useAccountStore';

interface AccountCardProps {
    account: Account;
    selected: boolean;
    onSelect: () => void;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching?: boolean;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onViewDevice: () => void;
    onViewDetails: () => void;
    onExport: () => void;
    onDelete: () => void;
    onToggleProxy: () => void;
    onWarmup?: () => void;
    onUpdateLabel?: (label: string) => void;
    onViewError: () => void;
    quotaWindow?: '5h' | 'weekly';
}

// 使用统一的模型配置
const DEFAULT_MODELS = Object.entries(MODEL_CONFIG).map(([id, config]) => ({
    id,
    label: config.label,
    protectedKey: config.protectedKey,
    Icon: config.Icon
}));

function AccountCard({ account, selected, onSelect, isCurrent: propIsCurrent, isRefreshing, isSwitching = false, onSwitch, onRefresh, onViewDetails, onExport, onDelete, onToggleProxy, onViewDevice, onWarmup, onUpdateLabel, onViewError, quotaWindow }: AccountCardProps) {
    const { t } = useTranslation();
    const { config, showAllQuotas } = useConfigStore();
    const currentTargetIde = useAccountStore((state) => state.currentTargetIde);
    const isTargetActiveForAccount = useAccountStore((state) => state.isTargetActiveForAccount);
    const hasAnyActiveTarget = useAccountStore((state) => state.hasAnyActiveTarget);
    const isDisabled = Boolean(account.disabled);
    const validationBlockedLabel = getValidationBlockedStatusLabel(account.validation_blocked_reason, t);

    const isPlatformActive = isTargetActiveForAccount(account.id, 'platform');
    const isIdeActive = isTargetActiveForAccount(account.id, 'ide');
    const isCliActive = isTargetActiveForAccount(account.id, 'agy');
    const isAnyActive = hasAnyActiveTarget(account.id) || propIsCurrent;

    const getActiveBadgeLabel = (target: string | null | undefined) => {
        switch (target) {
            case 'ide':
                return 'IDE Active';
            case 'platform':
                return 'Platform Active';
            case 'agy':
                return 'CLI Active';
            default:
                return 'Active';
        }
    };

    // 自定义标签编辑状态
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState(account.custom_label || '');

    // Use the prop directly from parent component
    const isCurrent = propIsCurrent;

    const handleSaveLabel = () => {
        if (onUpdateLabel) {
            onUpdateLabel(labelInput.trim());
        }
        setIsEditingLabel(false);
    };

    const handleCancelLabel = () => {
        setLabelInput(account.custom_label || '');
        setIsEditingLabel(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveLabel();
        } else if (e.key === 'Escape') {
            handleCancelLabel();
        }
    };

    const displayModels = useMemo(() => {
        // Build map of friendly labels and icons from DEFAULT_MODELS
        const iconMap = new Map(DEFAULT_MODELS.map(m => [m.id, m.Icon]));

        // Get all models from account (source of truth)
        const accountModels = account.quota?.models?.map(m => {
            // 注意：DEFAULT_MODELS 现在应该包含 shortLabel，我们需要确保它被正确映射
            // 但 DEFAULT_MODELS 是从 MODEL_CONFIG 生成的，我们需要确保它包含 shortLabel
            // 这里为了安全，直接从 MODEL_CONFIG 获取
            const fullConfig = MODEL_CONFIG[m.name.toLowerCase()];
            return {
                id: m.name,
                label: m.display_name || fullConfig?.shortLabel || fullConfig?.label || m.name,
                protectedKey: getModelProtectionKey(m.name) ?? fullConfig?.protectedKey ?? m.name,
                Icon: iconMap.get(m.name) || Bot,
                data: m
            };
        }) || [];

        let models: typeof accountModels;

        if (showAllQuotas) {
            models = accountModels;
        } else {
            // Filter for pinned or defaults
            const pinned = config?.pinned_quota_models?.models;
            if (pinned && pinned.length > 0) {
                const selections = resolveQuotaModels(
                    accountModels.map(m => m.data),
                    ensurePinnedImageSelector(pinned),
                );
                models = selections
                    .map(sel => sel.model ? accountModels.find(am => am.data === sel.model) : undefined)
                    .filter((m): m is typeof accountModels[number] => m !== undefined);
                // 也保留无配额数据的 pinned 模型（显示 0%）
                for (const sel of selections) {
                    if (!sel.model) {
                        const selectorConfig = MODEL_CONFIG[sel.selectorId.toLowerCase()];
                        if (selectorConfig) {
                            models = [...models, {
                                id: sel.selectorId,
                                label: selectorConfig.shortLabel || selectorConfig.label,
                                protectedKey: selectorConfig.protectedKey,
                                Icon: selectorConfig.Icon,
                                data: { name: sel.selectorId, percentage: 0 } as ModelQuota,
                            }];
                        }
                    }
                }
            } else {
                // Default fallback: show known default models, plus we show all dynamic pinned models
                // 暂时退化：如果没有 config 就不阻拦了？不，没有 pinned 就显示内置+有 display_name 的。
                models = accountModels.filter(m => DEFAULT_MODELS.some(d => d.id === m.id) || m.data.display_name);
            }
        }

        // 应用排序并过滤过期模型
        return sortModels(models).filter(m => m.id !== 'claude-sonnet-4-6-thinking' && m.id !== 'claude-sonnet-4-5-thinking' && m.id !== 'claude-opus-4-5-thinking');
    }, [config, account, showAllQuotas]);

    // 解析周配额项 (当处于 weekly 视图时)
    const weeklyItems = useMemo(() => {
        if (quotaWindow !== 'weekly') return [];
        return (account.quota?.quota_groups || []).flatMap(group => {
            return group.buckets
                .filter(b => (b.window || '').toLowerCase().includes('week') || (b.bucket_id || '').toLowerCase().includes('week'))
                .map(b => {
                    const shortGroupName = group.display_name
                        .replace(/ models?$/i, '')
                        .replace(/Claude and GPT/i, 'Claude/GPT');
                    const weeklySuffix = t('accounts.quota_window_weekly_short', 'Weekly');
                    return {
                        id: `${group.display_name}-${b.bucket_id}`,
                        label: b.display_name ? `${shortGroupName} (${b.display_name})` : `${shortGroupName} (${weeklySuffix})`,
                        percentage: Math.round((b.remaining_fraction || 0) * 100),
                        resetTime: b.reset_time,
                        Icon: shortGroupName.toLowerCase().includes('claude') ? Sparkles : Bot,
                    };
                });
        });
    }, [quotaWindow, account.quota?.quota_groups, t]);

    // 解析 5H 配额项 (当处于 5h 视图时)
    const fiveHourItems = useMemo(() => {
        if (quotaWindow !== '5h') return [];
        return (account.quota?.quota_groups || []).flatMap(group => {
            return group.buckets
                .filter(b => {
                    const win = (b.window || '').toLowerCase();
                    const id = (b.bucket_id || '').toLowerCase();
                    return win.includes('5h') || id.includes('5h') || win.includes('hour') || id.includes('hour');
                })
                .map(b => {
                    const shortGroupName = group.display_name
                        .replace(/ models?$/i, '')
                        .replace(/Claude and GPT/i, 'Claude/GPT');
                    return {
                        id: `${group.display_name}-${b.bucket_id}`,
                        label: b.display_name ? `${shortGroupName} (${b.display_name})` : `${shortGroupName} (5H)`,
                        percentage: Math.round((b.remaining_fraction || 0) * 100),
                        resetTime: b.reset_time,
                        Icon: shortGroupName.toLowerCase().includes('claude') ? Sparkles : Bot,
                    };
                });
        });
    }, [quotaWindow, account.quota?.quota_groups]);

    // 5H 倒计时计算
    const fiveHourResetInfo = useMemo(() => {
        if (quotaWindow !== '5h') return null;
        let resetTime: string | null = null;
        let minDiff = Infinity;
        const now = Date.now();

        for (const group of account.quota?.quota_groups || []) {
            for (const b of group.buckets || []) {
                const win = (b.window || '').toLowerCase();
                const id = (b.bucket_id || '').toLowerCase();
                if ((win.includes('5h') || id.includes('5h') || win.includes('hour')) && b.reset_time) {
                    const diff = new Date(b.reset_time).getTime() - now;
                    if (diff > 0 && diff < minDiff) {
                        minDiff = diff;
                        resetTime = b.reset_time;
                    }
                }
            }
        }
        if (!resetTime && account.quota?.models) {
            for (const m of account.quota.models) {
                if (m.reset_time) {
                    const diff = new Date(m.reset_time).getTime() - now;
                    if (diff > 0 && diff < minDiff) {
                        minDiff = diff;
                        resetTime = m.reset_time;
                    }
                }
            }
        }
        if (!resetTime || minDiff <= 0) return { isReady: true, hours: 0, minutes: 0, resetTime: null };
        const totalMinutes = Math.ceil(minDiff / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return { isReady: false, hours, minutes, resetTime };
    }, [quotaWindow, account.quota]);

    const isModelProtected = (key?: string) => {
        if (!key) return false;
        return account.protected_models?.includes(key);
    };

    return (
        <div className={cn(
            "flex flex-col p-3 rounded-xl border transition-all hover:shadow-md",
            isAnyActive
                ? "bg-emerald-50/20 border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-700/60 ring-1 ring-emerald-500/20"
                : "bg-white dark:bg-base-100 border-gray-200 dark:border-base-300",
            (isRefreshing || isDisabled) && "opacity-70"
        )}>

            {/* Header: Checkbox + Email + Badges */}
            <div className="flex-none flex items-start gap-3 mb-2">
                <input
                    type="checkbox"
                    className="mt-1 checkbox checkbox-xs rounded border-2 border-gray-400 dark:border-gray-500 checked:border-blue-600 checked:bg-blue-600 [--chkbg:theme(colors.blue.600)] [--chkfg:white]"
                    checked={selected}
                    onChange={() => onSelect()}
                    onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <h3 className={cn(
                        "font-semibold text-sm truncate w-full",
                        isAnyActive ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-gray-900 dark:text-base-content"
                    )} title={account.email}>
                        {account.email}
                    </h3>
                    <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {isPlatformActive && (
                                <span 
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-500/30"
                                    title="Active in Antigravity Platform"
                                >
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_5px_#10b981]"></span>
                                    </span>
                                    Platform
                                </span>
                            )}
                            {isIdeActive && (
                                <span 
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[9px] font-extrabold border border-sky-500/30"
                                    title="Active in Antigravity IDE"
                                >
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500 shadow-[0_0_5px_#0284c7]"></span>
                                    </span>
                                    IDE
                                </span>
                            )}
                            {isCliActive && (
                                <span 
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-extrabold border border-indigo-500/30"
                                    title="Active in Antigravity CLI"
                                >
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500 shadow-[0_0_5px_#6366f1]"></span>
                                    </span>
                                    CLI
                                </span>
                            )}
                            {!isPlatformActive && !isIdeActive && !isCliActive && isCurrent && (
                                <span
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold shadow-xs border border-emerald-500/30 dark:border-emerald-500/40 select-none tracking-wide"
                                    title={`Active in Antigravity ${getActiveBadgeLabel(currentTargetIde).replace(' Active', '')}`}
                                >
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_5px_#10b981]"></span>
                                    </span>
                                    {getActiveBadgeLabel(currentTargetIde)}
                                </span>
                            )}
                            {isDisabled && (
                                <span
                                    className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[9px] font-bold flex items-center gap-1 shadow-sm border border-rose-200/50"
                                >
                                    <Ban className="w-2.5 h-2.5" />
                                    {t('accounts.disabled').toUpperCase()}
                                </span>
                            )}
                            {account.proxy_disabled && (
                                <span
                                    className="px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[9px] font-bold flex items-center gap-1 shadow-sm border border-orange-200/50"
                                >
                                    <Ban className="w-2.5 h-2.5" />
                                    {t('accounts.proxy_disabled').toUpperCase()}
                                </span>
                            )}
                            {account.quota?.is_forbidden && (
                                <span className="px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[9px] font-bold flex items-center gap-1 shadow-sm border border-red-200/50">
                                    <Lock className="w-2.5 h-2.5" />
                                    {t('accounts.forbidden').toUpperCase()}
                                </span>
                            )}
                            {account.validation_blocked && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[9px] font-bold flex items-center gap-1 shadow-sm border border-amber-200/50">
                                    <Clock className="w-2.5 h-2.5" />
                                    {validationBlockedLabel.toUpperCase()}
                                </span>
                            )}
                            {/* 订阅类型徽章 */}
                            {account.quota?.subscription_tier && (() => {
                                const tier = account.quota.subscription_tier.toLowerCase();
                                if (tier.includes('ultra')) {
                                    return (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[9px] font-bold shadow-sm">
                                            <Gem className="w-2.5 h-2.5 fill-current" />
                                            ULTRA
                                        </span>
                                    );
                                } else if (tier.includes('pro')) {
                                    return (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-bold shadow-sm">
                                            <Diamond className="w-2.5 h-2.5 fill-current" />
                                            PRO
                                        </span>
                                    );
                                } else {
                                    return (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 text-[9px] font-bold shadow-sm border border-gray-200 dark:border-white/10">
                                            <Circle className="w-2.5 h-2.5" />
                                            FREE
                                        </span>
                                    );
                                }
                            })()}
                            {/* 自定义标签 */}
                            {account.custom_label && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[9px] font-bold shadow-sm border border-orange-200/50 dark:border-orange-800/50">
                                    <Tag className="w-2.5 h-2.5" />
                                    {account.custom_label}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono shrink-0 whitespace-nowrap">
                            {new Date(account.last_used * 1000).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>


            {/* 配额展示 */}
            <div className="flex-1 px-2 mb-2 overflow-y-auto scrollbar-none">
                {isDisabled || account.quota?.is_forbidden || account.proxy_disabled || account.validation_blocked ? (
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 h-full py-4 text-center">
                        <div className={cn(
                            "flex items-center gap-1.5",
                            account.validation_blocked ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {account.validation_blocked ? <Clock className="w-4 h-4" /> : (isDisabled || account.proxy_disabled ? <Ban className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                            <span className="text-[11px] font-bold">
                                {account.validation_blocked ? validationBlockedLabel : (isDisabled ? t('accounts.status.disabled') : account.proxy_disabled ? t('accounts.status.proxy_disabled') : t('accounts.forbidden_msg'))}
                            </span>
                        </div>
                        <div className={cn(
                            "w-px h-3 hidden sm:block",
                            account.validation_blocked ? "bg-amber-200 dark:bg-amber-800/50" : "bg-red-200 dark:bg-red-800/50"
                        )} />
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewError(); }}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                            {t('accounts.view_error')}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2 content-start">
                        {quotaWindow === '5h' && fiveHourItems.length > 0 ? (
                            fiveHourItems.map((item) => (
                                <QuotaItem
                                    key={item.id}
                                    label={item.label}
                                    percentage={item.percentage}
                                    resetTime={item.resetTime}
                                    Icon={item.Icon}
                                />
                            ))
                        ) : quotaWindow === 'weekly' && weeklyItems.length > 0 ? (
                            weeklyItems.map((item) => (
                                <QuotaItem
                                    key={item.id}
                                    label={item.label}
                                    percentage={item.percentage}
                                    resetTime={item.resetTime}
                                    Icon={item.Icon}
                                />
                            ))
                        ) : (
                            displayModels.map((model) => (
                                <QuotaItem
                                    key={model.id}
                                    label={model.label}
                                    percentage={model.data?.percentage || 0}
                                    resetTime={model.data?.reset_time}
                                    isProtected={isModelProtected(model.protectedKey)}
                                    liveLimit={getLiveLimitForModel(account, model.id, model.protectedKey)}
                                    Icon={model.Icon}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* 配额重置倒计时: 5H 模式展示 5小时滚动重置，Weekly 模式展示周阶梯 */}
            <div className="px-2 pb-2">
                {quotaWindow === '5h' ? (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-xs">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-cyan-500" />
                            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                                {fiveHourResetInfo?.isReady ? '0h 0m' : `${fiveHourResetInfo?.hours || 0}h ${fiveHourResetInfo?.minutes || 0}m`}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {t('accounts.quota_5h', '5-Hour Rolling')}
                            </span>
                        </div>
                        <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded font-mono",
                            fiveHourResetInfo?.isReady
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                        )}>
                            {fiveHourResetInfo?.isReady ? t('common.ready', 'Ready') : t('accounts.rolling_5h', '5H Rolling')}
                        </span>
                    </div>
                ) : (
                    <WeeklyCountdown account={account} layout="card" />
                )}
            </div>

            {/* Footer: Actions Only */}
            <div className="flex-none flex items-center justify-center pt-2 pb-1 border-t border-gray-100 dark:border-base-200">
                {/* 标签编辑弹出框 */}
                {isEditingLabel && (
                    <div className="absolute inset-0 bg-white/95 dark:bg-base-100/95 rounded-xl z-10 flex items-center justify-center p-4">
                        <div className="flex items-center gap-2 w-full max-w-xs">
                            <input
                                type="text"
                                className="flex-1 px-2 py-1 text-sm border border-orange-300 dark:border-orange-700 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-base-200"
                                placeholder={t('accounts.custom_label_placeholder', 'Enter custom label')}
                                value={labelInput}
                                onChange={(e) => setLabelInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                maxLength={15}
                            />
                            <button
                                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-all"
                                onClick={handleSaveLabel}
                                title={t('common.save', 'Save')}
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                onClick={handleCancelLabel}
                                title={t('common.cancel', 'Cancel')}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
                <AccountActionControls
                    account={account}
                    isCurrent={isCurrent}
                    isRefreshing={isRefreshing}
                    isSwitching={isSwitching}
                    isDisabled={isDisabled}
                    onSwitch={onSwitch}
                    onRefresh={onRefresh}
                    onViewDevice={onViewDevice}
                    onViewDetails={onViewDetails}
                    onExport={onExport}
                    onDelete={onDelete}
                    onToggleProxy={onToggleProxy}
                    onWarmup={onWarmup}
                    onEditLabel={onUpdateLabel ? () => setIsEditingLabel(true) : undefined}
                    layout="card"
                />
            </div>
        </div >
    );
}

export default AccountCard;
