import { useState, useMemo } from 'react';
import { Pin, Check, Layers, Cpu, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PinnedQuotaModelsConfig } from '../../types/config';
import { MODEL_CONFIG } from '../../config/modelConfig';
import { useAccountStore } from '../../stores/useAccountStore';
import { cn } from '../../utils/cn';

interface PinnedQuotaModelsProps {
    config: PinnedQuotaModelsConfig;
    onChange: (config: PinnedQuotaModelsConfig) => void;
}

interface ModelOption {
    id: string;
    label: string;
    title: string;
    desc: string;
    group: string;
    tier: 'pro' | 'flash' | 'image' | 'other';
    tierLabel: string;
}

function getModelFamily(id: string, group?: string): string {
    if (group) return group;
    const lower = id.toLowerCase();
    if (lower.startsWith('gemini-4')) return 'Gemini 4';
    if (lower.startsWith('gemini-3')) return 'Gemini 3';
    if (lower.startsWith('gemini-2')) return 'Gemini 2.5';
    if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('haiku')) return 'Claude';
    return 'Other';
}

function getModelTierInfo(id: string): { tier: 'pro' | 'flash' | 'image' | 'other'; label: string } {
    const lower = id.toLowerCase();
    if (lower.includes('image')) return { tier: 'image', label: 'Image' };
    if (lower.includes('pro')) return { tier: 'pro', label: 'Pro' };
    if (lower.includes('flash') || lower.includes('lite')) return { tier: 'flash', label: 'Flash' };
    return { tier: 'other', label: 'Standard' };
}

const FAMILY_ORDER = ['Gemini 3', 'Gemini 2.5', 'Gemini 4', 'Claude', 'Other'];

