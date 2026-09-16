import { useState, useEffect } from 'react';
import { Type, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { request as invoke } from '../../utils/request';
import { showToast } from '../common/ToastContainer';
import { isTauri } from '../../utils/env';

export interface AntigravityRtlStatus {
    desktop_asar_path: string | null;
    desktop_is_patched: boolean;
    desktop_has_backup: boolean;
    ide_css_path: string | null;
    ide_is_patched: boolean;
    ide_has_backup: boolean;
}

interface AntigravityRtlCardProps {
    compact?: boolean;
}

export default function AntigravityRtlCard({ compact = false }: AntigravityRtlCardProps) {
    const [status, setStatus] = useState<AntigravityRtlStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStatus = async () => {
        if (!isTauri()) return;
        try {
            const data = await invoke<AntigravityRtlStatus>('get_antigravity_rtl_status');
            setStatus(data);
        } catch (e) {
            console.warn('Failed to fetch RTL status:', e);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const isPatched = status?.desktop_is_patched || status?.ide_is_patched;
    const canRestore = status?.desktop_has_backup || status?.ide_has_backup || isPatched;

    const handleApplyPatch = async () => {
        setIsLoading(true);
        try {
            const res = await invoke<string>('patch_antigravity_rtl');
            showToast(res, 'success');
            await fetchStatus();
        } catch (err) {
            showToast(String(err), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async () => {
        setIsLoading(true);
        try {
            const res = await invoke<string>('restore_antigravity_rtl');
            showToast(res, 'success');
            await fetchStatus();
        } catch (err) {
            showToast(String(err), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (compact) {
        return (
            <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-500">
                        <Type className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                            <span>فونت وزیرمتن و راست‌چین</span>
                            {isPatched ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> فعال
                                </span>
                            ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-semibold">
                                    غیرفعال
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            پچ ظاهر Antigravity 2.0 و Antigravity IDE
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {!isPatched ? (
                        <button
                            onClick={handleApplyPatch}
                            disabled={isLoading}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {isLoading ? 'در حال اعمال...' : 'فعال‌سازی RTL'}
                        </button>
                    ) : (
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || !canRestore}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="بازگردانی به حالت پیش‌فرض انگلیسی/چپ‌چین"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>بازگردانی (LTR)</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/40 transition-all duration-200">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        <Type className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                پشتیبانی بومی از راست‌چین (RTL) و فونت وزیرمتن
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                ویژه فارسی / عربی
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            تشخیص خودکار چت‌های فارسی و عربی بدون به هم ریختن کدهای برنامه‌نویسی در Antigravity 2.0 و IDE
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {isPatched && (
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || !canRestore}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>بازگردانی اولیه (LTR)</span>
                        </button>
                    )}
                    <button
                        onClick={handleApplyPatch}
                        disabled={isLoading}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            isPatched
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/20'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isLoading ? 'در حال پردازش...' : isPatched ? 'بروزرسانی مجدد پچ' : 'اعمال یک‌کلیکه پچ'}</span>
                    </button>
                </div>
            </div>

            {/* جزئیات وضعیت تارگت‌ها */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Antigravity 2.0 Desktop:</span>
                    {status?.desktop_asar_path ? (
                        <span className={`font-semibold flex items-center gap-1 ${status.desktop_is_patched ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {status.desktop_is_patched ? '✔ فعال (پچ شده)' : 'آماده اعمال'}
                        </span>
                    ) : (
                        <span className="text-slate-400">یافت نشد</span>
                    )}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">Antigravity IDE (Workbench):</span>
                    {status?.ide_css_path ? (
                        <span className={`font-semibold flex items-center gap-1 ${status.ide_is_patched ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {status.ide_is_patched ? '✔ فعال (پچ شده)' : 'آماده اعمال'}
                        </span>
                    ) : (
                        <span className="text-slate-400">یافت نشد</span>
                    )}
                </div>
            </div>
        </div>
    );
}
