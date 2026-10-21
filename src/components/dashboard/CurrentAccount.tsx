import { CheckCircle, Mail, Diamond, Gem, Circle, Tag, Lock, Clock, Users, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Account } from '../../types/account';
import { formatTimeRemaining } from '../../utils/format';
import { findQuotaModel, getModelProtectionKey, getModelDisplayName, findImageQuotaModel } from '../../config/modelConfig';

interface CurrentAccountProps {
    account: Account | null;
    onSwitch?: () => void;
}

function CurrentAccount({ account, onSwitch }: CurrentAccountProps) {
    const { t } = useTranslation();

    if (!account) {
        return (
            <div className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-[var(--color-badge-border)] transition-all duration-300 h-full flex flex-col justify-between min-h-[380px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{
                                backgroundColor: 'var(--color-badge-bg)',
                                color: 'var(--color-badge-text)',
                                border: '1px solid var(--color-badge-border)',
                            }}
                        >
                            <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                {t('dashboard.current_account')}
                            </h2>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                Active Target Engine
                            </span>
                        </div>
                    </div>
                </div>
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                    {t('dashboard.no_active_account')}
                </div>
                {onSwitch && (
                    <button
                        className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        onClick={onSwitch}
                    >
                        <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>{t('dashboard.switch_account')}</span>
                    </button>
                )}
            </div>
        );
    }

    const geminiProModel = findQuotaModel(account.quota?.models, 'gemini-pro');
    const geminiFlashModel = findQuotaModel(account.quota?.models, 'gemini-flash');

    const geminiImageModel = findImageQuotaModel(account.quota?.models);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const imageProtectionKey = getModelProtectionKey(geminiImageModel?.name || '');
    const liveImageLimit = imageProtectionKey
        ? account.live_limited_models?.[imageProtectionKey]
        : undefined;
    const isImageLiveLimited = Boolean(liveImageLimit && liveImageLimit.until > nowSeconds);

    const claudeModel = findQuotaModel(account.quota?.models, 'claude');

    return (
        <div className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-[var(--color-badge-border)] transition-all duration-300 h-full flex flex-col justify-between min-h-[380px]">
            {/* Header */}
            <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{
                                backgroundColor: 'var(--color-badge-bg)',
                                color: 'var(--color-badge-text)',
                                border: '1px solid var(--color-badge-border)',
                            }}
                        >
                            <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                {t('dashboard.current_account')}
                            </h2>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                Active Target Engine
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Subscription tier */}
                        {account.quota?.subscription_tier && (() => {
                            const tier = account.quota.subscription_tier.toLowerCase();
                            if (tier.includes('ultra')) {
                                return (
                                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold shadow-xs" title="Google AI Ultra Tier">
                                        <Gem className="w-2.5 h-2.5 fill-current" />
                                        ULTRA
                                    </span>
                                );
                            } else if (tier.includes('paid')) {
                                return (
                                    <span 
                                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold shadow-xs"
                                        title="Google AI Pro (Paid Subscription)"
                                    >
                                        <Diamond className="w-2.5 h-2.5 fill-current" />
                                        PRO (PAID)
                                    </span>
                                );
                            } else if (tier.includes('trial')) {
                                return (
                                    <span 
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold shadow-xs"
                                        title="Google AI Pro (Long Promotional Trial)"
                                    >
                                        <Diamond className="w-2.5 h-2.5" />
                                        PRO
                                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-400 text-amber-950 text-[8px] font-black tracking-wider uppercase ml-1 shadow-2xs">
                                            <svg className="w-2 h-2 fill-current" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/></svg>
                                            trial
                                        </span>
                                    </span>
                                );
                            } else if (tier.includes('pro')) {
                                return (
                                    <span 
                                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-white text-[10px] font-bold shadow-xs"
                                        style={{
                                            background: 'linear-gradient(135deg, var(--color-primary-btn), var(--color-accent))',
                                        }}
                                    >
                                        <Diamond className="w-2.5 h-2.5 fill-current" />
                                        PRO
                                    </span>
                                );
                            } else {
                                return (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[10px] font-bold border border-slate-200 dark:border-white/10">
                                        <Circle className="w-2.5 h-2.5" />
                                        FREE
                                    </span>
                                );
                            }
                        })()}

                        {/* 自定义标签 */}
                        {account.custom_label && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold border border-orange-500/20">
                                <Tag className="w-2.5 h-2.5" />
                                {account.custom_label}
                            </span>
                        )}
                    </div>
                </div>

                {/* Account Identity row */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 mb-4">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={account.email}>
                            {account.email}
                        </span>
                    </div>
                    {onSwitch && (
                        <button
                            onClick={onSwitch}
                            title={t('dashboard.view_in_accounts', 'View in Accounts')}
                            className="p-1 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-[#93e9be] transition-colors cursor-pointer shrink-0"
                        >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Quota Progress Rows */}
                <div className="space-y-3.5">
                    {/* Gemini Pro 配额 */}
                    {geminiProModel && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    {(account.protected_models?.includes('gemini-3-pro-high') || account.protected_models?.includes('gemini-3.1-pro-high')) && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                    {getModelDisplayName(geminiProModel)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500" title={`${t('accounts.reset_time')}: ${new Date(geminiProModel.reset_time).toLocaleString()}`}>
                                        {geminiProModel.reset_time ? `R: ${formatTimeRemaining(geminiProModel.reset_time, t('common.ready', 'Ready'))}` : t('common.unknown')}
                                    </span>
                                    <span 
                                        className={`text-xs font-bold font-mono ${
                                            geminiProModel.percentage >= 50 ? 'text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)]' :
                                            geminiProModel.percentage >= 20 ? 'text-amber-500' : 'text-rose-500'
                                        }`}
                                    >
                                        {geminiProModel.percentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        geminiProModel.percentage < 50 ? (geminiProModel.percentage >= 20 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500') : ''
                                    }`}
                                    style={{
                                        width: `${geminiProModel.percentage}%`,
                                        background: geminiProModel.percentage >= 50 ? 'linear-gradient(90deg, var(--color-primary-btn), var(--color-accent))' : undefined,
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Gemini 3 Pro Image 配额 */}
                    {geminiImageModel && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    {isImageLiveLimited && <Clock className="w-2.5 h-2.5 text-amber-500" />}
                                    {(imageProtectionKey && account.protected_models?.includes(imageProtectionKey)) && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                    {getModelDisplayName(geminiImageModel)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500" title={`${t('accounts.reset_time')}: ${new Date(geminiImageModel.reset_time).toLocaleString()}`}>
                                        {geminiImageModel.reset_time ? `R: ${formatTimeRemaining(geminiImageModel.reset_time, t('common.ready', 'Ready'))}` : t('common.unknown')}
                                    </span>
                                    <span 
                                        className={`text-xs font-bold font-mono ${
                                            geminiImageModel.percentage >= 50 ? 'text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)]' :
                                            geminiImageModel.percentage >= 20 ? 'text-amber-500' : 'text-rose-500'
                                        }`}
                                    >
                                        {geminiImageModel.percentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        geminiImageModel.percentage < 50 ? (geminiImageModel.percentage >= 20 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500') : ''
                                    }`}
                                    style={{
                                        width: `${geminiImageModel.percentage}%`,
                                        background: geminiImageModel.percentage >= 50 ? 'linear-gradient(90deg, var(--color-primary-btn), var(--color-accent))' : undefined,
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Gemini Flash 配额 */}
                    {geminiFlashModel && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    {account.protected_models?.includes('gemini-3-flash') && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                    {getModelDisplayName(geminiFlashModel)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500" title={`${t('accounts.reset_time')}: ${new Date(geminiFlashModel.reset_time).toLocaleString()}`}>
                                        {geminiFlashModel.reset_time ? `R: ${formatTimeRemaining(geminiFlashModel.reset_time, t('common.ready', 'Ready'))}` : t('common.unknown')}
                                    </span>
                                    <span 
                                        className={`text-xs font-bold font-mono ${
                                            geminiFlashModel.percentage >= 50 ? 'text-[var(--color-accent-secondary)] dark:text-[var(--color-accent)]' :
                                            geminiFlashModel.percentage >= 20 ? 'text-amber-500' : 'text-rose-500'
                                        }`}
                                    >
                                        {geminiFlashModel.percentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                        geminiFlashModel.percentage < 50 ? (geminiFlashModel.percentage >= 20 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500') : ''
                                    }`}
                                    style={{
                                        width: `${geminiFlashModel.percentage}%`,
                                        background: geminiFlashModel.percentage >= 50 ? 'linear-gradient(90deg, var(--color-primary-btn), var(--color-accent))' : undefined,
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Claude 配额 */}
                    {claudeModel && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                    {account.protected_models?.includes('claude') && <Lock className="w-2.5 h-2.5 text-rose-500" />}
                                    {getModelDisplayName(claudeModel, t('common.claude_series', 'Claude Series'))}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500" title={`${t('accounts.reset_time')}: ${new Date(claudeModel.reset_time).toLocaleString()}`}>
                                        {claudeModel.reset_time ? `R: ${formatTimeRemaining(claudeModel.reset_time, t('common.ready', 'Ready'))}` : t('common.unknown')}
                                    </span>
                                    <span className={`text-xs font-bold font-mono ${claudeModel.percentage >= 50 ? 'text-cyan-600 dark:text-cyan-400' :
                                        claudeModel.percentage >= 20 ? 'text-amber-500' : 'text-rose-500'
                                        }`}>
                                        {claudeModel.percentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${claudeModel.percentage >= 50 ? 'bg-gradient-to-r from-cyan-400 to-cyan-500' :
                                        claudeModel.percentage >= 20 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                                            'bg-gradient-to-r from-rose-400 to-rose-500'
                                        }`}
                                    style={{ width: `${claudeModel.percentage}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Button Action */}
            {onSwitch && (
                <div className="pt-4 mt-auto">
                    <button
                        className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        onClick={onSwitch}
                    >
                        <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>{t('dashboard.switch_account')}</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default CurrentAccount;
