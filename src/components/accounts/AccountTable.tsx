/**
 * 账号表格组件
 * 支持拖拽排序功能，用户可以通过拖拽行来调整账号顺序
 */
import { useMemo, useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    Lock,
    Ban,
    Diamond,
    Gem,
    Circle,
    X,
    Check,
    Clock,
    Bot,
    Tag,
} from 'lucide-react';
import type { Account, ModelQuota } from '../../types/account';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { QuotaItem } from './QuotaItem';
import { WeeklyCountdown } from './WeeklyCountdown';
import { MODEL_CONFIG, sortModels, getModelProtectionKey, resolveQuotaModels, ensurePinnedImageSelector } from '../../config/modelConfig';
import { categorizeModel } from '../../utils/modelCategory';
import { getAccountFiveHourReset, isAccountQuotaExhausted } from '../../utils/quota';
import { cn } from '../../utils/cn';
import { getValidationBlockedStatusLabel } from './accountValidationStatus';
import { getLiveLimitForModel } from '../../utils/liveLimit';
import { AccountActionControls } from './AccountActionControls';

// ============================================================================
// 类型定义
// ============================================================================

interface AccountTableProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleAll: () => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    switchingTarget?: string | null;
    onSwitch: (accountId: string, targetIde?: string) => void;
    onRefresh: (accountId: string) => void;
    onViewDevice: (accountId: string) => void;
    onViewDetails: (accountId: string) => void;
    onExport: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onToggleProxy: (accountId: string) => void;
    onWarmup?: (accountId: string) => void;
    onUpdateLabel?: (accountId: string, label: string) => void;
    /** 拖拽排序回调，当用户完成拖拽时触发 */
    onReorder?: (accountIds: string[]) => void;
    onViewError: (accountId: string) => void;
    quotaWindow?: '5h' | 'weekly';
    quotaProvider?: 'gemini' | 'claude';
    showLastUsed?: boolean;
}

interface SortableRowProps {
    account: Account;
    selected: boolean;
    isRefreshing: boolean;
    isCurrent: boolean;
    isSwitching: boolean;
    switchingTarget?: string | null;
    isDragging?: boolean;
    onSelect: () => void;
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
    quotaProvider?: 'gemini' | 'claude';
    showLastUsed?: boolean;
    columnOrder: string[];
}

interface AccountRowContentProps {
    account: Account;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching: boolean;
    switchingTarget?: string | null;
    isDisabled: boolean;
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
    quotaProvider?: 'gemini' | 'claude';
    showLastUsed?: boolean;
    columnOrder: string[];
}

// ============================================================================
// 辅助函数
// ============================================================================



function isModelProtected(protectedModels: string[] | undefined, modelName: string): boolean {
    if (!protectedModels || protectedModels.length === 0) return false;
    const lowerName = modelName.toLowerCase();

    if (lowerName === 'gemini-pro') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'gemini-pro' && getModelProtectionKey(model) === 'gemini-3-pro-high',
        );
    }
    if (lowerName === 'gemini-flash') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'gemini-flash' && getModelProtectionKey(model) === 'gemini-3-flash',
        );
    }
    if (lowerName === 'claude-sonnet') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'claude' && getModelProtectionKey(model) === 'claude',
        );
    }

    const protectionKey = getModelProtectionKey(lowerName);
    return protectionKey ? protectedModels.includes(protectionKey) : false;
}

// ============================================================================
// 子组件
// ============================================================================

/**
 * 可拖拽的表格行组件
 * 使用 @dnd-kit/sortable 实现拖拽功能
 */
