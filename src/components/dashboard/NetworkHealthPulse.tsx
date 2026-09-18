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
    is_port_listening?: boolean;
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
    is_tun_active?: boolean;
    discovered_proxies: DiscoveredProxy[];
    installed_vpns: InstalledVpnInfo[];
    egress_country?: string;
    is_warp_active?: boolean;
}

interface NetworkHealthPulseProps {
    onOpenProxySettings?: () => void;
}

// Module-scoped cache to prevent unnecessary re-probing on tab switches
let cachedPulse: NetworkPulseResult | null = null;
let lastPulseTime = 0;
const PULSE_CACHE_TTL = 60_000; // 60 seconds

export const NetworkHealthPulse: React.FC<NetworkHealthPulseProps> = ({ onOpenProxySettings }) => {
    const { t } = useTranslation();

    const [pulse, setPulse] = useState<NetworkPulseResult | null>(() => {
        if (cachedPulse && Date.now() - lastPulseTime < PULSE_CACHE_TTL) {
            return cachedPulse;
        }
        return null;
    });
    const [loading, setLoading] = useState<boolean>(() => {
        return !(cachedPulse && Date.now() - lastPulseTime < PULSE_CACHE_TTL);
    });
    const [isApplyingProxy, setIsApplyingProxy] = useState<boolean>(false);
    const [launchingVpnId, setLaunchingVpnId] = useState<string | null>(null);
    const [showWarpModal, setShowWarpModal] = useState<boolean>(false);
    const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

    // اجرای پروب شبکه
    const runNetworkProbe = async (customProxy?: string, force = false) => {
        if (!force && !customProxy && cachedPulse && Date.now() - lastPulseTime < PULSE_CACHE_TTL) {
            setPulse(cachedPulse);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await invoke<NetworkPulseResult>('check_gemini_network_pulse', {
                customProxy: customProxy || null
            });
            cachedPulse = res;
            lastPulseTime = Date.now();
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
        if (vpn.is_running) {
            showToast(t('dashboard.health_pulse.vpn_already_running', { name: vpn.name, defaultValue: `${vpn.name} is already active and running.` }), 'info');
            return;
        }
        setLaunchingVpnId(vpn.id);
        try {
            const msg = await invoke<string>('launch_vpn_client', { exePath: vpn.executable_path });
            showToast(msg, 'success');
            // تأخیر کوتاه و تست مجدد وضعیت
            setTimeout(() => {
                runNetworkProbe(undefined, true);
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
            const countMatch = msg.match(/(\d+)/);
            const count = countMatch ? parseInt(countMatch[1], 10) : 1;
            showToast(
                t('dashboard.health_pulse.proxy_applied_toast', {
                    count,
                    defaultValue: `Proxy configuration applied to ${count} Antigravity instance(s).`
                }),
                'success'
            );
            await runNetworkProbe(proxyUrl, true);
        } catch (err) {
            showToast(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setIsApplyingProxy(false);
        }
    };

    // حذف پروکسی محلی و بازگشت به حالت مستقیم / TUN Mode
    const handleRemoveLocalProxy = async () => {
        setIsApplyingProxy(true);
        try {
            const msg = await invoke<string>('remove_antigravity_proxy', {
                disableShieldUpstream: true
            });
            const countMatch = msg.match(/(\d+)/);
            const count = countMatch ? parseInt(countMatch[1], 10) : 1;
            showToast(
                t('dashboard.health_pulse.proxy_removed_toast', {
                    count,
                    defaultValue: `Proxy settings removed from ${count} Antigravity instance(s).`
                }),
                'success'
            );
            await runNetworkProbe(undefined, true);
        } catch (err) {
            showToast(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setIsApplyingProxy(false);
        }
    };

    const warpVpn = pulse?.installed_vpns.find(v => v.id === 'warp');
    const isWarpInstalled = !!warpVpn;
    const isWarpRunning = !!warpVpn?.is_running;
    const isWarpPortListening = !!warpVpn?.is_port_listening || !!pulse?.discovered_proxies.some(p => p.port === 40000 && p.is_listening);

    // بهترین پروکسی محلی موجود
    const bestLocalProxy = pulse?.discovered_proxies.find(p => p.is_working && p.gemini_supported) 
        || pulse?.discovered_proxies.find(p => p.is_working)
        || pulse?.discovered_proxies.find(p => p.is_listening && p.port !== 40000);

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
                                    {t('dashboard.health_pulse.title', 'Internet & Gemini AI Health Pulse')}
                                </h3>
                                {/* بج وضعیت */}
                                {pulse && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
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
                                            {pulse.overall_status === 'healthy' && t('dashboard.health_pulse.status_healthy', 'Healthy & Ready')}
                                            {pulse.overall_status === 'region_blocked' && t('dashboard.health_pulse.status_region', 'Region Unsupported')}
                                            {pulse.overall_status === 'filtered' && t('dashboard.health_pulse.status_filtered', 'Blocked / VPN Required')}
                                            {pulse.overall_status === 'offline' && t('dashboard.health_pulse.status_offline', 'Internet Disconnected')}
                                        </span>

                                        {pulse.egress_country && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title={t('dashboard.health_pulse.egress_country', { country: pulse.egress_country, defaultValue: `Egress: ${pulse.egress_country}` })}>
                                                {pulse.egress_country}
                                            </span>
                                        )}
                                        {pulse.is_warp_active && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40">
                                                WARP
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {t('dashboard.health_pulse.subtitle', 'Real-time diagnostic probe for physical network, Google reachability, and Gemini AI endpoints')}
                            </p>
                        </div>
                    </div>

                    {/* دکمه رفرش و ابزارها */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                            onClick={() => setShowWarpModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all border border-amber-200 dark:border-amber-800/40 active:scale-95"
                            title={t('dashboard.health_pulse.warp_guide_tooltip', 'Guide to bypass Google region restrictions with Cloudflare WARP')}
                        >
                            <Globe size={13} className="text-amber-600 dark:text-amber-400" />
                            <span>{t('dashboard.health_pulse.warp_btn', 'Fix Region Sanctions')}</span>
                        </button>

                        <button
                            onClick={() => runNetworkProbe(undefined, true)}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-base-200 hover:bg-slate-100 dark:hover:bg-base-300 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 active:scale-95 shadow-xs disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
                            <span>{loading ? t('common.loading', 'Loading...') : t('dashboard.health_pulse.retest', 'Re-test')}</span>
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
                                    {t('dashboard.health_pulse.node_net', 'Physical Internet')}
                                </span>
                                {pulse && (
                                    pulse.internet_ok 
                                        ? <CheckCircle2 size={15} className="text-emerald-500" />
                                        : <XCircle size={15} className="text-rose-500" />
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {pulse?.internet_ok ? t('dashboard.health_pulse.net_ok', 'Network is connected') : t('dashboard.health_pulse.net_fail', 'No network connection')}
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
                                    {t('dashboard.health_pulse.node_google', 'Google Reachability')}
                                </span>
                                {pulse && (
                                    pulse.google_ok 
                                        ? <CheckCircle2 size={15} className="text-emerald-500" />
                                        : <XCircle size={15} className="text-rose-500" />
                                )}
                            </div>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {pulse?.google_ok ? t('dashboard.health_pulse.google_ok', 'Google servers are reachable') : t('dashboard.health_pulse.google_fail', 'Blocked / Proxy required')}
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
                                    {t('dashboard.health_pulse.node_gemini', 'Gemini AI Core')}
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
                                    {pulse?.overall_status === 'healthy' && t('dashboard.health_pulse.gemini_ok', 'CloudCode & Web fully active')}
                                    {pulse?.overall_status === 'region_blocked' && t('dashboard.health_pulse.gemini_region', 'Region is restricted')}
                                    {pulse?.overall_status === 'filtered' && t('dashboard.health_pulse.gemini_fail', 'Unreachable')}
                                    {pulse?.overall_status === 'offline' && t('dashboard.health_pulse.gemini_offline', 'Network is offline')}
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
                                            {t('dashboard.health_pulse.region_alert_title', 'Network is connected, but Gemini AI has restricted your region!')}
                                        </div>
                                        <p className="text-amber-700 dark:text-amber-300 leading-relaxed text-[11px]">
                                            {t('dashboard.health_pulse.region_alert_desc', "Your proxy connects to Google, but your IP has been flagged as an unsupported region (Gemini isn't currently supported in your country / User location is not supported).")}
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
                                        <span>{t('dashboard.health_pulse.fix_warp_btn', 'Fix Region with Cloudflare WARP')}</span>
                                    </button>

                                    {bestLocalProxy && (
                                        <button
                                            onClick={() => handleApplyLocalProxy(bestLocalProxy.url)}
                                            disabled={isApplyingProxy}
                                            className="px-3.5 py-2 rounded-xl bg-white dark:bg-base-100 hover:bg-amber-100/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold text-xs transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                                        >
                                            <Zap size={14} className="text-amber-600" />
                                            <span>
                                                {t('dashboard.health_pulse.apply_local_proxy', 'Route IDE traffic to local proxy')} ({bestLocalProxy.port})
                                            </span>
                                        </button>
                                    )}

                                    {onOpenProxySettings && (
                                        <button
                                            onClick={onOpenProxySettings}
                                            className="px-3 py-2 rounded-xl text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-semibold transition-all"
                                        >
                                            {t('dashboard.health_pulse.proxy_settings', 'Advanced Proxy Settings')}
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
                                            {t('dashboard.health_pulse.filtered_alert_title', 'Cannot reach Google and Gemini AI servers')}
                                        </div>
                                        <p className="text-rose-700 dark:text-rose-300 leading-relaxed text-[11px]">
                                            {t('dashboard.health_pulse.filtered_alert_desc', 'Google servers are blocked on your current network. Please turn on your VPN to use Antigravity IDE.')}
                                        </p>
                                    </div>
                                </div>

                                {/* دکمه‌های اقدام هوشمند برای رفع مسدودیت (فیلترشکن / پروکسی محلی) */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {pulse.installed_vpns.map(vpn => {
                                        const matchingProxy = pulse.discovered_proxies.find(p => p.port === vpn.default_port && p.is_listening);
                                        if (vpn.is_running && matchingProxy) {
                                            return (
                                                <button
                                                    key={vpn.id}
                                                    onClick={() => handleApplyLocalProxy(matchingProxy.url)}
                                                    disabled={isApplyingProxy}
                                                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                                    title={`Apply ${vpn.name} proxy (${matchingProxy.url}) to Antigravity IDE`}
                                                >
                                                    <Zap size={13} className="text-yellow-300 fill-current" />
                                                    <span>
                                                        {t('dashboard.health_pulse.apply_vpn_proxy', {
                                                            name: vpn.name,
                                                            port: matchingProxy.port,
                                                            defaultValue: `Apply ${vpn.name} Proxy (${matchingProxy.port})`
                                                        })}
                                                    </span>
                                                </button>
                                            );
                                        }

                                        if (!vpn.is_running) {
                                            return (
                                                <button
                                                    key={vpn.id}
                                                    onClick={() => handleLaunchVpn(vpn)}
                                                    disabled={launchingVpnId === vpn.id}
                                                    className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Play size={12} className="fill-current" />
                                                    <span>{t('dashboard.health_pulse.vpn_launch', `Launch ${vpn.name}`)}</span>
                                                </button>
                                            );
                                        }

                                        return null;
                                    })}

                                    {/* سایر پروکسی‌های فعال که متناظر با فیلترشکن‌های رندرشده بالا نیستند */}
                                    {bestLocalProxy && !pulse.installed_vpns.some(v => v.is_running && v.default_port === bestLocalProxy.port) && (
                                        <button
                                            onClick={() => handleApplyLocalProxy(bestLocalProxy.url)}
                                            disabled={isApplyingProxy}
                                            className="px-3.5 py-2 rounded-xl bg-white dark:bg-base-100 hover:bg-slate-100 text-gray-800 dark:text-gray-200 border border-slate-300 dark:border-slate-700 font-bold text-xs transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Zap size={14} className="text-blue-600" />
                                            <span>{t('dashboard.health_pulse.apply_found_proxy', 'Connect to active proxy')} ({bestLocalProxy.client_hint})</span>
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
                                    <div className="font-bold">{t('dashboard.health_pulse.offline_title', 'Local network is disconnected')}</div>
                                    <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                                        {t('dashboard.health_pulse.offline_desc', 'Please check your network cable or Wi-Fi connection.')}
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
                                        {t('dashboard.health_pulse.all_systems_go', 'All systems connected and ready for AI coding.')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                                    {pulse.active_proxy_url ? (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-100/60 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg border border-emerald-300/50 dark:border-emerald-800/50 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span>{t('dashboard.health_pulse.ide_proxy_label', 'IDE Proxy')}: {pulse.active_proxy_url}</span>
                                            </span>
                                            <button
                                                onClick={handleRemoveLocalProxy}
                                                disabled={isApplyingProxy}
                                                className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline font-semibold transition-all cursor-pointer px-1 py-0.5"
                                                title={t('dashboard.health_pulse.remove_proxy_tooltip', 'Remove IDE proxy settings so Antigravity connects directly (uses VPN TUN mode if active)')}
                                            >
                                                [{t('dashboard.health_pulse.clear_proxy_btn', 'Clear Proxy / Use Direct VPN')}]
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-teal-700 dark:text-teal-300 font-bold bg-teal-100/70 dark:bg-teal-900/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-teal-300/60 dark:border-teal-700/60" title={t('dashboard.health_pulse.direct_routing_tooltip', 'Antigravity connects directly without IDE proxy. If your VPN is active in TUN mode, traffic routes through it automatically.')}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                            {t('dashboard.health_pulse.direct_routing_label', 'IDE Routing: Direct (VPN TUN Mode)')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* WARP Guide Modal to resolve region blocks */}
            {showWarpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-2xl max-w-xl w-full overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Globe size={18} />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                    {t('dashboard.health_pulse.warp_modal_title', 'Guaranteed Solution for Gemini Region Sanctions with WARP')}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowWarpModal(false)}
                                className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 flex items-center justify-center text-gray-500 transition-all cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 text-[11px]">
                                {t('dashboard.health_pulse.warp_modal_hint', "Google restricts certain IPs from accessing Gemini. Cloudflare WARP provides clean IPs, eliminating HTTP 400 and 'Gemini isn't currently supported in your country' errors.")}
                            </div>

                            {/* Method 1: Cloudflare WARP Official Client */}
                            <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3 bg-gray-50/50 dark:bg-slate-800/40">
                                <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between text-xs">
                                    <span>{t('proxy.no_tun.warp_modal.method1_title', 'Method 1: Cloudflare WARP Official Client (Recommended)')}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isWarpRunning && isWarpPortListening
                                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                            : isWarpRunning
                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                    }`}>
                                        {isWarpRunning && isWarpPortListening 
                                            ? t('dashboard.health_pulse.warp_active_port', 'Running (Port 40000 Ready)')
                                            : isWarpRunning
                                            ? t('dashboard.health_pulse.warp_port_closed', 'Running (Proxy Mode Off)')
                                            : isWarpInstalled
                                            ? t('dashboard.health_pulse.warp_installed_stopped', 'Installed (Not Running)')
                                            : t('dashboard.health_pulse.warp_not_detected', 'Not Installed')}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                                    {t('proxy.no_tun.warp_modal.method1_desc', 'Install the official Cloudflare WARP client and set it to Proxy Mode in settings (listens on default port 40000).')}
                                </p>

                                {/* Diagnostics hint based on detection */}
                                {!isWarpInstalled && (
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] flex items-center justify-between gap-2">
                                        <span>{t('dashboard.health_pulse.warp_not_installed_hint', 'Cloudflare WARP client is not detected on your PC.')}</span>
                                        <button
                                            onClick={() => window.open('https://one.one.one.one/', '_blank')}
                                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] transition-all shrink-0 cursor-pointer"
                                        >
                                            {t('dashboard.health_pulse.download_warp_btn', 'Download WARP')}
                                        </button>
                                    </div>
                                )}

                                {isWarpInstalled && !isWarpRunning && warpVpn && (
                                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-[11px] flex items-center justify-between gap-2">
                                        <span>{t('dashboard.health_pulse.warp_stopped_hint', 'Cloudflare WARP is installed but not currently running.')}</span>
                                        <button
                                            onClick={() => handleLaunchVpn(warpVpn)}
                                            disabled={launchingVpnId === warpVpn.id}
                                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Play size={10} className="fill-current" />
                                            <span>{t('dashboard.health_pulse.launch_warp_btn', 'Launch WARP Client')}</span>
                                        </button>
                                    </div>
                                )}

                                {isWarpRunning && !isWarpPortListening && (
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px]">
                                        {t('dashboard.health_pulse.warp_enable_proxy_mode_hint', 'WARP is running, but port 40000 is closed. Open WARP app -> Settings (Gear) -> Preferences -> Connection -> select "Proxy Mode" (SOCKS5).')}
                                    </div>
                                )}

                                <div className="pt-1 flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (!isWarpPortListening) {
                                                showToast(t('dashboard.health_pulse.warp_port_not_listening_toast', 'Warning: Port 40000 is not listening. Ensure WARP is running in Proxy Mode.'), 'warning');
                                            }
                                            setShowWarpModal(false);
                                            handleApplyLocalProxy('socks5://127.0.0.1:40000');
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <Zap size={13} />
                                        <span>{t('dashboard.health_pulse.warp_connect_btn', 'Set Port 40000 (WARP Local) & Connect')}</span>
                                    </button>

                                    {bestLocalProxy && bestLocalProxy.port !== 40000 && (
                                        <button
                                            onClick={() => {
                                                setShowWarpModal(false);
                                                handleApplyLocalProxy(bestLocalProxy.url);
                                            }}
                                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <Zap size={12} className="text-emerald-500" />
                                            <span>{t('dashboard.health_pulse.use_active_proxy_btn', 'Or Use Active Proxy')} ({bestLocalProxy.client_hint} - {bestLocalProxy.port})</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Method 2: WARP routing in V2Ray / Xray */}
                            <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2.5 bg-gray-50/50 dark:bg-slate-800/40">
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                                    {t('proxy.no_tun.warp_modal.method2_title', 'Method 2: Enable WARP on Server / V2Ray Client (Xray Outbound)')}
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                                    {t('proxy.no_tun.warp_modal.method2_desc', 'If you use a VPS or Marzban/Sanaei panel, route googleapis.com traffic through WARP. You can also add the following rule to your client routing:')}
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
                                        {copiedSnippet ? t('proxy.no_tun.warp_modal.copied', 'Copied') : t('proxy.no_tun.warp_modal.copy', 'Copy')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3.5 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-end">
                            <button
                                onClick={() => setShowWarpModal(false)}
                                className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all active:scale-95"
                            >
                                {t('common.close', 'Close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NetworkHealthPulse;
