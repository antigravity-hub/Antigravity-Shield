import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BrainCircuit,
    Plus,
    RotateCcw,
    Edit2,
    Trash2,
    Check,
    X,
    Copy,
    CheckCircle,
    Code,
    Sparkles,
    Terminal
} from 'lucide-react';
import { AppConfig, ProxyConfig } from '../../types/config';

interface CustomPreset {
    id: string;
    name: string;
    description: string;
    mappings: Record<string, string>;
}

interface ProxyRoutingTabProps {
    appConfig: AppConfig;
    models: any[];
    selectedPreset: string;
    presetOptions: any[];
    customPresets: CustomPreset[];
    onSelectPreset: (id: string) => void;
    onApplyPreset: () => void;
    onOpenPresetManager: () => void;
    onResetMapping: () => void;
    onUpdateCustomMapping: (key: string, value: string) => void;
    onRemoveCustomMapping: (key: string) => void;
    onUpdateProxyConfig: (updates: Partial<ProxyConfig>) => void;
    selectedProtocol: 'openai' | 'anthropic' | 'gemini';
    onSelectProtocol: (p: 'openai' | 'anthropic' | 'gemini') => void;
    selectedModelId: string;
    onSelectModelId: (id: string) => void;
    getPythonExample: (modelId: string) => string;
    copied: string | null;
    onCopy: (text: string, label: string) => void;
}

