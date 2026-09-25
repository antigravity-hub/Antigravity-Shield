import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, BookOpen, ExternalLink, RefreshCw, Copy } from "lucide-react";
import { Account } from "../../types/account";
import { openVerificationGuide, openExternalUrl, extractAccountValidationUrl } from "../../utils/guideOpener";
import { copyToClipboard } from "../../utils/clipboard";
import { useAccountStore } from "../../stores/useAccountStore";
import { showToast } from "./ToastContainer";
import { cn } from "../../utils/cn";

interface VerificationRequiredBannerProps {
    accounts: Account[];
    className?: string;
}

export const VerificationRequiredBanner: React.FC<VerificationRequiredBannerProps> = ({
    accounts,
    className = "",
}) => {
    const { t } = useTranslation();
    const [recheckingIds, setRecheckingIds] = useState<Set<string>>(new Set());
    const { clearAccountValidation, refreshQuota } = useAccountStore();

    const handleRecheck = async (accountId: string) => {
        setRecheckingIds(prev => new Set(prev).add(accountId));
        try {
            await clearAccountValidation(accountId);
            await refreshQuota(accountId);
            showToast(t("accounts.toast.validation_cleared", "Account validation block cleared and refreshed"), "success");
        } catch (err) {
            showToast(String(err), "error");
        } finally {
            setRecheckingIds(prev => {
                const next = new Set(prev);
                next.delete(accountId);
                return next;
            });
        }
    };

    const handleCopyUrl = (url: string) => {
        copyToClipboard(url);
        showToast(t("accounts.validation_url_copied", "Verification link copied to clipboard"), "success");
    };

    const verificationRequiredAccounts = accounts.filter(
        (a) => a.validation_blocked === true
    );

    if (verificationRequiredAccounts.length === 0) {
        return null;
    }

    const anyHasDirectUrl = verificationRequiredAccounts.some(acc => Boolean(extractAccountValidationUrl(acc)));

    return (
        <div
            className={`bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/20 rounded-2xl p-4 sm:p-5 shadow-lg shadow-amber-500/5 backdrop-blur-xl relative overflow-hidden animate-fadeIn ${className}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {t(
                                    "dashboard.verification_required_title",
                                    "Accounts Requiring Google Verification (Verification Required)"
                                )}
                            </h2>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {t("dashboard.verification_required_count", {
                                    count: verificationRequiredAccounts.length,
                                    defaultValue: `${verificationRequiredAccounts.length} ${t("dashboard.account_unit", "accounts")}`,
                                })}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {anyHasDirectUrl
                                ? t(
                                    "dashboard.verification_direct_hint",
                                    "Google requires identity confirmation. Use 'Verify in Browser' for instant one-click authentication, then click Re-check."
                                )
                                : t(
                                    "dashboard.verification_required_desc",
                                    "Connection for these accounts is paused because Google requires identity verification. Follow the guide to resolve the issue."
                                )}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => openVerificationGuide()}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/40 shadow-sm transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
                >
                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>{t("dashboard.open_full_guide", "Comprehensive Solution Guide (PDF)")}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {verificationRequiredAccounts.map((acc) => {
                    const validationUrl = extractAccountValidationUrl(acc);
                    const hasValidationUrl = Boolean(validationUrl);

                    return (
                        <div
                            key={acc.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 shadow-sm"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {acc.email}
                                </div>
                                <div className={cn(
                                    "text-[11px] truncate mt-0.5",
                                    hasValidationUrl
                                        ? "text-blue-600 dark:text-blue-400 font-medium"
                                        : "text-amber-600 dark:text-amber-400"
                                )}>
                                    {hasValidationUrl
                                        ? t("accounts.browser_verification_available", "Browser verification link available. Click to verify in browser, then re-check.")
                                        : (acc.validation_blocked_reason || t("dashboard.verify_account_prompt", "Verify your account to continue."))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {hasValidationUrl ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => openExternalUrl(validationUrl!)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                                            title={t("accounts.verify_in_browser_tooltip", "Open Google verification session in browser")}
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span>{t("accounts.verify_in_browser_btn", "Verify in Browser")}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyUrl(validationUrl!)}
                                            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer"
                                            title={t("accounts.copy_validation_url", "Copy Verification Link")}
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => openExternalUrl("https://console.cloud.google.com/welcome")}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                                            title={t("dashboard.verify_in_google", "Direct Google Verification Page")}
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            <span className="hidden sm:inline">{t("dashboard.google_link", "Google")}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openVerificationGuide()}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-500/30 transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
                                        >
                                            <BookOpen className="w-3.5 h-3.5" />
                                            <span>{t("dashboard.view_guide_pdf", "View PDF Guide")}</span>
                                        </button>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleRecheck(acc.id)}
                                    disabled={recheckingIds.has(acc.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg border border-amber-500/40 transition-colors cursor-pointer disabled:opacity-50"
                                    title={t("accounts.recheck_tooltip", "Clear block status and re-check account quota")}
                                >
                                    <RefreshCw className={cn("w-3 h-3", recheckingIds.has(acc.id) && "animate-spin")} />
                                    <span>{t("accounts.recheck_btn", "Re-check")}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VerificationRequiredBanner;
