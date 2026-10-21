/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import {
    Ban, Lock, Clock, ExternalLink, Copy, FileText, Terminal,
    ChevronDown, ChevronRight, BookOpen, Sparkles, Send, QrCode,
    Globe, MapPin, CreditCard, KeyRound, RotateCcw, ShieldAlert
} from 'lucide-react';
import { QRCode } from 'antd';
import { Account } from '../../types/account';
import { formatDate } from '../../utils/format';
import { copyToClipboard } from '../../utils/clipboard';
import { openVerificationGuide, openExternalUrl, extractAccountValidationUrl } from '../../utils/guideOpener';
import { useTranslation, Trans } from 'react-i18next';
import ModalDialog from '../common/ModalDialog';
import { useState } from 'react';
import { showToast } from '../common/ToastContainer';

interface AccountErrorDialogProps {
    account: Account | null;
    onClose: () => void;
}

export default function AccountErrorDialog({ account, onClose }: AccountErrorDialogProps) {
    const directUrl = account ? extractAccountValidationUrl(account) : null;
    const [showRaw, setShowRaw] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [showPdfGuide, setShowPdfGuide] = useState(!directUrl);
    const [showQrCode, setShowQrCode] = useState(false);
    const { t } = useTranslation();
    if (!account) return null;

    const isForbidden = !!account.quota?.is_forbidden;
    const isDisabled = Boolean(account.disabled);
    const isProxyDisabled = account.proxy_disabled;
    const isValidationBlocked = account.validation_blocked;

    const rawReason = account.validation_blocked_reason || account.disabled_reason || account.quota?.forbidden_reason || account.proxy_disabled_reason || '';

    // Deep parsing of error message
    const extractErrorMessage = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return raw;
        try {
            const parsed = JSON.parse(trimmed);
            let innerParsed = null;
            if (typeof parsed?.error === 'string') {
                try {
                    innerParsed = JSON.parse(parsed.error);
                } catch (_) { }
            }
            // Extract message by priority
            const msg = innerParsed?.error?.message
                || parsed?.error?.message
                || (Array.isArray(parsed?.error?.details) ? parsed.error.details[0]?.message : null)
                || parsed?.message
                || raw;
            return String(msg);
        } catch (_) {
            // Skip handling
        }
        return raw;
    };

    const extractActionInfo = (_raw: string): { url: string | null, label: string | null } => {
        if (directUrl) {
            const isAppeal = directUrl.includes('forms.gle') || directUrl.toLowerCase().includes('appeal');
            return {
                url: directUrl,
                label: isAppeal ? t('accounts.submit_appeal_btn', 'Submit Appeal') : t('accounts.verify_in_browser_btn', 'Verify in Browser')
            };
        }
        return { url: null, label: null };
    };

    const message = extractErrorMessage(rawReason);
    const { url: rawExtractedUrl, label: actionLabel } = extractActionInfo(rawReason);
    const actionUrl = directUrl || rawExtractedUrl;

    const lowerReason = rawReason.toLowerCase();

    // 1. Region / Location Geofence (400 / FAILED_PRECONDITION / location not supported)
    const isRegionRestricted = lowerReason.includes('user location is not supported') ||
        lowerReason.includes('location is not supported') ||
        lowerReason.includes('geofenced') ||
        lowerReason.includes('region restricted') ||
        lowerReason.includes('country is not supported') ||
        (lowerReason.includes('failed_precondition') && (lowerReason.includes('location') || lowerReason.includes('region')));

    // 2. Subscription / License Required (403 #3501)
    const isSubscriptionRequired = !isRegionRestricted && (
        lowerReason.includes('subscription_required') ||
        lowerReason.includes('subscription required') ||
        lowerReason.includes('#3501') ||
        lowerReason.includes('3501') ||
        lowerReason.includes('valid license') ||
        lowerReason.includes('request a license') ||
        lowerReason.includes('google one ai premium')
    );

    // 3. OAuth Token Revoked / Expired (401 invalid_grant)
    const isTokenRevoked = !isRegionRestricted && !isSubscriptionRequired && (
        lowerReason.includes('invalid_grant') ||
        lowerReason.includes('token has been expired or revoked') ||
        lowerReason.includes('token revoked') ||
        lowerReason.includes('token expired') ||
        lowerReason.includes('invalid_token') ||
        lowerReason.includes('oauth_reauth_required')
    );

    // 4. Terms of Service Violation / Account Disabled
    const isViolation = !isRegionRestricted && !isSubscriptionRequired && !isTokenRevoked && (
        lowerReason.includes('terms of service') ||
        lowerReason.includes('tos_violation') ||
        lowerReason.includes('consumer_suspended') ||
        lowerReason.includes('account_disabled') ||
        lowerReason.includes('violation') ||
        (Boolean(directUrl) && (directUrl!.includes('forms.gle') || directUrl!.toLowerCase().includes('appeal')))
    );

    // 5. Human Identity Verification Challenge
    const isVerificationNeeded = !isRegionRestricted && !isSubscriptionRequired && !isTokenRevoked && !isViolation && (
        isValidationBlocked ||
        lowerReason.includes('verify your account') ||
        lowerReason.includes('further action') ||
        lowerReason.includes('validation required') ||
        lowerReason.includes('validation_required') ||
        Boolean(actionUrl)
    );

    // Clipboard copy handler
    const handleCopyUrl = (url: string) => {
        copyToClipboard(url);
        showToast(t('accounts.validation_url_copied', 'Validation link copied to clipboard'), 'success');
    };

    const handleCopyText = (text: string, msg: string) => {
        copyToClipboard(text);
        showToast(msg, 'success');
    };

    const renderMessageWithLinks = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 break-all inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {t('accounts.click_to_verify', 'Click to verify')}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                );
            }
            return part;
        });
    };

    return (
        <ModalDialog
            isOpen={true}
            title={t('accounts.error_details')}
            type="error"
            onConfirm={onClose}
            confirmText={t('common.close')}
        >
            <div className="space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 pr-1 py-1">
                {/* Account Info */}
                <div>
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">
                        {t('accounts.account')}
                    </label>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-base-200/50 px-4 py-2.5 rounded-xl border border-gray-100 dark:border-base-200 shadow-sm">
                        {account.email}
                    </div>
                </div>

                {/* Status Badges */}
                <div>
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">
                        {t('accounts.error_status')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {isRegionRestricted && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-bold ring-1 ring-amber-300/50 dark:ring-amber-800/40">
                                <Globe className="w-3.5 h-3.5" />
                                {t('accounts.status.region_restricted', 'Region Restricted (400)')}
                            </span>
                        )}
                        {isSubscriptionRequired && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-bold ring-1 ring-purple-300/50 dark:ring-purple-800/40">
                                <CreditCard className="w-3.5 h-3.5" />
                                {t('accounts.status.subscription_required', 'License Required (403 #3501)')}
                            </span>
                        )}
                        {isTokenRevoked && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 text-xs font-bold ring-1 ring-rose-300/50 dark:ring-rose-800/40">
                                <KeyRound className="w-3.5 h-3.5" />
                                {t('accounts.status.reauth_required', 'Session Expired (401)')}
                            </span>
                        )}
                        {isViolation && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold ring-1 ring-red-200/50 dark:ring-red-900/20">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                {t('accounts.status.violation_blocked', 'Disabled due to policy violation')}
                            </span>
                        )}
                        {!isViolation && (isValidationBlocked || isVerificationNeeded) && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold ring-1 ring-blue-200/50 dark:ring-blue-900/20">
                                <Clock className="w-3.5 h-3.5" />
                                {t('accounts.status.validation_required', 'Account validation required')}
                            </span>
                        )}
                        {isForbidden && !isRegionRestricted && !isSubscriptionRequired && !isTokenRevoked && !isViolation && !isVerificationNeeded && !isValidationBlocked && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold ring-1 ring-red-200/50 dark:ring-red-900/20">
                                <Lock className="w-3.5 h-3.5" />
                                {t('accounts.status.forbidden')}
                            </span>
                        )}
                        {isDisabled && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold ring-1 ring-rose-200/50 dark:ring-rose-900/20">
                                <Ban className="w-3.5 h-3.5" />
                                {t('accounts.status.disabled')}
                            </span>
                        )}
                        {isProxyDisabled && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-bold ring-1 ring-orange-200/50 dark:ring-orange-900/20">
                                <Ban className="w-3.5 h-3.5" />
                                {t('accounts.status.proxy_disabled')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Reason Display */}
                <div>
                    <div className="flex items-center justify-between mb-1.5 ml-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                            {t('common.reason', 'Reason')}
                        </label>
                        <button
                            onClick={() => setShowRaw(!showRaw)}
                            className="text-[10px] flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors font-medium"
                        >
                            <FileText className="w-2.5 h-2.5" />
                            {showRaw ? t('common.show_parsed', 'Show Parsed') : t('common.show_raw', 'Show Raw')}
                        </button>
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20 break-all leading-relaxed font-mono shadow-inner min-h-[70px] max-h-[35vh] overflow-y-auto scrollbar-thin scrollbar-thumb-red-200 dark:scrollbar-thumb-red-800">
                        {showRaw ? (
                            <pre className="whitespace-pre-wrap break-all">{rawReason}</pre>
                        ) : (
                            message ? renderMessageWithLinks(message) : t('common.unknown')
                        )}
                    </div>

                    {/* SMART DIAGNOSIS CARD 1: Region / Location Restriction */}
                    {isRegionRestricted && !showRaw && (
                        <div className="mt-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/90 via-amber-50/40 to-white dark:from-amber-950/40 dark:via-base-200/50 dark:to-base-100 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 shrink-0">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div className="space-y-2.5 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                            {t('accounts.error_dialog.region_title', 'Unsupported Geographic Region / IP Geo-fence')}
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-800">
                                            {t('accounts.error_dialog.region_badge', 'Region Geofence (400)')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                                        {t('accounts.error_dialog.region_desc', 'Google Gemini blocked this request because the exit IP node is located in an unsupported country or datacenter. Switch your VPN/Proxy outbound server to the United States, Germany, Japan, or Singapore, then click Re-check.')}
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                            {t('accounts.error_dialog.region_recommended', 'Recommended Regions:')}
                                        </span>
                                        {['🇺🇸 United States', '🇩🇪 Germany', '🇯🇵 Japan', '🇸🇬 Singapore'].map((reg) => (
                                            <span key={reg} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-base-300 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-base-200 shadow-2xs">
                                                <MapPin className="w-2.5 h-2.5 mr-1 text-amber-500" />
                                                {reg}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="pt-1 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleCopyText(
                                                'Switch proxy/VPN exit node to United States, Germany, Japan, or Singapore, then click Re-check in Shield.',
                                                t('accounts.error_dialog.proxy_advice_copied', 'Proxy advice copied to clipboard')
                                            )}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all shadow-md active:scale-[0.98] cursor-pointer"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t('accounts.error_dialog.copy_proxy_advice', 'Copy Proxy Recommendation')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SMART DIAGNOSIS CARD 2: Subscription / License Required (#3501) */}
                    {isSubscriptionRequired && !showRaw && (
                        <div className="mt-3 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-gradient-to-br from-purple-50/90 via-purple-50/40 to-white dark:from-purple-950/40 dark:via-base-200/50 dark:to-base-100 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/20 shrink-0">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div className="space-y-2.5 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="text-xs font-bold text-purple-900 dark:text-purple-200">
                                            {t('accounts.error_dialog.subscription_title', 'Google One AI Premium / License Required')}
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 ring-1 ring-purple-300 dark:ring-purple-800">
                                            {t('accounts.error_dialog.subscription_badge', 'License Required (403 #3501)')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-purple-800 dark:text-purple-300">
                                        {t('accounts.error_dialog.subscription_desc', 'This account does not have an active Google One AI Premium or Gemini Advanced license (Error #3501). Pro models require an active subscription, or you can switch this workspace to Flash models.')}
                                    </p>
                                    <div className="pt-1 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openExternalUrl('https://one.google.com/explore-plan/ai-premium')}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow-md active:scale-[0.98] cursor-pointer"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span>{t('accounts.error_dialog.subscription_btn', 'Explore Google AI Premium')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyText(
                                                'Switch workspace models in Antigravity to Gemini 2.5 Flash to bypass subscription requirement #3501.',
                                                t('common.copied', 'Copied to clipboard')
                                            )}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-white dark:bg-base-300 hover:bg-gray-100 dark:hover:bg-base-200 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t('common.copy_advice', 'Copy Model Switch Advice')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SMART DIAGNOSIS CARD 3: Session Revoked / Re-Authentication Required (401) */}
                    {isTokenRevoked && !showRaw && (
                        <div className="mt-3 p-4 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/90 via-rose-50/40 to-white dark:from-rose-950/40 dark:via-base-200/50 dark:to-base-100 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20 shrink-0">
                                    <KeyRound className="w-5 h-5" />
                                </div>
                                <div className="space-y-2.5 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                                            {t('accounts.error_dialog.reauth_title', 'OAuth Session Expired or Revoked')}
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 ring-1 ring-rose-300 dark:ring-rose-800">
                                            {t('accounts.error_dialog.reauth_badge', 'Session Expired (401 invalid_grant)')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                                        {t('accounts.error_dialog.reauth_desc', 'Google revoked this OAuth session (refresh token expired, account password changed, or signed out from another device). Re-authenticating this account will immediately restore access.')}
                                    </p>
                                    <div className="pt-1 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleCopyText('gcloud auth login --update-adc', t('accounts.error_dialog.reauth_advice_copied', 'Re-authentication advice copied to clipboard'))}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-md active:scale-[0.98] cursor-pointer"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>{t('accounts.error_dialog.copy_reauth_advice', 'Copy Re-auth Command')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SMART DIAGNOSIS CARD 4: Terms of Service Violation / Appeal */}
                    {isViolation && !showRaw && (
                        <div className="mt-3 p-4 rounded-xl border border-red-200 dark:border-red-800/60 bg-gradient-to-br from-red-50/90 via-red-50/40 to-white dark:from-red-950/40 dark:via-base-200/50 dark:to-base-100 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20 shrink-0">
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div className="space-y-2.5 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="text-xs font-bold text-red-900 dark:text-red-200">
                                            {t('accounts.appeal_title', 'Google Policy Violation: Submit Official Appeal')}
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200 ring-1 ring-red-300 dark:ring-red-800">
                                            {t('accounts.status.appeal_required', 'Appeal Required')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                                        {t('accounts.appeal_desc', 'This account was disabled by Google for automated requests/TOS violation. Click below to submit an official appeal to Google to reinstate this account.')}
                                    </p>
                                    <div className="pt-1 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openExternalUrl(actionUrl || 'https://forms.gle/hGzM9MEUv2azZsrb9')}
                                            className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-md active:scale-[0.98] cursor-pointer"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span>{t('accounts.go_to_appeal', 'Submit Appeal to Google')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyUrl(actionUrl || 'https://forms.gle/hGzM9MEUv2azZsrb9')}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-white dark:bg-base-300 hover:bg-gray-100 dark:hover:bg-base-200 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t('accounts.copy_appeal_url', 'Copy Appeal URL')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SMART DIAGNOSIS CARD 5: Human Identity Verification Challenge */}
                    {isVerificationNeeded && actionUrl && !showRaw && (
                        <div className="mt-3 p-4 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/90 via-blue-50/40 to-white dark:from-blue-950/40 dark:via-base-200/50 dark:to-base-100 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20 shrink-0">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div className="space-y-2.5 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                            {t('accounts.verification_method_1_title', 'Method 1 (Fastest & Recommended): Verify in Browser or Scan with Another Phone')}
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 ring-1 ring-blue-300 dark:ring-blue-700">
                                            {t('accounts.verification_guide.card_badge', 'Proven Solution')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
                                        {t('accounts.verification_method_1_desc', 'Open this direct verification link in your browser. If desktop verification loops or fails, scan or open the link on another mobile phone (preferably on cellular data) — Google trusts second devices and usually validates instantly without phone SMS!')}
                                    </p>
                                    <div className="pt-1 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openExternalUrl(actionUrl)}
                                            className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-md active:scale-[0.98] cursor-pointer"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span>{actionLabel || t('accounts.verify_in_browser_btn', 'Verify in Browser')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowQrCode(!showQrCode)}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-300 dark:border-blue-700 transition-all active:scale-[0.98] cursor-pointer"
                                            title={t('accounts.scan_with_phone_tooltip', 'Show QR code to scan with another mobile phone')}
                                        >
                                            <QrCode className="w-3.5 h-3.5" />
                                            <span>{showQrCode ? t('common.hide_qr', 'Hide QR') : t('accounts.scan_qr_btn', 'Scan with Phone')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyUrl(actionUrl)}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-white dark:bg-base-300 hover:bg-gray-100 dark:hover:bg-base-200 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>{t('accounts.copy_validation_url', 'Copy Validation URL')}</span>
                                        </button>
                                    </div>

                                    {/* QR Code view */}
                                    {showQrCode && (
                                        <div className="mt-3 p-4 bg-white dark:bg-base-100 rounded-xl border border-blue-200 dark:border-blue-800/60 flex flex-col items-center justify-center gap-2.5 shadow-sm">
                                            <div className="p-2.5 bg-white rounded-lg shadow-inner border border-gray-100 dark:border-gray-800">
                                                <QRCode value={actionUrl} size={150} bordered={false} />
                                            </div>
                                            <p className="text-[11px] text-gray-600 dark:text-gray-300 text-center max-w-xs font-medium">
                                                {t('accounts.scan_with_phone_hint', 'Scan this QR code with the camera on another mobile phone to verify. Using mobile data (4G/5G) avoids desktop IP blocks.')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Verification Loop & Further Action Required Fix Guide */}
                    {isVerificationNeeded && !showRaw && (
                        <div className="mt-4 border border-amber-200 dark:border-amber-800/50 rounded-xl overflow-hidden shadow-sm bg-amber-50/40 dark:bg-amber-950/20">
                            <button
                                onClick={() => setShowPdfGuide(!showPdfGuide)}
                                className="w-full flex items-center justify-between p-3 bg-amber-100/60 dark:bg-amber-900/30 hover:bg-amber-100/90 dark:hover:bg-amber-900/50 transition-colors"
                            >
                                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    <span>
                                        {actionUrl
                                            ? t('accounts.verification_method_2_title', 'Method 2 (Fallback): Google Cloud Shell SMS Verification Guide')
                                            : t('accounts.verification_guide.card_title')}
                                    </span>
                                    {actionUrl ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                            {t('common.fallback', 'Fallback')}
                                        </span>
                                    ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100">
                                            {t('accounts.verification_guide.card_badge')}
                                        </span>
                                    )}
                                </div>
                                {showPdfGuide ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-amber-600" />}
                            </button>

                            {showPdfGuide && (
                                <div className="p-4 text-xs space-y-3 bg-white dark:bg-base-200 text-gray-700 dark:text-gray-300">
                                    {actionUrl && (
                                        <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 font-medium bg-amber-100/50 dark:bg-amber-900/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                                            {t('accounts.fallback_guide_note', 'If browser verification does not resolve the issue or requests phone verification, refer to the solution guide below.')}
                                        </p>
                                    )}
                                    <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                                        {t('accounts.verification_guide.card_desc')}
                                    </p>

                                    {/* 7-Step List */}
                                    <div className="border-t border-gray-100 dark:border-base-300/50 pt-2.5">
                                        <h5 className="font-bold text-gray-800 dark:text-gray-200 mb-2 text-[11px] flex items-center gap-1.5">
                                            <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                            {t('accounts.verification_guide.steps_title')}
                                        </h5>
                                        <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-gray-600 dark:text-gray-300 marker:font-bold marker:text-amber-600">
                                            <li>{t('accounts.verification_guide.step1')}</li>
                                            <li>{t('accounts.verification_guide.step2')}</li>
                                            <li>{t('accounts.verification_guide.step3')}</li>
                                            <li>{t('accounts.verification_guide.step4')}</li>
                                            <li>{t('accounts.verification_guide.step5')}</li>
                                            <li>{t('accounts.verification_guide.step6')}</li>
                                            <li className="font-semibold text-emerald-700 dark:text-emerald-400">{t('accounts.verification_guide.step7')}</li>
                                        </ol>
                                    </div>

                                    {/* Action Buttons: Open PDF & Open GCP */}
                                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openVerificationGuide()}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all shadow-sm active:scale-[0.98]"
                                        >
                                            <BookOpen className="w-3.5 h-3.5" />
                                            {t('accounts.verification_guide.open_pdf')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openExternalUrl('https://console.cloud.google.com/welcome')}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold bg-gray-100 dark:bg-base-300 hover:bg-gray-200 dark:hover:bg-base-100 text-gray-800 dark:text-gray-200 rounded-lg transition-all active:scale-[0.98] border border-gray-200 dark:border-base-300"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            {t('accounts.verification_guide.open_gcp')}
                                        </button>
                                    </div>

                                    {/* Telegram Contact Note */}
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 pt-1 flex items-center justify-between border-t border-gray-100 dark:border-base-300/40">
                                        <span>{t('accounts.verification_guide.phone_note')}</span>
                                        <button
                                            type="button"
                                            onClick={() => openExternalUrl('https://t.me/DrGuidance')}
                                            className="text-blue-500 hover:underline flex items-center gap-1 font-medium ml-1 flex-shrink-0"
                                        >
                                            <Send className="w-2.5 h-2.5" />
                                            @DrGuidance
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Terminal Quick Fix Guide */}
                    {(isForbidden || isVerificationNeeded || isTokenRevoked) && !showRaw && (
                        <div className="mt-4 border border-blue-100 dark:border-blue-900/40 rounded-xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => setShowGuide(!showGuide)}
                                className="w-full flex items-center justify-between p-3 bg-blue-50/70 dark:bg-blue-900/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 transition-colors"
                            >
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs">
                                    <Terminal className="w-4 h-4" />
                                    <span>{t('accounts.fix_guide.title', 'Terminal Quick Fix (Resolves internal 403s)')}</span>
                                </div>
                                {showGuide ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-blue-500" />}
                            </button>
                            {showGuide && (
                                <div className="p-4 text-xs space-y-4 bg-white dark:bg-base-200 text-gray-700 dark:text-gray-300 max-h-[35vh] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-800">
                                    <div>
                                        <p className="mb-2 text-[11px] leading-relaxed">
                                            {t('accounts.fix_guide.step1_desc', 'Open Terminal and execute the following command to verify ownership with Google (fixes some 403 blocks):')}
                                        </p>
                                        <div className="bg-gray-900 dark:bg-[#1e1e1e] text-green-400 p-2.5 rounded-lg font-mono text-[11px] flex justify-between items-center ring-1 ring-inset ring-gray-800">
                                            <code>gcloud auth login --update-adc</code>
                                            <button
                                                onClick={() => handleCopyText('gcloud auth login --update-adc', t('common.copied', 'Command copied'))}
                                                className="text-gray-400 hover:text-white transition-colors p-1"
                                                title={t('common.copy', 'Copy')}
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <ul className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 list-disc pl-4 marker:text-gray-300 dark:marker:text-gray-600">
                                            <li><Trans i18nKey="accounts.fix_guide.step1_li1" components={{ 1: <code /> }}>Press Enter to execute, enter Y when prompted to continue.</Trans></li>
                                            <li>{t('accounts.fix_guide.step1_li2')}</li>
                                            <li><Trans i18nKey="accounts.fix_guide.step1_li3" components={{ 1: <code /> }}>Done once you see success message!</Trans></li>
                                        </ul>
                                    </div>

                                    <div className="border-t border-gray-100 dark:border-base-300/50 pt-3">
                                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                                            {t('accounts.fix_guide.step2_title', '🧹 If Ineffective (Clear Cache & Retry)')}
                                        </h4>
                                        <ol className="list-decimal pl-4 space-y-2 text-[11px] text-gray-600 dark:text-gray-400 marker:text-gray-400 font-medium">
                                            <li>
                                                {t('accounts.fix_guide.step2_li1_prefix', 'First execute revoke command to log out old credentials:')}
                                                <div className="bg-gray-100 dark:bg-base-300/50 mt-1 px-2 py-1.5 rounded text-red-600 dark:text-red-400 inline-block font-mono">
                                                    gcloud auth revoke {account.email || 'your-email@gmail.com'}
                                                </div>
                                            </li>
                                            <li>{t('accounts.fix_guide.step2_li2_prefix', 'Then login again:')}<code className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 rounded ml-1">gcloud auth login --update-adc</code></li>
                                        </ol>
                                    </div>

                                    <div className="border-t border-gray-100 dark:border-base-300/50 pt-3">
                                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center gap-1.5">
                                            {t('accounts.fix_guide.tips_title', '💡 Common Recommendations')}
                                        </h4>
                                        <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium marker:text-gray-300">
                                            <li><Trans i18nKey="accounts.fix_guide.tip1" components={{ 1: <code /> }}>If still 403, run <code /> in terminal to reset environment variables.</Trans></li>
                                            <li><Trans i18nKey="accounts.fix_guide.tip2" components={{ 1: <strong /> }}>In production, using a <strong /> JSON key is recommended for headless stability.</Trans></li>
                                            <li>
                                                <Trans
                                                    i18nKey="accounts.fix_guide.tip3"
                                                    components={{
                                                        1: <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 hover:underline" />
                                                    }}
                                                >
                                                    If it still fails, check the Generative Language API in <a href="https://console.cloud.google.com/">Google Cloud Console</a> to see if permissions are frozen. If so, your account is under risk control. Please let the account cool down for 72 hours before trying again.
                                                </Trans>
                                            </li>
                                            <li><Trans i18nKey="accounts.fix_guide.tip4" components={{ 1: <code /> }}>You can also test with <code />; re-authorizing in-app will usually resolve issues.</Trans></li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Time Display */}
                <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500 pl-1">
                    <Clock size={12} strokeWidth={2.5} />
                    <span>
                        {t('accounts.error_time')}: {account.disabled_at ? formatDate(account.disabled_at) : (account.quota?.last_updated ? formatDate(account.quota.last_updated) : t('common.unknown'))}
                    </span>
                </div>
            </div>
        </ModalDialog>
    );
}
