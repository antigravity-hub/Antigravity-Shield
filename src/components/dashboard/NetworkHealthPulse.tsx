import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Wifi,
    Globe,
    Zap,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Play,
    ShieldCheck,
    AlertCircle,
    Check,
    Copy,
    X
} from 'lucide-react';
import { request as invoke } from '../../utils/request';
import { showToast } from '../common/ToastContainer';

export interface DiscoveredProxy {
    url: string;
    protocol: string;
    port: number;
    client_hint: string;
    is_listening: boolean;
    is_working: boolean;
    gemini_supported: boolean;
    latency_ms?: number;
    error?: string;
}

export interface InstalledVpnInfo {
    id: string;
    name: string;
    process_name: string;
    is_running: boolean;
    executable_path?: string;
    default_port?: number;
}

export interface NetworkPulseResult {
    internet_ok: boolean;
    google_ok: boolean;
    gemini_api_ok: boolean;
    gemini_web_ok: boolean;
    is_region_blocked: boolean;
    region_error_message?: string;
    overall_status: 'healthy' | 'region_blocked' | 'filtered' | 'offline';
    latency_ms?: number;
    active_proxy_url?: string;
    discovered_proxies: DiscoveredProxy[];
    installed_vpns: InstalledVpnInfo[];
}

interface NetworkHealthPulseProps {
    onOpenProxySettings?: () => void;
}