const PinnedQuotaModels = ({ config, onChange }: PinnedQuotaModelsProps) => {
    const { t } = useTranslation();
    const [selectedFamily, setSelectedFamily] = useState<string>('all');
    const [selectedTier, setSelectedTier] = useState<string>('all');

    const toggleModel = (model: string) => {
        const currentModels = config.models || [];
        let newModels: string[];

        if (currentModels.includes(model)) {
            // 至少保留一个模型
            if (currentModels.length <= 1) return;
            newModels = currentModels.filter(m => m !== model);
        } else {
            newModels = [...currentModels, model];
        }

        onChange({ ...config, models: newModels });
    };

    const { accounts } = useAccountStore();
    const uniqueIds = new Set<string>();

    // 先收集所有已知模型的 id 和 protectedKey，防止他们作为未知的 "动态抽出模型" 出现
    Object.entries(MODEL_CONFIG).forEach(([id, cfg]) => {
        uniqueIds.add(id.toLowerCase());
        if (cfg.protectedKey) {
            uniqueIds.add(cfg.protectedKey.toLowerCase());
        }
    });

    const addedDisplayLabels = new Set<string>();

    // 基础内置配置模型
    const baseModels: ModelOption[] = Object.entries(MODEL_CONFIG)
        .filter(([id, cfg]) => {
            // 隐藏思考变体（由主模型或关注项代理）
            if (id.includes('thinking')) return false;
            // 隐藏内部微层级与冗余别名（如 -tiered, -agent）
            if (id.includes('tiered') || id.includes('agent')) return false;

            const labelKey = (cfg.label || cfg.shortLabel).toLowerCase();
            // 在这一层，如果展示用的 labelKey 已经被加过了，就不要重复加到选项里了
            if (addedDisplayLabels.has(labelKey)) return false;
            addedDisplayLabels.add(labelKey);
            return true;
        })
        .map(([id, cfg]) => {
            const tierInfo = getModelTierInfo(id);
            return {
                id,
                label: id,
                title: cfg.label || cfg.shortLabel || id,
                desc: id,
                group: getModelFamily(id, cfg.group),
                tier: tierInfo.tier,
                tierLabel: tierInfo.label,
            };
        });

    // 提取所有账号的历史动态模型
    const dynamicModels: ModelOption[] = accounts.flatMap(a => a.quota?.models || [])
        .filter(m => {
            const id = m.name.toLowerCase();
            if (id.includes('thinking')) return false;
            // 过滤内部子层级和遥测指标 (-low, -medium, -high, -tiered, -extra-low)
            if (/-(low|medium|high|tiered|extra-low)$/i.test(id)) return false;
            // 查重：避免内置里已经包含的模型或同名 id 重复
            if (uniqueIds.has(id)) return false;
            uniqueIds.add(id);
            return true;
        })
        .map(m => {
            const tierInfo = getModelTierInfo(m.name);
            return {
                id: m.name.toLowerCase(),
                label: m.name.toLowerCase(),
                title: m.display_name || m.name.toLowerCase(),
                desc: m.name.toLowerCase(),
                group: getModelFamily(m.name),
                tier: tierInfo.tier,
                tierLabel: tierInfo.label,
            };
        });

    const modelOptions: ModelOption[] = [...baseModels, ...dynamicModels];

    // [FIX] Ensure previously pinned but unknown/hidden models are still rendered so users can un-pin them
    const currentChecked = config.models || [];
    currentChecked.forEach(modelId => {
        if (!modelOptions.some(m => m.id === modelId)) {
            const quotaModel = accounts.flatMap(a => a.quota?.models || []).find(m => m.name.toLowerCase() === modelId.toLowerCase());
            const cfg = MODEL_CONFIG[modelId.toLowerCase()];
            const tierInfo = getModelTierInfo(modelId);

            modelOptions.push({
                id: modelId,
                label: modelId,
                title: cfg?.label || quotaModel?.display_name || cfg?.shortLabel || modelId,
                desc: modelId,
                group: getModelFamily(modelId, cfg?.group),
                tier: tierInfo.tier,
                tierLabel: tierInfo.label,
            });
        }
    });

    // 过滤与分组逻辑 (Filter & Grouping)
    const filteredOptions = useMemo(() => {
        return modelOptions.filter(m => {
            if (selectedFamily !== 'all' && m.group !== selectedFamily) return false;
            if (selectedTier !== 'all' && m.tier !== selectedTier) return false;
            return true;
        });
    }, [modelOptions, selectedFamily, selectedTier]);

    const availableFamilies = useMemo(() => {
        const families = new Set<string>();
        modelOptions.forEach(m => families.add(m.group));
        return FAMILY_ORDER.filter(f => families.has(f));
    }, [modelOptions]);

    const groupedOptions = useMemo(() => {
        const groups: Record<string, ModelOption[]> = {};
        for (const family of availableFamilies) {
            const matches = filteredOptions.filter(m => m.group === family);
            if (matches.length > 0) {
                groups[family] = matches;
            }
        }
        // Check for any other group
        filteredOptions.forEach(m => {
            if (!groups[m.group]) {
                groups[m.group] = [m];
            }
        });
        return groups;
    }, [filteredOptions, availableFamilies]);

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    {/* 图标部分 - 使用蓝紫色调 */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                        <Pin size={20} />
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 dark:text-gray-100">
                            {t('settings.pinned_quota_models.title')}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('settings.pinned_quota_models.desc')}
                        </p>
                    </div>
                </div>

                {/* 选中的总数徽章 */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                        {(config.models || []).length} {t('common.selected', 'Pinned')}
                    </span>
                </div>
            </div>

            {/* 智能分类与分层过滤器 (Category & Tier Tabs) */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-base-200 flex flex-wrap items-center justify-between gap-3">
                {/* 家族代际筛选 (Family Generations) */}
                <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-base-200/80 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setSelectedFamily('all')}
                        className={cn(
                            "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                            selectedFamily === 'all'
                                ? "bg-white dark:bg-base-100 text-indigo-600 dark:text-indigo-400 shadow-xs"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                    >
                        {t('common.all', 'All Families')}
                    </button>
                    {availableFamilies.map((family) => (
                        <button
                            key={family}
                            type="button"
                            onClick={() => setSelectedFamily(family)}
                            className={cn(
                                "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                                selectedFamily === family
                                    ? "bg-white dark:bg-base-100 text-indigo-600 dark:text-indigo-400 shadow-xs"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            {family}
                        </button>
                    ))}
                </div>

                {/* 规格等级筛选 (Pro / Flash / Image Tier Filter) */}
                <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-base-200/80 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setSelectedTier('all')}
                        className={cn(
                            "px-2 py-1 text-xs font-bold rounded-lg transition-all",
                            selectedTier === 'all'
                                ? "bg-white dark:bg-base-100 text-indigo-600 dark:text-indigo-400 shadow-xs"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                    >
                        {t('common.all_tiers', 'All Tiers')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedTier('pro')}
                        className={cn(
                            "px-2 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                            selectedTier === 'pro'
                                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-xs"
                                : "text-gray-500 hover:text-blue-600"
                        )}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Pro
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedTier('flash')}
                        className={cn(
                            "px-2 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                            selectedTier === 'flash'
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs"
                                : "text-gray-500 hover:text-emerald-600"
                        )}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Flash
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedTier('image')}
                        className={cn(
                            "px-2 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                            selectedTier === 'image'
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 shadow-xs"
                                : "text-gray-500 hover:text-purple-600"
                        )}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Image
                    </button>
                </div>
            </div>

            {/* 分组展示模型 (Grouped Model Sections) */}
            <div className="mt-5 space-y-6">
                {Object.keys(groupedOptions).length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-base-200/40 rounded-xl border border-dashed border-gray-200 dark:border-base-300 text-gray-400 text-xs">
                        {t('common.no_matching_models', 'No models match the selected filter.')}
                    </div>
                ) : (
                    Object.entries(groupedOptions).map(([groupName, models]) => {
                        const pinnedInGroup = models.filter(m => config.models?.includes(m.id)).length;
                        return (
                            <div key={groupName} className="space-y-2.5">
                                {/* 分组标题与状态栏 */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        {groupName.includes('Gemini') ? (
                                            <Sparkles size={14} className="text-cyan-500" />
                                        ) : groupName.includes('Claude') ? (
                                            <Cpu size={14} className="text-amber-500" />
                                        ) : (
                                            <Layers size={14} className="text-indigo-500" />
                                        )}
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                            {groupName}
                                        </span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-base-300 text-gray-500">
                                            {models.length}
                                        </span>
                                    </div>

                                    {pinnedInGroup > 0 && (
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/40">
                                            {pinnedInGroup} {t('common.pinned', 'Pinned')}
                                        </span>
                                    )}
                                </div>

                                {/* 该分组内的模型卡片网格 */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {models.map((model) => {
                                        const isSelected = config.models?.includes(model.id);
                                        return (
                                            <div
                                                key={model.id}
                                                onClick={() => toggleModel(model.id)}
                                                className={cn(
                                                    "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all duration-200 select-none",
                                                    isSelected
                                                        ? "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-400/30 shadow-xs"
                                                        : "bg-gray-50/50 dark:bg-base-200/50 border-gray-100 dark:border-base-300/50 text-gray-700 dark:text-gray-300 hover:border-gray-200 dark:hover:border-base-300"
                                                )}
                                            >
                                                <div className="flex flex-col min-w-0 pr-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold truncate">
                                                            {model.title}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[9px] font-extrabold px-1 rounded uppercase tracking-wider shrink-0",
                                                            model.tier === 'pro' && "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30",
                                                            model.tier === 'flash' && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
                                                            model.tier === 'image' && "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30",
                                                            model.tier === 'other' && "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                                        )}>
                                                            {model.tierLabel}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                                        {model.desc}
                                                    </span>
                                                </div>
                                                <div className={cn(
                                                    "w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ml-1",
                                                    isSelected ? "bg-indigo-500 text-white scale-100" : "bg-gray-200 dark:bg-base-300 text-transparent scale-75 opacity-0"
                                                )}>
                                                    <Check size={10} strokeWidth={4} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PinnedQuotaModels;