function SortableAccountRow({
    account,
    selected,
    isRefreshing,
    isCurrent,
    isSwitching,
    switchingTarget,
    isDragging,
    onSelect,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onWarmup,
    onUpdateLabel,
    onViewError,
    quotaWindow,
    quotaProvider = 'gemini',
    showLastUsed,
    columnOrder,
}: SortableRowProps) {
    const { t } = useTranslation();
    const hasAnyActiveTarget = useAccountStore((state) => state.hasAnyActiveTarget);
    const isAnyActive = hasAnyActiveTarget(account.id) || isCurrent;
    const isExhausted = isAccountQuotaExhausted(account);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id: account.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.5 : 1,
        zIndex: isSortableDragging ? 1000 : 'auto',
    };

    return (
        <tr
            ref={setNodeRef}
            style={style as React.CSSProperties}
            className={cn(
                "group transition-colors border-b border-gray-100 dark:border-base-200",
                isAnyActive && "bg-emerald-50/40 dark:bg-emerald-950/20",
                isDragging && "bg-emerald-100 dark:bg-emerald-900/30 shadow-lg",
                !isDragging && !isAnyActive && "hover:bg-gray-50 dark:hover:bg-base-200",
                !isDragging && isAnyActive && "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30",
                isExhausted && "opacity-60 grayscale bg-slate-50/70 dark:bg-slate-900/40 hover:opacity-85 transition-opacity"
            )}
        >
            {/* 拖拽手柄 */}
            <td className="pl-2 py-1 w-8 align-middle">
                <div
                    {...attributes}
                    {...listeners}
                    className="flex items-center justify-center w-6 h-6 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={t('accounts.drag_to_reorder')}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </td>
            {/* 复选框 */}
            <td className="px-2 py-1 w-10 align-middle">
                <input
                    type="checkbox"
                    className="checkbox checkbox-sm rounded border-2 border-gray-400 dark:border-gray-500 checked:border-blue-600 checked:bg-blue-600 [--chkbg:theme(colors.blue.600)] [--chkfg:white]"
                    checked={selected}
                    onChange={onSelect}
                    disabled={isRefreshing}
                />
            </td>
            <AccountRowContent
                account={account}
                isCurrent={isCurrent}
                isRefreshing={isRefreshing}
                isSwitching={isSwitching}
                switchingTarget={switchingTarget}
                isDisabled={Boolean(account.disabled)}
                onSwitch={onSwitch}
                onRefresh={onRefresh}
                onViewDevice={onViewDevice}
                onViewDetails={onViewDetails}
                onExport={onExport}
                onDelete={onDelete}
                onToggleProxy={onToggleProxy}
                onWarmup={onWarmup}
                onUpdateLabel={onUpdateLabel}
                onViewError={onViewError}
                quotaWindow={quotaWindow}
                quotaProvider={quotaProvider}
                showLastUsed={showLastUsed}
                columnOrder={columnOrder}
            />
        </tr>
    );
}

/**
 * 账号行内容组件
 * 渲染邮箱、配额、最后使用时间和操作按钮等列
 */