export const ProxyRoutingTab: React.FC<ProxyRoutingTabProps> = ({
    appConfig,
    models,
    selectedPreset,
    presetOptions,
    onSelectPreset,
    onApplyPreset,
    onOpenPresetManager,
    onResetMapping,
    onUpdateCustomMapping,
    onRemoveCustomMapping,
    selectedProtocol,
    onSelectProtocol,
    selectedModelId,
    onSelectModelId,
    getPythonExample,
    copied,
    onCopy,
}) => {
    const { t } = useTranslation();

    const [newMappingKey, setNewMappingKey] = useState('');
    const [newMappingValue, setNewMappingValue] = useState('gemini-3-flash');
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');

    const customMapping = appConfig?.proxy?.custom_mapping || {};

    // Standard built-in normalized aliases
    const builtInAliases = [
        { from: 'gemini-4-argon-high', to: 'gemini-4-argon', note: 'High capability Argon tier' },
        { from: 'gemini-4-argon-medium', to: 'gemini-4-argon', note: 'Medium latency Argon tier' },
        { from: 'gemini-4-argon-low', to: 'gemini-4-argon', note: 'Low latency Argon tier' },
        { from: 'gemini-3.8-flash', to: 'gemini-3-flash', note: 'Standard Cursor / Windsurf alias' },
        { from: 'gemini-3.8-flash-medium', to: 'gemini-3-flash', note: 'Medium latency tier' },
        { from: 'gemini-3.8-flash-high', to: 'gemini-3-flash', note: 'High capability alias' },
        { from: 'gemini-3.8-flash-low', to: 'gemini-3-flash', note: 'Low latency alias' },
        { from: 'gpt-4o-mini', to: 'gemini-2.5-flash', note: 'OpenAI mini fallback' },
        { from: 'gpt-4o', to: 'gemini-2.5-flash', note: 'OpenAI standard fallback' },
        { from: 'claude-sonnet-4-5', to: 'claude-sonnet-4-6', note: 'Claude Code CLI alias' },
        { from: 'claude-opus-4', to: 'claude-opus-4-6-thinking', note: 'Claude Opus thinking alias' },
    ];

    const handleAddMapping = () => {
        if (!newMappingKey.trim() || !newMappingValue.trim()) return;
        onUpdateCustomMapping(newMappingKey.trim(), newMappingValue.trim());
        setNewMappingKey('');
    };

    const handleStartEdit = (key: string, currentVal: string) => {
        setEditingKey(key);
        setEditingValue(currentVal);
    };

    const handleSaveEdit = (key: string) => {
        if (!editingValue.trim()) return;
        onUpdateCustomMapping(key, editingValue.trim());
        setEditingKey(null);
    };

    const handleCancelEdit = () => {
        setEditingKey(null);
        setEditingValue('');
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* Presets Toolbar Bento */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <BrainCircuit size={18} style={{ color: 'var(--color-accent)' }} />
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                Model Routing Presets &amp; Alias Normalizer
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Normalize incoming model names from Cursor and CLI clients to active upstream Google models.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onResetMapping}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#141916] transition-colors flex items-center gap-1.5 text-gray-700 dark:text-gray-300"
                        >
                            <RotateCcw size={13} />
                            <span>{t('proxy.router.reset_mapping', { defaultValue: 'Reset Defaults' })}</span>
                        </button>
                    </div>
                </div>

                {/* Presets Selector Row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-slate-800/80">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 pe-2">
                        Presets:
                    </span>
                    {presetOptions.map((opt) => {
                        const isSelected = selectedPreset === opt.id;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => {
                                    onSelectPreset(opt.id);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                                    isSelected
                                        ? 'text-white shadow-sm'
                                        : 'bg-gray-100 dark:bg-[#141916] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#1a201c]'
                                }`}
                                style={isSelected ? { backgroundColor: 'var(--color-primary-btn)' } : undefined}
                            >
                                {opt.name}
                            </button>
                        );
                    })}

                    <div className="ms-auto flex items-center gap-2">
                        <button
                            onClick={onApplyPreset}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-1"
                            style={{ backgroundColor: 'var(--color-primary-btn)' }}
                        >
                            <Check size={13} />
                            <span>Apply Preset</span>
                        </button>
                        <button
                            onClick={onOpenPresetManager}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-[#141916] text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            Save / Manage
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Model Aliases & Add Mapping Form */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
                            Configured Custom Model Aliases
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Intercept specific request model identifiers and dynamically reroute to upstream models.
                        </p>
                    </div>
                    <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                        style={{
                            backgroundColor: 'var(--color-badge-bg)',
                            color: 'var(--color-badge-text)',
                            borderColor: 'var(--color-badge-border)',
                        }}
                    >
                        {Object.keys(customMapping).length} Custom Aliases
                    </span>
                </div>

                {/* Inline Add Form */}
                <div className="p-3 bg-gray-50/70 dark:bg-[#141916] rounded-xl border border-gray-200/60 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        value={newMappingKey}
                        onChange={(e) => setNewMappingKey(e.target.value)}
                        placeholder="Request Model Name (e.g. my-custom-model)"
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                    />
                    <span className="text-gray-400 font-mono text-xs">&rarr;</span>
                    <input
                        type="text"
                        value={newMappingValue}
                        onChange={(e) => setNewMappingValue(e.target.value)}
                        placeholder="Target Upstream (e.g. gemini-3-flash)"
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs text-gray-900 dark:text-gray-100 focus:outline-none"
                    />
                    <button
                        onClick={handleAddMapping}
                        disabled={!newMappingKey.trim() || !newMappingValue.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity flex items-center gap-1 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary-btn)' }}
                    >
                        <Plus size={14} />
                        <span>Add Mapping</span>
                    </button>
                </div>

                {/* Custom Mapping Table */}
                {Object.keys(customMapping).length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-slate-800/80 rounded-xl">
                        No custom model aliases registered. Standard built-in mappings are active below.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200/70 dark:border-slate-800/80">
                        <table className="table w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-[#141916] text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th className="py-2.5 ps-4 font-semibold text-start">Incoming Alias</th>
                                    <th className="py-2.5 font-semibold text-start">Mapped Target</th>
                                    <th className="py-2.5 pe-4 font-semibold text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                                {Object.entries(customMapping).map(([key, val]) => {
                                    const isEditing = editingKey === key;
                                    return (
                                        <tr key={key} className="hover:bg-gray-50/50 dark:hover:bg-[#141916]/50">
                                            <td className="ps-4 py-2 font-mono font-medium text-gray-900 dark:text-gray-100">
                                                {key}
                                            </td>
                                            <td className="py-2">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editingValue}
                                                        onChange={(e) => setEditingValue(e.target.value)}
                                                        className="px-2 py-1 rounded border border-gray-300 dark:border-slate-800 bg-white dark:bg-[#0c100e] text-xs font-mono text-gray-900 dark:text-gray-100"
                                                    />
                                                ) : (
                                                    <span className="font-mono text-gray-700 dark:text-gray-300">
                                                        {val}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="pe-4 py-2 text-end">
                                                {isEditing ? (
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleSaveEdit(key)}
                                                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                            title="Save"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-[#141916]"
                                                            title="Cancel"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleStartEdit(key, val)}
                                                            className="p-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={() => onRemoveCustomMapping(key)}
                                                            className="p-1 rounded text-gray-400 hover:text-rose-500 dark:hover:text-rose-400"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Built-in Normalization References */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl p-5 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Terminal size={16} style={{ color: 'var(--color-accent)' }} />
                        Standard Built-in Normalization Table (Native Rust Engine)
                    </h4>
                    <span className="text-[10px] text-gray-400">Always active in background</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {builtInAliases.map((item) => (
                        <div
                            key={item.from}
                            className="bg-gray-50/70 dark:bg-[#141916] p-2.5 rounded-xl border border-gray-200/60 dark:border-slate-800/80"
                        >
                            <div className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {item.from}
                            </div>
                            <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 pt-0.5">
                                &rarr; {item.to}
                            </div>
                            <div className="text-[10px] text-gray-400 pt-1 truncate">{item.note}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Supported Models Catalog & Quick Integration Code Generator */}
            <div className="bg-white dark:bg-[#0c100e] rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Code size={16} style={{ color: 'var(--color-accent)' }} />
                        Supported Models Directory &amp; Code Generator
                    </h4>

                    {/* Protocol Selector */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#141916] p-1 rounded-xl">
                        {(['openai', 'anthropic', 'gemini'] as const).map((proto) => (
                            <button
                                key={proto}
                                onClick={() => onSelectProtocol(proto)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium uppercase transition-colors ${
                                    selectedProtocol === proto
                                        ? 'bg-white dark:bg-[#0c100e] text-gray-900 dark:text-gray-100 shadow-xs'
                                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                {proto}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3">
                    {/* Models List */}
                    <div className="col-span-1 max-h-[360px] overflow-y-auto divide-y divide-gray-100 dark:divide-base-300 border-e border-gray-100 dark:border-base-300">
                        {models.map((m) => {
                            const isSelected = selectedModelId === m.id;
                            return (
                                <div
                                    key={m.id}
                                    onClick={() => onSelectModelId(m.id)}
                                    className={`p-3 cursor-pointer transition-colors ${
                                        isSelected
                                            ? 'bg-gray-100/80 dark:bg-base-300 font-semibold'
                                            : 'hover:bg-gray-50 dark:hover:bg-base-300/40'
                                    }`}
                                >
                                    <div className="text-xs text-gray-900 dark:text-gray-100 font-mono">
                                        {m.id}
                                    </div>
                                    <div className="text-[10px] text-gray-400 truncate">{m.name}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Code Snippet Box */}
                    <div className="col-span-2 bg-gray-900 p-4 text-gray-200 flex flex-col justify-between font-mono relative group">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-800 text-[11px] text-gray-400">
                            <span>Integration Snippet ({selectedProtocol.toUpperCase()})</span>
                            <span className="text-emerald-400">{selectedModelId}</span>
                        </div>
                        <pre className="py-3 text-[11px] leading-relaxed overflow-x-auto text-gray-300">
                            {getPythonExample(selectedModelId)}
                        </pre>
                        <button
                            onClick={() => onCopy(getPythonExample(selectedModelId), 'integration-code')}
                            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-opacity"
                            title={t('common.copy')}
                        >
                            {copied === 'integration-code' ? <CheckCircle size={15} className="text-emerald-400" /> : <Copy size={15} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
