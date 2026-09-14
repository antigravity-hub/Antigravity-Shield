import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Zap, 
    RefreshCw, 
    CheckCircle2, 
    ShieldCheck, 
    ArrowRight,
    Wifi,
    Radio,
    AlertCircle,
    Copy,
    Check,
    Globe,
    X
} from 'lucide-react';
import { request as invoke } from '../../../utils/request';

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

export interface AntigravityProxyStatus {
    is_applied: boolean;
    current_proxy?: string;
    ide_settings_path?: string;
    platform_settings_path?: string;
}

interface AntigravityProxyRouterProps {
    onProxyApplied?: (proxyUrl: string) => void;
}

export const AntigravityProxyRouter: React.FC<AntigravityProxyRouterProps> = ({ onProxyApplied }) => {
    const { t } = useTranslation();

    const [status, setStatus] = useState<AntigravityProxyStatus | null>(null);
    const [discoveredProxies, setDiscoveredProxies] = useState<DiscoveredProxy[]>([]);
    const [customProxyUrl, setCustomProxyUrl] = useState<string>('');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [isApplying, setIsApplying] = useState<boolean>(false);
    const [showWarpModal, setShowWarpModal] = useState<boolean>(false);
    const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // بارگذاری وضعیت فعلی در شروع
    const loadStatus = async () => {
        try {
            const res = await invoke<AntigravityProxyStatus>('get_antigravity_proxy_status');
            setStatus(res);
            if (res.current_proxy && !customProxyUrl) {
                setCustomProxyUrl(res.current_proxy);
            }
        } catch (e) {
            console.error('Failed to get antigravity proxy status:', e);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    // اسکن خودکار پورت‌های محلی
    const handleScanProxies = async () => {
        setIsScanning(true);
        try {
            const list = await invoke<DiscoveredProxy[]>('scan_local_proxies');
            setDiscoveredProxies(list);
            if (list.length > 0) {
                const best = list.find(p => p.is_working) || list[0];
                setCustomProxyUrl(best.url);
                showMessage(
                    t('proxy.no_tun.scan_success', `اسکن کامل شد: ${list.length} پورت شناسایی شد.`),
                    'success'
                );
            } else {
                showMessage(
                    t('proxy.no_tun.scan_empty', 'هیچ پروکسی محلی فعالی در پورت‌های متداول یافت نشد. لطفاً پورت را دستی وارد کنید.'),
                    'info'
                );
            }
        } catch (err) {
            showMessage(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setIsScanning(false);
        }
    };

    // تست پینگ پروکسی وارد شده
    const handleTestProxy = async (urlToTest: string) => {
        const target = urlToTest.trim();
        if (!target) return;
        setIsTesting(true);
        try {
            const res = await invoke<DiscoveredProxy>('test_proxy_connection', { url: target });
            if (res.is_working && res.gemini_supported) {
                showMessage(
                    t('proxy.no_tun.test_ok_gemini', `✅ اتصال و سازگاری با جمینای تأیید شد! تأخیر: ${res.latency_ms}ms`),
                    'success'
                );
            } else if (res.is_working && !res.gemini_supported) {
                showMessage(
                    t('proxy.no_tun.test_region_blocked', `⚠️ پروکسی وصل است اما ریجن توسط گوگل مسدود شده (400). برای رفع این مشکل از WARP روی کانفیگ خود استفاده کنید.`),
                    'info'
                );
            } else {
                showMessage(
                    t('proxy.no_tun.test_fail', `عدم برقراری ارتباط: ${res.error || 'Timeout'}`),
                    'error'
                );
            }
        } catch (err) {
            showMessage(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    // اعمال پروکسی به Antigravity (بدون نیاز به TUN)
    const handleApplyProxy = async (proxyUrl: string) => {
        if (!proxyUrl.trim()) {
            showMessage(t('proxy.no_tun.url_empty', 'لطفاً آدرس پروکسی را وارد کنید.'), 'error');
            return;
        }
        setIsApplying(true);
        try {
            const msg = await invoke<string>('apply_antigravity_proxy', { 
                url: proxyUrl.trim(),
                syncShieldUpstream: true
            });
            showMessage(msg, 'success');
            await loadStatus();
            if (onProxyApplied) {
                onProxyApplied(proxyUrl.trim());
            }
        } catch (err) {
            showMessage(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setIsApplying(false);
        }
    };

    // حذف پروکسی و بازگرداندن به حالت پیش‌فرض
    const handleRemoveProxy = async () => {
        setIsApplying(true);
        try {
            const msg = await invoke<string>('remove_antigravity_proxy', { 
                disableShieldUpstream: true 
            });
            showMessage(msg, 'info');
            await loadStatus();
        } catch (err) {
            showMessage(`${t('common.error')}: ${err}`, 'error');
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="group bg-gradient-to-br from-white to-blue-50/20 dark:from-base-100 dark:to-base-200 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/30 shadow-md relative overflow-hidden transition-all duration-300">
            {/* جلوه بک‌گراند نوری */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 dark:bg-blue-400/5 -mr-20 -mt-20 rounded-full blur-3xl pointer-events-none"></div>

            {/* اعلان پیام Toast موقت */}
            {toastMessage && (
                <div className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
                    toastMessage.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                        : toastMessage.type === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}>
                    {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toastMessage.text}
                </div>
            )}

            {/* هدر بخش */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Zap size={22} className="fill-current text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                                {t('proxy.no_tun.title', 'اتصال مستقیم Antigravity به پروکسی (بدون TUN)')}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                                No-TUN Mode
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                            {t('proxy.no_tun.desc', 'هدایت اختصاصی ترافیک Antigravity IDE، پلتفرم و CLI از پروکسی‌های V2Ray/Xray/Clash بدون درگیر شدن کل ویندوز.')}
                        </p>
                    </div>
                </div>

                {/* دکمه‌های عملیات هدر */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowWarpModal(true)}
                        className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all shadow-sm active:scale-95 border border-amber-200 dark:border-amber-800/40"
                    >
                        <Globe size={14} className="text-amber-600 dark:text-amber-400" />
                        <span>{t('proxy.no_tun.warp_btn', 'حل مشکل ریجن با WARP')}</span>
                    </button>

                    <button
                        onClick={handleScanProxies}
                        disabled={isScanning}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                        {isScanning 
                            ? t('proxy.no_tun.scanning', 'در حال اسکن پورت‌ها...') 
                            : t('proxy.no_tun.scan_btn', 'اسکن خودکار پورت‌های VPN')}
                    </button>
                </div>
            </div>

            {/* کارت وضعیت فعلی */}
            <div className={`p-4 rounded-xl border mb-5 flex items-center justify-between transition-colors ${
                status?.is_applied 
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/40' 
                    : 'bg-gray-50 dark:bg-base-200/50 border-gray-200/80 dark:border-base-300'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        status?.is_applied 
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                            : 'bg-gray-200 dark:bg-base-300 text-gray-500'
                    }`}>
                        {status?.is_applied ? <ShieldCheck size={18} /> : <Radio size={18} />}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            {status?.is_applied 
                                ? t('proxy.no_tun.status_active', 'پروکسی فعال روی Antigravity') 
                                : t('proxy.no_tun.status_inactive', 'پروکسی غیرفعال (اتصال مستقیم سیستمی)')}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                            {status?.current_proxy || t('proxy.no_tun.no_proxy_set', 'تنظیماتی اعمال نشده است.')}
                        </div>
                    </div>
                </div>

                {status?.is_applied && (
                    <button
                        onClick={handleRemoveProxy}
                        disabled={isApplying}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-all disabled:opacity-50"
                    >
                        {t('proxy.no_tun.clear_btn', 'حذف پروکسی')}
                    </button>
                )}
            </div>

            {/* لیست پروکسی‌های اسکن شده */}
            {discoveredProxies.length > 0 && (
                <div className="mb-5 space-y-2">
                    <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Wifi size={13} />
                        {t('proxy.no_tun.discovered_title', 'پروکسی‌های شناسایی‌شده در سیستم شما:')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {discoveredProxies.map((item, idx) => (
                            <div 
                                key={idx}
                                onClick={() => setCustomProxyUrl(item.url)}
                                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                    customProxyUrl === item.url 
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500 shadow-sm' 
                                        : 'bg-white dark:bg-base-200 border-gray-100 dark:border-base-300 hover:border-gray-300'
                                }`}
                            >
                                <div className="space-y-0.5">
                                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 flex-wrap">
                                        <span>{item.client_hint}</span>
                                        {item.is_working && item.gemini_supported && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                                Gemini OK
                                            </span>
                                        )}
                                        {item.is_working && !item.gemini_supported && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="خطای 400 ریجن گوگل - نیازمند WARP">
                                                Region Blocked
                                            </span>
                                        )}
                                        {!item.is_working && item.is_listening && (
                                            <span className="w-2 h-2 rounded-full bg-amber-400" title="Port Open"></span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                                        {item.url}
                                    </div>
                                </div>
                                <div className="text-right">
                                    {item.is_working && item.latency_ms ? (
                                        <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                            {item.latency_ms}ms
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-gray-400">
                                            {item.is_listening ? 'Open' : 'Down'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* فیلد ورودی پورت یا آدرس پروکسی */}
            <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    {t('proxy.no_tun.input_label', 'آدرس پروکسی مورد نظر (SOCKS5 یا HTTP):')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={customProxyUrl}
                            onChange={(e) => setCustomProxyUrl(e.target.value)}
                            placeholder="مثال: socks5://127.0.0.1:10808 یا http://127.0.0.1:10809"
                            className="w-full px-4 py-2.5 bg-white dark:bg-base-200 border border-gray-200 dark:border-base-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs font-mono transition-all shadow-inner text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTestProxy(customProxyUrl)}
                            disabled={isTesting || !customProxyUrl.trim()}
                            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-base-300 hover:bg-gray-50 dark:hover:bg-base-200 text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isTesting ? t('common.testing', 'در حال تست...') : t('common.test', 'تست تأخیر')}
                        </button>
                        <button
                            onClick={() => handleApplyProxy(customProxyUrl)}
                            disabled={isApplying || !customProxyUrl.trim()}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <ArrowRight size={14} />
                            {isApplying ? t('common.applying', 'در حال اعمال...') : t('proxy.no_tun.apply_btn', 'اعمال روی Antigravity')}
                        </button>
                    </div>
                </div>
            </div>

            {/* توضیحات راهنما */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-base-300/60 flex items-start gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <AlertCircle size={14} className="mt-0.5 text-blue-500 shrink-0" />
                <p className="leading-relaxed">
                    {t('proxy.no_tun.footer_hint', 'با کلیک روی «اعمال روی Antigravity»، فایل‌های تنظیمات Antigravity IDE و پلتفرم به صورت ایمن بروزرسانی شده و پروکسی خروجی شیلد نیز با همین آدرس ست می‌شود. برای بازگردانی به حالت اولیه، در هر زمان دکمه «حذف پروکسی» را بزنید.')}
                </p>
            </div>

            {/* مودال راهنمای جامع رفع خطای ریجن با WARP */}
            {showWarpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-base-100 rounded-3xl max-w-xl w-full border border-gray-100 dark:border-base-300 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* هدر مودال */}
                        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border-b border-amber-500/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                        حل خطای ریجن گوگل (User location is not supported)
                                    </h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        رفع محدودیت IP دیتاسنتری با اتصال تمیز Cloudflare WARP
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowWarpModal(false)}
                                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-base-200 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* محتوای مودال */}
                        <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                            {/* باکس توضیح علت باگ */}
                            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-[11px]">
                                <strong>💡 علت چیست؟</strong> گوگل آی‌پی‌های سرورهای دیتاسنتری (هتزنر، دیجیتال‌اوشن، اووی‌اچ و...) یا ایران را در سرویس‌های AI مسدود کرده و خطای <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono">400 User location is not supported</code> بازمی‌گرداند. دو راهکار کاملاً تست‌شده زیر مشکل را ۱۰۰٪ برطرف می‌کنند:
                            </div>

                            {/* روش اول: WARP لوکال رسمی کلاینت */}
                            <div className="p-4 rounded-2xl border border-gray-200 dark:border-base-300 space-y-2.5 bg-gray-50/50 dark:bg-base-200/40">
                                <div className="flex items-center justify-between">
                                    <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 text-xs">
                                        <span>روش ۱: نرم‌افزار رسمی Cloudflare WARP (ساده‌ترین)</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                        توصیه‌شده
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                                    نرم‌افزار Cloudflare WARP را نصب کنید و در تنظیمات آن حالت Proxy Mode را انتخاب کنید (روی پورت پیش‌فرض 40000 شنود می‌کند). سپس روی دکمه زیر کلیک کنید:
                                </p>
                                <div className="pt-1 flex gap-2">
                                    <button
                                        onClick={() => {
                                            setCustomProxyUrl('socks5://127.0.0.1:40000');
                                            setShowWarpModal(false);
                                            handleTestProxy('socks5://127.0.0.1:40000');
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                    >
                                        <Zap size={13} />
                                        <span>ست کردن پورت 40000 (WARP Local) و تست</span>
                                    </button>
                                </div>
                            </div>

                            {/* روش دوم: ادغام WARP در کلاینت V2Ray / Xray */}
                            <div className="p-4 rounded-2xl border border-gray-200 dark:border-base-300 space-y-2.5 bg-gray-50/50 dark:bg-base-200/40">
                                <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between text-xs">
                                    <span>روش ۲: فعال‌سازی WARP روی سرور / کلاینت V2Ray (Xray Outbound)</span>
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                                    اگر از سرور اختصاصی یا پنل‌های مرزبان/سنایی استفاده می‌کنید، کافیست ترافیک دامنه <code>googleapis.com</code> را از WARP خارج کنید. همچنین می‌توانید قطعه کانفیگ زیر را به بخش <code>routing</code> کلاینت خود اضافه کنید:
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
                        <div className="px-6 py-3.5 bg-gray-50 dark:bg-base-200 border-t border-gray-100 dark:border-base-300/60 flex items-center justify-end">
                            <button
                                onClick={() => setShowWarpModal(false)}
                                className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-base-300 hover:bg-gray-300 dark:hover:bg-base-400 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all active:scale-95"
                            >
                                متوجه شدم، بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AntigravityProxyRouter;