function AccountRowContent({
    account,
    isCurrent,
    isRefreshing,
    isSwitching,
    switchingTarget,
    isDisabled,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onWarmup,
    onUpdateLabel,
    onViewError,
    quotaWindow: _quotaWindow,
    quotaProvider = 'gemini',
    showLastUsed,
    columnOrder,
}: AccountRowContentProps) {
    const { t } = useTranslation();
    const { config, showAllQuotas } = useConfigStore();
    const isTargetActiveForAccount = useAccountStore((state) => state.isTargetActiveForAccount);
    const isPlatformActive = isTargetActiveForAccount(account.id, 'platform');
    const isIdeActive = isTargetActiveForAccount(account.id, 'ide');
    const isCliActive = isTargetActiveForAccount(account.id, 'agy');
    const isAnyActive = isPlatformActive || isIdeActive || isCliActive || isCurrent;
    const isExhausted = isAccountQuotaExhausted(account);
    const validationBlockedLabel = getValidationBlockedStatusLabel(account.validation_blocked_reason, t);

    // 自定义标签编辑状态
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState(account.custom_label || '');

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

    // 获取要显示的模型列表
    const pinnedModels = ensurePinnedImageSelector(
        config?.pinned_quota_models?.models || Object.keys(MODEL_CONFIG),
    );

    // 根据 show_all 状态决定显示哪些模型
    const uniqueLabels = new Set<string>();
    const displayModels = sortModels(
        (showAllQuotas
            ? (account.quota?.models || []).map(m => {
                const config = MODEL_CONFIG[m.name.toLowerCase()];
                const label = m.display_name || (config?.i18nKey ? t(config.i18nKey) : (config?.shortLabel || config?.label || m.name));
                return {
                    id: m.name.toLowerCase(),
                    label: label,
                    protectedKey: config?.protectedKey || m.name.toLowerCase(),
                    data: m
                };
            })
            : resolveQuotaModels(account.quota?.models, pinnedModels).map(sel => {
                const selectorConfig = MODEL_CONFIG[sel.selectorId.toLowerCase()];
                const resolvedConfig = sel.model ? MODEL_CONFIG[sel.model.name.toLowerCase()] : undefined;
                if (!selectorConfig && !sel.model) return null;
                const label = sel.model?.display_name
                    || (resolvedConfig?.shortLabel || resolvedConfig?.label)
                    || (selectorConfig?.shortLabel || selectorConfig?.label)
                    || (resolvedConfig?.i18nKey ? t(resolvedConfig.i18nKey) : undefined)
                    || (selectorConfig?.i18nKey ? t(selectorConfig.i18nKey) : undefined)
                    || sel.selectorId;
                return {
                    id: sel.model?.name.toLowerCase() ?? sel.selectorId.toLowerCase(),
                    label,
                    protectedKey: getModelProtectionKey(sel.model?.name ?? sel.selectorId) ?? resolvedConfig?.protectedKey ?? selectorConfig?.protectedKey ?? sel.selectorId,
                    data: sel.model,
                };
            }).filter((item): item is { id: string; label: string; protectedKey: string; data: ModelQuota | undefined } => item !== null)
    ).filter(m => {
            const isHiddenThinking = m.id.includes('thinking') && (
                showAllQuotas || (account.quota?.models || []).some(other =>
                    !other.name.toLowerCase().includes('thinking') &&
                    getModelProtectionKey(other.name) === m.protectedKey
                )
            );

            if (isHiddenThinking) return false;

            const labelKey = `${m.label}-${m.protectedKey}`;
            if (uniqueLabels.has(labelKey)) {
                return false;
            }
            if (m.data) {
                uniqueLabels.add(labelKey);
                return true;
            }
            return true;
        })
    ).filter((m, index, self) => {
        const labelKey = `${m.label}-${m.protectedKey}`;
        return self.findIndex(t => `${t.label}-${t.protectedKey}` === labelKey) === index;
    });

    const renderEmailCell = () => (
        <td key="email" className="px-2 py-1 align-middle w-[260px] min-w-[240px]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className={cn(
                    "font-medium text-sm break-all transition-colors",
                    isAnyActive ? "text-emerald-700 dark:text-emerald-400 font-semibold" : "text-gray-900 dark:text-base-content"
                )} title={account.email}>
                    {account.email}
                </span>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {isPlatformActive && (
                        <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30"
                            title="Active in Antigravity Platform"
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                            </span>
                            Platform
                        </span>
                    )}
                    {isIdeActive && (
                        <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[10px] font-extrabold border border-sky-500/30"
                            title="Active in Antigravity IDE"
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500 shadow-[0_0_6px_#0284c7]"></span>
                            </span>
                            IDE
                        </span>
                    )}
                    {isCliActive && (
                        <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold border border-indigo-500/30"
                            title="Active in Antigravity CLI"
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500 shadow-[0_0_6px_#6366f1]"></span>
                            </span>
                            CLI
                        </span>
                    )}
                    {!isPlatformActive && !isIdeActive && !isCliActive && isCurrent && (
                        <span 
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30"
                            title="Active in Antigravity"
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
                            </span>
                            Active
                        </span>
                    )}
                    {isDisabled && (
                        <span
                            className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-rose-200/50"
                        >
                            <Ban className="w-2.5 h-2.5" />
                            <span>{t('accounts.disabled')}</span>
                        </span>
                    )}

                    {account.proxy_disabled && (
                        <span
                            className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-orange-200/50"
                        >
                            <Ban className="w-2.5 h-2.5" />
                            <span>{t('accounts.proxy_disabled')}</span>
                        </span>
                    )}

                    {account.quota?.is_forbidden && (
                        <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-red-200/50">
                            <Lock className="w-2.5 h-2.5" />
                            <span>{t('accounts.forbidden')}</span>
                        </span>
                    )}
                    {account.validation_blocked && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-amber-200/50">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{validationBlockedLabel}</span>
                        </span>
                    )}

                    {isExhausted && (
                        <span
                            className="px-2 py-0.5 rounded-md bg-slate-200/90 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-slate-300/60 dark:border-slate-700/60"
                            title={t('accounts.exhausted_tooltip', 'Weekly and 5-hour quotas are exhausted. Waiting for cycle reset.')}
                        >
                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                            <span>{t('accounts.exhausted', 'Quota Exhausted')}</span>
                        </span>
                    )}

                    {account.quota?.subscription_tier && (() => {
                        const tier = account.quota.subscription_tier.toLowerCase();
                        if (tier.includes('ultra')) {
                            return (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold shadow-sm hover:scale-105 transition-transform cursor-default">
                                    <Gem className="w-2.5 h-2.5 fill-current" />
                                    {t('accounts.ultra')}
                                </span>
                            );
                        } else if (tier.includes('pro')) {
                            return (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold shadow-sm hover:scale-105 transition-transform cursor-default">
                                    <Diamond className="w-2.5 h-2.5 fill-current" />
                                    {t('accounts.pro')}
                                </span>
                            );
                        } else {
                            return (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 text-[10px] font-bold shadow-sm border border-gray-200 dark:border-white/10 hover:bg-gray-200 transition-colors cursor-default">
                                    <Circle className="w-2.5 h-2.5" />
                                    {t('accounts.free')}
                                </span>
                            );
                        }
                    })()}

                    {account.custom_label && !isEditingLabel && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold shadow-sm border border-orange-200/50 dark:border-orange-800/50">
                            <Tag className="w-2.5 h-2.5" />
                            {account.custom_label}
                        </span>
                    )}

                    {isEditingLabel && (
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                className="px-1.5 py-0.5 text-[10px] w-20 border border-orange-300 dark:border-orange-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white dark:bg-base-200"
                                placeholder={t('accounts.custom_label_placeholder', 'Label')}
                                value={labelInput}
                                onChange={(e) => setLabelInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                maxLength={15}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                className="p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-all"
                                onClick={(e) => { e.stopPropagation(); handleSaveLabel(); }}
                            >
                                <Check className="w-3 h-3" />
                            </button>
                            <button
                                className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all"
                                onClick={(e) => { e.stopPropagation(); handleCancelLabel(); }}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </td>
    );

    const renderModelsCell = () => (
        <td key="models" className="px-2 py-1 align-middle min-w-[360px] xl:min-w-[420px] 2xl:min-w-[480px]">
            {isDisabled || account.quota?.is_forbidden || account.validation_blocked ? (
                <div className={cn(
                    "flex items-center justify-center gap-3 py-1.5 px-4 rounded-xl border group/error",
                    account.validation_blocked ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-100/50 dark:border-amber-900/20" : "bg-red-50/50 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/20"
                )}>
                    <div className={cn(
                        "flex items-center gap-1.5",
                        account.validation_blocked ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                    )}>
                        {account.validation_blocked ? <Clock className="w-3.5 h-3.5" /> : (account.quota?.is_forbidden ? <Lock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />)}
                        <span className={cn(
                            "text-[11px] font-bold",
                            account.validation_blocked ? "text-amber-700/80 dark:text-amber-400" : "text-red-700/80 dark:text-red-400"
                        )}>
                            {account.validation_blocked ? validationBlockedLabel : (isDisabled ? t('accounts.status.disabled') : t('accounts.forbidden_msg'))}
                        </span>
                    </div>
                    <div className={cn(
                        "w-px h-3",
                        account.validation_blocked ? "bg-amber-200 dark:bg-amber-800/50" : "bg-red-200 dark:bg-red-800/50"
                    )} />
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewError(); }}
                        className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                        {t('accounts.view_error')}
                    </button>
                </div>
            ) : (
                <div className={cn(
                    "grid gap-x-2 gap-y-1 py-0",
                    displayModels.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                    {displayModels.map((model) => {
                        const modelData = model.data;
                        return (
                            <QuotaItem
                                key={model.id}
                                label={model.label}
                                percentage={modelData?.percentage || 0}
                                resetTime={modelData?.reset_time}
                                isProtected={isModelProtected(account.protected_models, model.protectedKey)}
                                liveLimit={getLiveLimitForModel(account, model.id, model.protectedKey)}
                                Icon={MODEL_CONFIG[model.id]?.Icon || Bot}
                            />
                        );
                    })}
                </div>
            )}
        </td>
    );

    const renderFiveHourCell = () => {
        const fiveHour = getAccountFiveHourReset(account, quotaProvider);
        if (!fiveHour.isAvailable) {
            return (
                <td key="five_hour" className="px-2 py-1 align-middle whitespace-nowrap w-[95px] min-w-[90px]">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        N/A (Free)
                    </span>
                </td>
            );
        }
        return (
            <td key="five_hour" className="px-2 py-1 align-middle whitespace-nowrap w-[95px] min-w-[90px]">
                <div className="flex items-center gap-1.5" title={fiveHour.resetTime ? `${quotaProvider.toUpperCase()} 5H Reset: ${new Date(fiveHour.resetTime).toLocaleString()}` : `${quotaProvider.toUpperCase()} 5H Quota Ready`}>
                    <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
                    <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                        {fiveHour.isReady ? '0h 0m' : `${fiveHour.hoursInDay}h ${fiveHour.minutesInHour}m`}
                    </span>
                    <span className={cn(
                        "text-[9px] font-bold px-1 py-0.2 rounded font-mono",
                        fiveHour.isReady
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                    )}>
                        5H
                    </span>
                </div>
            </td>
        );
    };

    const renderWeeklyCell = () => (
        <td key="weekly" className="px-2 py-1 align-middle whitespace-nowrap w-[100px] min-w-[95px]">
            <WeeklyCountdown account={account} provider={quotaProvider} layout="table" />
        </td>
    );

    const renderLastUsedCell = () => (
        <td key="last_used" className="px-2 py-1 align-middle w-[85px] min-w-[80px]">
            <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">
                    {new Date(account.last_used * 1000).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap leading-tight">
                    {new Date(account.last_used * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </td>
    );

    return (
        <>
            {columnOrder.map((colId) => {
                if (colId === 'email') return renderEmailCell();
                if (colId === 'models') return renderModelsCell();
                if (colId === 'five_hour') return renderFiveHourCell();
                if (colId === 'weekly') return renderWeeklyCell();
                if (colId === 'last_used' && showLastUsed) return renderLastUsedCell();
                return null;
            })}

            {/* 操作列 */}
            <td className={cn(
                "px-1 py-1 sticky right-0 z-10 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.1)] dark:shadow-[-12px_0_12px_-12px_rgba(255,255,255,0.05)] text-center align-middle w-[165px] min-w-[160px]",
                isAnyActive
                    ? "bg-[#ecfdf5] dark:bg-[#064e3b]/30"
                    : "bg-white dark:bg-base-100",
                !isAnyActive && "group-hover:bg-gray-50 dark:group-hover:bg-base-200"
            )}>
                <AccountActionControls
                    account={account}
                    isCurrent={isCurrent}
                    isRefreshing={isRefreshing}
                    isSwitching={isSwitching}
                    switchingTarget={switchingTarget}
                    isDisabled={isDisabled}
                    isExhausted={isExhausted}
                    onSwitch={onSwitch}
                    onRefresh={onRefresh}
                    onViewDevice={onViewDevice}
                    onViewDetails={onViewDetails}
                    onExport={onExport}
                    onDelete={onDelete}
                    onToggleProxy={onToggleProxy}
                    onWarmup={onWarmup}
                    onEditLabel={onUpdateLabel ? () => setIsEditingLabel(true) : undefined}
                    layout="table"
                />
            </td>
        </>
    );
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * 账号表格组件
 * 支持拖拽排序、多选、批量操作等功能
 */
const DEFAULT_COLUMN_ORDER = ['email', 'models', 'five_hour', 'weekly', 'last_used'];

function AccountTable({
    accounts,
    selectedIds,
    refreshingIds,
    onToggleSelect,
    onToggleAll,
    currentAccountId,
    switchingAccountId,
    switchingTarget,
    onSwitch,
    onRefresh,
    onViewDevice,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onReorder,
    onWarmup,
    onUpdateLabel,
    onViewError,
    quotaWindow,
    quotaProvider = 'gemini',
    showLastUsed = false,
}: AccountTableProps) {
    const { t } = useTranslation();

    const [activeId, setActiveId] = useState<string | null>(null);

    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('accounts_column_order');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const combined = [...parsed.filter((c: string) => DEFAULT_COLUMN_ORDER.includes(c))];
                    for (const def of DEFAULT_COLUMN_ORDER) {
                        if (!combined.includes(def)) combined.push(def);
                    }
                    return combined;
                }
            }
        } catch {
            // ignore
        }
        return [...DEFAULT_COLUMN_ORDER];
    });

    const handleColumnDrop = (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;
        setColumnOrder((prev) => {
            const oldIndex = prev.indexOf(draggedId);
            const newIndex = prev.indexOf(targetId);
            if (oldIndex === -1 || newIndex === -1) return prev;
            const newOrder = [...prev];
            const [removed] = newOrder.splice(oldIndex, 1);
            newOrder.splice(newIndex, 0, removed);
            try {
                localStorage.setItem('accounts_column_order', JSON.stringify(newOrder));
            } catch {
                // ignore
            }
            return newOrder;
        });
    };

    // 配置拖拽传感器
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }, // 需要移动 8px 才触发拖拽
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const accountIds = useMemo(() => accounts.map(a => a.id), [accounts]);
    const activeAccount = useMemo(() => accounts.find(a => a.id === activeId), [accounts, activeId]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = accountIds.indexOf(active.id as string);
            const newIndex = accountIds.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
                onReorder(arrayMove(accountIds, oldIndex, newIndex));
            }
        }
    };

    const renderColumnHeader = (colId: string) => {
        const commonHeaderProps = {
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
                e.dataTransfer.setData('text/plain', colId);
                e.dataTransfer.effectAllowed = 'move';
            },
            onDragOver: (e: React.DragEvent) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            },
            onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId) handleColumnDrop(draggedId, colId);
            },
            title: t('accounts.drag_column_to_reorder', '拖动表头调整列顺序'),
        };

        if (colId === 'email') {
            return (
                <th
                    key="email"
                    {...commonHeaderProps}
                    className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[260px] min-w-[240px] whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 dark:hover:bg-base-300 transition-colors"
                >
                    <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-gray-400 opacity-60" />
                        <span>{t('accounts.table.email')}</span>
                    </div>
                </th>
            );
        }
        if (colId === 'models') {
            return (
                <th
                    key="models"
                    {...commonHeaderProps}
                    className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[360px] xl:min-w-[420px] 2xl:min-w-[480px] whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 dark:hover:bg-base-300 transition-colors"
                >
                    <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-gray-400 opacity-60" />
                        <span>{t('accounts.table.quota')}</span>
                    </div>
                </th>
            );
        }
        if (colId === 'five_hour') {
            return (
                <th
                    key="five_hour"
                    {...commonHeaderProps}
                    className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[95px] min-w-[90px] whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 dark:hover:bg-base-300 transition-colors"
                >
                    <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-gray-400 opacity-60" />
                        <span>{t('accounts.table.five_hour_countdown', '5H Reset')}</span>
                    </div>
                </th>
            );
        }
        if (colId === 'weekly') {
            return (
                <th
                    key="weekly"
                    {...commonHeaderProps}
                    className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px] min-w-[95px] whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 dark:hover:bg-base-300 transition-colors"
                >
                    <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-gray-400 opacity-60" />
                        <span>{t('accounts.table.weekly_countdown', 'Weekly Reset')}</span>
                    </div>
                </th>
            );
        }
        if (colId === 'last_used' && showLastUsed) {
            return (
                <th
                    key="last_used"
                    {...commonHeaderProps}
                    className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[85px] min-w-[80px] whitespace-nowrap cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 dark:hover:bg-base-300 transition-colors"
                >
                    <div className="flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-gray-400 opacity-60" />
                        <span>{t('accounts.table.last_used')}</span>
                    </div>
                </th>
            );
        }
        return null;
    };

    if (accounts.length === 0) {
        return (
            <div className="bg-white dark:bg-base-100 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                <p className="text-gray-400 mb-2">{t('accounts.empty.title')}</p>
                <p className="text-sm text-gray-400">{t('accounts.empty.desc')}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-base-200 bg-gray-50 dark:bg-base-200">
                            <th className="pl-2 py-2 text-left w-8">
                                <span className="sr-only">{t('accounts.drag_to_reorder')}</span>
                            </th>
                            <th className="px-2 py-2 text-left w-10">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm rounded border-2 border-gray-400 dark:border-gray-500 checked:border-blue-600 checked:bg-blue-600 [--chkbg:theme(colors.blue.600)] [--chkfg:white]"
                                    checked={accounts.length > 0 && selectedIds.size === accounts.length}
                                    onChange={onToggleAll}
                                />
                            </th>
                            {columnOrder.map((colId) => renderColumnHeader(colId))}
                            <th className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap sticky right-0 w-[165px] min-w-[160px] bg-gray-50 dark:bg-base-200 z-20 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.1)] dark:shadow-[-12px_0_12px_-12px_rgba(255,255,255,0.05)] text-center">{t('accounts.table.actions')}</th>
                        </tr>
                    </thead>
                    <SortableContext items={accountIds} strategy={verticalListSortingStrategy}>
                        <tbody className="divide-y divide-gray-100 dark:divide-base-200">
                            {accounts.map((account) => (
                                <SortableAccountRow
                                    key={account.id}
                                    account={account}
                                    selected={selectedIds.has(account.id)}
                                    isRefreshing={refreshingIds.has(account.id)}
                                    isCurrent={account.id === currentAccountId}
                                    isSwitching={account.id === switchingAccountId}
                                    switchingTarget={account.id === switchingAccountId ? switchingTarget : null}
                                    isDragging={account.id === activeId}
                                    onSelect={() => onToggleSelect(account.id)}
                                    onSwitch={(targetIde?: string) => onSwitch(account.id, targetIde)}
                                    onRefresh={() => onRefresh(account.id)}
                                    onViewDevice={() => onViewDevice(account.id)}
                                    onViewDetails={() => onViewDetails(account.id)}
                                    onExport={() => onExport(account.id)}
                                    onDelete={() => onDelete(account.id)}
                                    onToggleProxy={() => onToggleProxy(account.id)}
                                    onWarmup={onWarmup ? () => onWarmup(account.id) : undefined}
                                    onUpdateLabel={onUpdateLabel ? (label: string) => onUpdateLabel(account.id, label) : undefined}
                                    onViewError={() => onViewError(account.id)}
                                    quotaWindow={quotaWindow}
                                    quotaProvider={quotaProvider}
                                    showLastUsed={showLastUsed}
                                    columnOrder={columnOrder}
                                />
                            ))}
                        </tbody>
                    </SortableContext>
                </table>
            </div>

            {/* 拖拽悬浮预览层 */}
            <DragOverlay>
                {
                    activeAccount ? (
                        <table className="w-full bg-white dark:bg-base-100 shadow-2xl rounded-lg border border-blue-200 dark:border-blue-800">
                            <tbody>
                                <tr className="bg-blue-50 dark:bg-blue-900/30">
                                    <td className="pl-2 py-1 w-8">
                                        <div className="flex items-center justify-center w-6 h-6 text-blue-500">
                                            <GripVertical className="w-4 h-4" />
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 w-10">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-xs rounded border-2"
                                            checked={selectedIds.has(activeAccount.id)}
                                            readOnly
                                        />
                                    </td>
                                    <AccountRowContent
                                        account={activeAccount}
                                        isCurrent={activeAccount.id === currentAccountId}
                                        isRefreshing={refreshingIds.has(activeAccount.id)}
                                        isSwitching={activeAccount.id === switchingAccountId}
                                        switchingTarget={activeAccount.id === switchingAccountId ? switchingTarget : null}
                                        onSwitch={() => { }}
                                        onRefresh={() => { }}
                                        onViewDevice={() => { }}
                                        onViewDetails={() => { }}
                                        onExport={() => { }}
                                        onDelete={() => { }}
                                        onToggleProxy={() => { }}
                                        isDisabled={Boolean(activeAccount.disabled)}
                                        onViewError={() => { }}
                                        quotaWindow={quotaWindow}
                                        quotaProvider={quotaProvider}
                                        showLastUsed={showLastUsed}
                                        columnOrder={columnOrder}
                                    />
                                </tr>
                            </tbody>
                        </table>
                    ) : null
                }
            </DragOverlay>
        </DndContext>
    );
}

export default AccountTable;