export const NetworkHealthPulse: React.FC<NetworkHealthPulseProps> = ({ onOpenProxySettings }) => {
    const { t } = useTranslation();

    const [pulse, setPulse] = useState<NetworkPulseResult | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isApplyingProxy, setIsApplyingProxy] = useState<boolean>(false);
    const [launchingVpnId, setLaunchingVpnId] = useState<string | null>(null);
    const [showWarpModal, setShowWarpModal] = useState<boolean>(false);
    const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

    // اجرای پروب شبکه
    const runNetworkProbe = async (customProxy?: string) => {
        setLoading(true);
        try {
            const res = await invoke<NetworkPulseResult>('check_gemini_network_pulse', {
                customProxy: customProxy || null
            });
            setPulse(res);
        } catch (err) {
            console.error('Failed to probe network pulse:', err);
            showToast(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runNetworkProbe();
    }, []);

    // اجرای مستقیم فایل فیلترشکن
    const handleLaunchVpn = async (vpn: InstalledVpnInfo) => {
        if (!vpn.executable_path) return;
        setLaunchingVpnId(vpn.id);
        try {
            const msg = await invoke<string>('launch_vpn_client', { exePath: vpn.executable_path });
            showToast(msg, 'success');
            // تأخیر کوتاه و تست مجدد وضعیت
            setTimeout(() => {
                runNetworkProbe();
            }, 3000);
        } catch (err) {
            showToast(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setLaunchingVpnId(null);
        }
    };

    // اعمال پروکسی محلی به IDE (بدون TUN)
    const handleApplyLocalProxy = async (proxyUrl: string) => {
        setIsApplyingProxy(true);
        try {
            const msg = await invoke<string>('apply_antigravity_proxy', {
                url: proxyUrl,
                syncShieldUpstream: true
            });
            showToast(msg, 'success');
            await runNetworkProbe(proxyUrl);
        } catch (err) {
            showToast(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setIsApplyingProxy(false);
        }
    };

    // بهترین پروکسی محلی موجود
    const bestLocalProxy = pulse?.discovered_proxies.find(p => p.is_working && p.gemini_supported) 
        || pulse?.discovered_proxies.find(p => p.is_working)
        || pulse?.discovered_proxies[0];

    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 dark:from-base-100 dark:via-base-200/50 dark:to-blue-950/20 shadow-sm transition-all duration-300 mb-6">
            {/* جلوه نوری گرادیانت در پس‌زمینه */}
            <div className={`absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none -mr-28 -mt-28 transition-all duration-700 ${
                pulse?.overall_status === 'healthy' 
                    ? 'bg-emerald-400/10 dark:bg-emerald-400/5' 
                    : pulse?.overall_status === 'region_blocked'
                    ? 'bg-amber-400/15 dark:bg-amber-400/10'
                    : 'bg-rose-400/10 dark:bg-rose-400/5'
            }`} />

            <div className="p-5 sm:p-6 relative z-10 space-y-5">
                {/* هدر بخش پایش */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors ${
                            pulse?.overall_status === 'healthy'
                                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/20'
                                : pulse?.overall_status === 'region_blocked'
                                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/20'
                                : 'bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-rose-500/20'
                        }`}>
                            <Zap size={20} className="fill-current" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                                    {t('dashboard.health_pulse.title', 'پایش سلامت اینترنت و هوش مصنوعی جمینای')}
                                </h3>
                                {/* بج وضعیت */}
                                {pulse && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                                        pulse.overall_status === 'healthy'
                                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                            : pulse.overall_status === 'region_blocked'
                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 animate-pulse'
                                            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            pulse.overall_status === 'healthy'
                                                ? 'bg-emerald-500'
                                                : pulse.overall_status === 'region_blocked'
                                                ? 'bg-amber-500'
                                                : 'bg-rose-500'
                                        }`} />
                                        {pulse.overall_status === 'healthy' && t('dashboard.health_pulse.status_healthy', 'آماده و پایدار')}
                                        {pulse.overall_status === 'region_blocked' && t('dashboard.health_pulse.status_region', 'تحریم ریجن گوگل')}
                                        {pulse.overall_status === 'filtered' && t('dashboard.health_pulse.status_filtered', 'مسدود / نیاز به فیلترشکن')}
                                        {pulse.overall_status === 'offline' && t('dashboard.health_pulse.status_offline', 'اینترنت قطع است')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {t('dashboard.health_pulse.subtitle', 'سنجش زندهٔ دسترسی به شبکه، گوگل و سرورهای هوش مصنوعی CloudCode')}
                            </p>
                        </div>
                    </div>

                    {/* دکمه رفرش و ابزارها */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                            onClick={() => setShowWarpModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all border border-amber-200 dark:border-amber-800/40 active:scale-95"
                            title={t('dashboard.health_pulse.warp_guide_tooltip', 'راهنمای حل مشکل ریجن با Cloudflare WARP')}
                        >
                            <Globe size={13} className="text-amber-600 dark:text-amber-400" />
                            <span>{t('dashboard.health_pulse.warp_btn', 'حل تحریم ریجن')}</span>
                        </button>

                        <button
                            onClick={() => runNetworkProbe()}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-base-200 hover:bg-slate-100 dark:hover:bg-base-300 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 active:scale-95 shadow-xs disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
                            <span>{loading ? t('common.loading', 'درحال بررسی...') : t('dashboard.health_pulse.retest', 'تست مجدد')}</span>
                        </button>
                    </div>
                </div>

                {/* پایپ‌لاین بصری سه مرحله‌ای (Visual Pipeline Strip) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-white/70 dark:bg-slate-950/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 shadow-inner">
                    {/* گره ۱: اینترنت عمومی */}
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            pulse?.internet_ok
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        }`}>
                            <Wifi size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {t('dashboard.health_pulse.node_net', 'اینترنت فیزیکی')}
                                </span>
                                {pulse && (
                                    pulse.internet_ok 
                                        ? <CheckCircle2 size={15} className="text-emerald-500" />
                                        : <XCircle size={15} className="text-rose-500" />
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {pulse?.internet_ok ? t('dashboard.health_pulse.net_ok', 'اتصال شبکه برقرار است') : t('dashboard.health_pulse.net_fail', 'قطع یا بدون سیگنال')}
                            </span>
                        </div>
                    </div>

                    {/* گره ۲: دسترسی به گوگل (عدم فیلترینگ) */}
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            pulse?.google_ok
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        }`}>
                            <Globe size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {t('dashboard.health_pulse.node_google', 'دسترسی به گوگل')}
                                </span>
                                {pulse && (
                                    pulse.google_ok 
                                        ? <CheckCircle2 size={15} className="text-emerald-500" />
                                        : <XCircle size={15} className="text-rose-500" />
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {pulse?.google_ok ? t('dashboard.health_pulse.google_ok', 'سرورهای گوگل باز می‌شوند') : t('dashboard.health_pulse.google_fail', 'مسدود / نیاز به پروکسی')}
                            </span>
                        </div>
                    </div>

                    {/* گره ۳: دسترسی به هوش مصنوعی جمینای */}
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            pulse?.overall_status === 'healthy'
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                : pulse?.overall_status === 'region_blocked'
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        }`}>
                            <Zap size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {t('dashboard.health_pulse.node_gemini', 'هوش مصنوعی جمینای')}
                                </span>
                                {pulse && (
                                    pulse.overall_status === 'healthy'
                                        ? <CheckCircle2 size={15} className="text-emerald-500" />
                                        : pulse.overall_status === 'region_blocked'
                                        ? <AlertTriangle size={15} className="text-amber-500" />
                                        : <XCircle size={15} className="text-rose-500" />
                                )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                <span>
                                    {pulse?.overall_status === 'healthy' && t('dashboard.health_pulse.gemini_ok', 'موتور و وب کاملاً فعال')}
                                    {pulse?.overall_status === 'region_blocked' && t('dashboard.health_pulse.gemini_region', 'ریجن و کشور تحریم است')}
                                    {pulse?.overall_status === 'filtered' && t('dashboard.health_pulse.gemini_fail', 'غیرقابل دسترسی')}
                                    {pulse?.overall_status === 'offline' && t('dashboard.health_pulse.gemini_offline', 'شبکه قطع است')}
                                </span>
                                {pulse?.latency_ms && (
                                    <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                                        {pulse.latency_ms}ms
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* پنل اقدام هوشمند بر اساس نوع عیب (Contextual Action Hub) */}
                {pulse && (
                    <div className="pt-1">
                        {/* سناریو ۱: تحریم ریجن گوگل */}
                        {pulse.overall_status === 'region_blocked' && (
                            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 space-y-3">
                                <div className="flex items-start gap-2.5">
                                    <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1 text-xs">
                                        <div className="font-bold">
                                            {t('dashboard.health_pulse.region_alert_title', 'اتصال شبکه برقرار است، اما موقعیت مکانی شما در جمینای تحریم است!')}
                                        </div>
                                        <p className="text-amber-700 dark:text-amber-300 leading-relaxed text-[11px]">
                                            {t('dashboard.health_pulse.region_alert_desc', 'فیلترشکن شما به سرورهای گوگل وصل است اما آی‌پی شما توسط گوگل به عنوان کشور پشتیبانی‌نشده (Gemini isn\'t currently supported in your country / User location is not supported) شناسایی شده است.')}
                                        </p>
                                    </div>
                                </div>

                                {/* دکمه‌های اقدام برای تحریم ریجن */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <button
                                        onClick={() => setShowWarpModal(true)}
                                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                    >
                                        <Globe size={14} />
                                        <span>{t('dashboard.health_pulse.fix_warp_btn', 'حل مشکل با Cloudflare WARP')}</span>
                                    </button>

                                    {bestLocalProxy && (
                                        <button
                                            onClick={() => handleApplyLocalProxy(bestLocalProxy.url)}
                                            disabled={isApplyingProxy}
                                            className="px-3.5 py-2 rounded-xl bg-white dark:bg-base-100 hover:bg-amber-100/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold text-xs transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                                        >
                                            <Zap size={14} className="text-amber-600" />
                                            <span>
                                                {t('dashboard.health_pulse.apply_local_proxy', 'تغییر خروجی IDE به پورت محلی')} ({bestLocalProxy.port})
                                            </span>
                                        </button>
                                    )}

                                    {onOpenProxySettings && (
                                        <button
                                            onClick={onOpenProxySettings}
                                            className="px-3 py-2 rounded-xl text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-semibold transition-all"
                                        >
                                            {t('dashboard.health_pulse.proxy_settings', 'تنظیمات پیشرفته پروکسی')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* سناریو ۲: مسدود بودن گوگل (نیاز به فیلترشکن) */}
                        {pulse.overall_status === 'filtered' && (
                            <div className="p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200 space-y-3">
                                <div className="flex items-start gap-2.5">
                                    <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1 text-xs">
                                        <div className="font-bold">
                                            {t('dashboard.health_pulse.filtered_alert_title', 'امکان برقراری ارتباط با گوگل و هوش مصنوعی وجود ندارد')}
                                        </div>
                                        <p className="text-rose-700 dark:text-rose-300 leading-relaxed text-[11px]">
                                            {t('dashboard.health_pulse.filtered_alert_desc', 'سرورهای گوگل در شبکه شما مسدود یا فیلتر هستند. برای استفاده از Antigravity IDE فیلترشکن خود را روشن کنید.')}
                                        </p>
                                    </div>
                                </div>

                                {/* دکمه‌های اجرای فیلترشکن‌های شناخته‌شده در سیستم */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {pulse.installed_vpns.map(vpn => (
                                        <button
                                            key={vpn.id}
                                            onClick={() => handleLaunchVpn(vpn)}
                                            disabled={launchingVpnId === vpn.id}
                                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                        >
                                            <Play size={13} className="fill-current" />
                                            <span>
                                                {vpn.is_running 
                                                    ? `${t('dashboard.health_pulse.vpn_running', 'باز کردن')} ${vpn.name}`
                                                    : `${t('dashboard.health_pulse.vpn_launch', 'اجرای')} ${vpn.name}`}
                                            </span>
                                        </button>
                                    ))}

                                    {bestLocalProxy && (
                                        <button
                                            onClick={() => handleApplyLocalProxy(bestLocalProxy.url)}
                                            disabled={isApplyingProxy}
                                            className="px-3.5 py-2 rounded-xl bg-white dark:bg-base-100 hover:bg-slate-100 text-gray-800 dark:text-gray-200 border border-slate-300 dark:border-slate-700 font-bold text-xs transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                                        >
                                            <Zap size={14} className="text-blue-600" />
                                            <span>{t('dashboard.health_pulse.apply_found_proxy', 'اتصال به پروکسی فعال')} ({bestLocalProxy.client_hint})</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* سناریو ۳: قطع کامل اینترنت فیزیکی */}
                        {pulse.overall_status === 'offline' && (
                            <div className="p-4 rounded-xl bg-gray-100/90 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 text-gray-800 dark:text-gray-200 flex items-center gap-3 text-xs">
                                <XCircle size={20} className="text-gray-500 shrink-0" />
                                <div>
                                    <div className="font-bold">{t('dashboard.health_pulse.offline_title', 'اینترنت فیزیکی سیستم قطع است')}</div>
                                    <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                                        {t('dashboard.health_pulse.offline_desc', 'لطفاً کابل شبکه یا اتصال Wi-Fi را بررسی نمایید.')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* سناریو ۴: همه چیز سبز و بدون مشکل */}
                        {pulse.overall_status === 'healthy' && (
                            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/30 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span className="font-medium text-[12px]">
                                        {t('dashboard.health_pulse.all_systems_go', 'تمام سیستم‌ها متصل و آمادهٔ کدنویسی با هوش مصنوعی هستند.')}
                                    </span>
                                </div>
                                {pulse.active_proxy_url && (
                                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-100/60 dark:bg-emerald-900/40 px-2 py-0.5 rounded-md self-start sm:self-auto">
                                        Proxy: {pulse.active_proxy_url}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* مودال راهنمای جامع WARP جهت حل مشکل ریجن */}
            {showWarpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl max-w-xl w-full overflow-hidden text-right">
                        {/* هدر مودال */}
                        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Globe size={18} />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                    {t('dashboard.health_pulse.warp_modal_title', 'حل تضمینی مشکل تحریم ریجن گوگل جمینای با WARP')}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowWarpModal(false)}
                                className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 flex items-center justify-center text-gray-500 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* بدنه مودال */}
                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 text-[11px]">
                                {t('dashboard.health_pulse.warp_modal_hint', 'گوگل اتصال آی‌پی‌های ایران و برخی دیتاسنترها به جمینای را تحریم کرده است. کلودفلر WARP با ارائه آی‌پی تمیز و اختصاصی مسأله ارور ۴۰۰ و «Gemini isn\'t currently supported in your country» را به‌طور کامل رفع می‌کند.')}
                            </div>

                            {/* روش ۱: پورت 40000 وارپ رسمی */}
                            <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2.5 bg-gray-50/50 dark:bg-slate-800/40">
                                <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between text-xs">
                                    <span>روش ۱: نرم‌افزار رسمی Cloudflare WARP (ساده‌ترین روش)</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                        توصیه‌شده
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                                    نرم‌افزار رسمی Cloudflare WARP را اجرا کنید و در تنظیمات آن حالت Proxy Mode را انتخاب کنید (به طور خودکار روی پورت 40000 باز می‌شود):
                                </p>
                                <div className="pt-1 flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowWarpModal(false);
                                            handleApplyLocalProxy('socks5://127.0.0.1:40000');
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                    >
                                        <Zap size={13} />
                                        <span>ست کردن پورت 40000 (WARP Local) و اتصال</span>
                                    </button>
                                </div>
                            </div>

                            {/* روش ۲: روتینگ وارپ در V2Ray */}
                            <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2.5 bg-gray-50/50 dark:bg-slate-800/40">
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                                    روش ۲: عبور دامنه گوگل از WARP در V2Ray / Xray
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                                    می‌توانید روتینگ زیر را به کلاینت V2Ray خود اضافه کنید تا ترافیک جمینای با WARP هدایت شود:
                                </p>
                                <div className="relative">
                                    <pre className="p-3 bg-gray-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto select-all dir-ltr text-left">
{`{
  "type": "field",
  "domain": [
    "domain:googleapis.com",
    "domain:gemini.google.com"
  ],
  "outboundTag": "warp"
}`}
                                    </pre>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`{\n  "type": "field",\n  "domain": [\n    "domain:googleapis.com",\n    "domain:gemini.google.com"\n  ],\n  "outboundTag": "warp"\n}`);
                                            setCopiedSnippet(true);
                                            setTimeout(() => setCopiedSnippet(false), 2000);
                                        }}
                                        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-mono flex items-center gap-1 transition-all border border-gray-700"
                                    >
                                        {copiedSnippet ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        {copiedSnippet ? 'کپی شد' : 'کپی'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* فوتر مودال */}
                        <div className="px-6 py-3.5 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-end">
                            <button
                                onClick={() => setShowWarpModal(false)}
                                className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all active:scale-95"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetworkHealthPulse;
