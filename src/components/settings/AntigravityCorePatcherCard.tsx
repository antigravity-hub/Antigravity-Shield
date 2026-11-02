/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Wrench, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { request as invoke } from '../../utils/request';
import { showToast } from '../common/ToastContainer';
import { isTauri } from '../../utils/env';
import { useConfigStore } from '../../stores/useConfigStore';
import { Zap } from 'lucide-react';

export interface PatcherExecutionResult {
    success: boolean;
    language_server_patched: boolean;
    main_js_patched: boolean;
    cache_cleared: boolean;
    message: string;
    details: string[];
}

interface AntigravityCorePatcherCardProps {
    compact?: boolean;
}

export default function AntigravityCorePatcherCard({ compact = false }: AntigravityCorePatcherCardProps) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [lastResult, setLastResult] = useState<PatcherExecutionResult | null>(null);
    const { config, saveConfig } = useConfigStore();

    const handleApplyPatch = async () => {
        if (!isTauri()) {
            showToast('Patcher is only supported in desktop environment', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const res = await invoke<PatcherExecutionResult>('apply_core_engine_patch');
            setLastResult(res);
            if (res.success) {
                showToast(res.message, 'success');
            } else {
                showToast(res.message, 'warning');
            }
        } catch (err) {
            showToast(String(err), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (compact) {
        return (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 transition-all">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-[var(--color-badge-bg)] text-[var(--color-accent)] border border-[var(--color-badge-border)] shrink-0">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {t('patcher.compact_title', 'Bypass Region Block')}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {lastResult ? (lastResult.success ? t('patcher.applied', 'Patched successfully') : t('patcher.completed', 'Completed')) : t('patcher.compact_desc', 'Language server & GCP ToS bypass')}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleApplyPatch}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5 bg-[var(--color-primary-btn)] hover:bg-[var(--color-primary-btn-hover)]"
                >
                    {isLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Wrench className="w-3.5 h-3.5" />
                    )}
                    <span>{isLoading ? t('patcher.patching', 'Patching...') : t('patcher.run', 'Run Patch')}</span>
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-[var(--color-accent)]/40 transition-all duration-200">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[var(--color-badge-bg)] text-[var(--color-accent)] border border-[var(--color-badge-border)]">
                        <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {t('patcher.title', 'Antigravity IDE Region Bypass')}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                {t('patcher.badge', 'Region Patcher')}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {t('patcher.desc', 'Patches Antigravity IDE language_server and workbench to unblock restricted countries and geo-blocked accounts.')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleApplyPatch}
                        disabled={isLoading}
                        className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 bg-[var(--color-primary-btn)] hover:bg-[var(--color-primary-btn-hover)]"
                    >
                        {isLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        <span>
                            {isLoading
                                ? t('patcher.running', 'Applying Patches...')
                                : t('patcher.one_click', '1-Click Region Bypass')}
                        </span>
                    </button>
                </div>
            </div>

            {/* Auto-Patch on Region Block Detection Toggle */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {t('patcher.auto_patch_title', 'Auto-Patch on Region Block Detection')}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t('patcher.auto_patch_desc', 'Automatically patch language server and workbench when region restriction is detected.')}
                        </div>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config?.auto_patch_on_region_error ?? false}
                        onChange={async (e) => {
                            if (config) {
                                await saveConfig({ ...config, auto_patch_on_region_error: e.target.checked }, true);
                            }
                        }}
                    />
                    <div className="w-9 h-5 bg-gray-200 dark:bg-base-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary-btn)] shadow-inner"></div>
                </label>
            </div>

            {lastResult && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-medium">
                        {lastResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className={lastResult.success ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400'}>
                            {lastResult.message}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                            <span className={lastResult.language_server_patched ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                                {lastResult.language_server_patched ? '✓' : '•'}
                            </span>
                            <span>{t('patcher.target_ls', 'Language Server')}: {lastResult.language_server_patched ? t('patcher.patched', 'Patched') : t('patcher.unchanged', 'Unchanged')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className={lastResult.main_js_patched ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                                {lastResult.main_js_patched ? '✓' : '•'}
                            </span>
                            <span>{t('patcher.target_js', 'Workbench main.js')}: {lastResult.main_js_patched ? t('patcher.patched', 'Patched') : t('patcher.unchanged', 'Unchanged')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className={lastResult.cache_cleared ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                                {lastResult.cache_cleared ? '✓' : '•'}
                            </span>
                            <span>{t('patcher.target_cache', 'IDE Cache')}: {lastResult.cache_cleared ? t('patcher.purged', 'Purged') : t('patcher.skipped', 'Skipped')}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
