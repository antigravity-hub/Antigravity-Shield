/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { save } from '@tauri-apps/plugin-dialog';
import { AlertTriangle, ArrowRight, Bot, Download, RefreshCw, Sparkles, Users, ShieldCheck, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AddAccountDialog from '../components/accounts/AddAccountDialog';
import { showToast } from '../components/common/ToastContainer';
import BestAccounts from '../components/dashboard/BestAccounts';
import { findImageQuotaModel, findQuotaModel } from '../config/modelConfig';
import CurrentAccount from '../components/dashboard/CurrentAccount';
import NetworkHealthPulse from '../components/dashboard/NetworkHealthPulse';
import { exportAccounts } from '../services/accountService';
import { useAccountStore } from '../stores/useAccountStore';
import { useConfigStore } from '../stores/useConfigStore';
import { Account } from '../types/account';
import { cn } from '../utils/cn';
import { isTauri } from '../utils/env';
import { request as invoke } from '../utils/request';
import { CONTAINER_MAX_WIDTH } from '../constants/layout';
import AntigravityRtlCard from '../components/settings/AntigravityRtlCard';
import { isRtlRegionTimezone } from '../utils/timezone';
import VerificationRequiredBanner from '../components/common/VerificationRequiredBanner';
import FleetVelocityGauge from '../components/dashboard/FleetVelocityGauge';
import { getDistinctCapacityUnits } from '../utils/familyGroup';

function Dashboard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        accounts,
        currentAccount,
        fetchAccounts,
        fetchCurrentAccount,
        switchAccount,
        addAccount,
        refreshQuota,
        loading
    } = useAccountStore();
    const { config, loadConfig, toggleAutoWarm } = useConfigStore();
    const isAutoWarmEnabled = config?.scheduled_warmup?.enabled ?? true;

    useEffect(() => {
        fetchAccounts();
        fetchCurrentAccount();
        loadConfig();
    }, []);

    // 计算统计data (Family groups counted as 1 distinct pooled capacity unit)
    const stats = useMemo(() => {
        const capacityUnits = getDistinctCapacityUnits(accounts, currentAccount?.id);
        const getGeminiProQuota = (a: Account) =>
            findQuotaModel(a.quota?.models, 'gemini-pro')?.percentage || 0;

        const geminiQuotas = capacityUnits
            .map(a => getGeminiProQuota(a))
            .filter(q => q > 0);

        const geminiImageQuotas = capacityUnits
            .map(a => findImageQuotaModel(a.quota?.models)?.percentage || 0)
            .filter(q => q > 0);

        const claudeQuotas = capacityUnits
            .map(a => findQuotaModel(a.quota?.models, 'claude')?.percentage || 0)
            .filter(q => q > 0);

        const lowQuotaCount = capacityUnits.filter(a => {
            if (a.quota?.is_forbidden) return false;
            const gemini = getGeminiProQuota(a);
            const claude = findQuotaModel(a.quota?.models, 'claude')?.percentage || 0;
            return gemini < 20 || claude < 20;
        }).length;

        return {
            total: accounts.length,
            avgGemini: geminiQuotas.length > 0
                ? Math.round(geminiQuotas.reduce((a, b) => a + b, 0) / geminiQuotas.length)
                : 0,
            avgGeminiImage: geminiImageQuotas.length > 0
                ? Math.round(geminiImageQuotas.reduce((a, b) => a + b, 0) / geminiImageQuotas.length)
                : 0,
            avgClaude: claudeQuotas.length > 0
                ? Math.round(claudeQuotas.reduce((a, b) => a + b, 0) / claudeQuotas.length)
                : 0,
            lowQuota: lowQuotaCount,
        };
    }, [accounts, currentAccount?.id]);

    const isSwitchingRef = useRef(false);

    const handleSwitch = async (accountId: string) => {
        if (loading || isSwitchingRef.current) return;

        isSwitchingRef.current = true;
        console.log('[Dashboard] handleSwitch called for', accountId);
        try {
            await switchAccount(accountId);
            showToast(t('dashboard.toast.switch_success'), 'success');
        } catch (error) {
            console.error('Switch accountfailed:', error);
            showToast(`${t('dashboard.toast.switch_error')}: ${error}`, 'error');
        } finally {
            setTimeout(() => {
                isSwitchingRef.current = false;
            }, 1000);
        }
    };

    const handleAddAccount = async (email: string, refreshToken: string) => {
        await addAccount(email, refreshToken);
        await fetchAccounts(); // 刷新列表
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefreshCurrent = async () => {
        if (!currentAccount) return;

        setIsRefreshing(true);
        try {
            await refreshQuota(currentAccount.id);
            // 刷新success后重新get最新data
            await fetchCurrentAccount();
            showToast(t('dashboard.toast.refresh_success'), 'success');
        } catch (error) {
            console.error('[Dashboard] Refresh failed:', error);
            showToast(`${t('dashboard.toast.refresh_error')}: ${error}`, 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const exportAccountsToJson = async (accountsToExport: Account[]) => {
        try {
            if (accountsToExport.length === 0) {
                showToast(t('dashboard.toast.export_no_accounts'), 'warning');
                return;
            }

            // Get export data from API (contains refresh_token)
            const accountIds = accountsToExport.map(acc => acc.id);
            const response = await exportAccounts(accountIds);

            if (!response.accounts || response.accounts.length === 0) {
                showToast(t('dashboard.toast.export_no_accounts'), 'warning');
                return;
            }

            const exportData = response.accounts;
            const content = JSON.stringify(exportData, null, 2);
            const fileName = `antigravity_accounts_${new Date().toISOString().split('T')[0]}.json`;

            if (isTauri()) {
                const path = await save({
                    filters: [{
                        name: 'JSON',
                        extensions: ['json']
                    }],
                    defaultPath: fileName
                });

                if (!path) return;

                await invoke('save_text_file', { path, content });
                showToast(t('dashboard.toast.export_success', { path }), 'success');
            } else {
                // Web 模式：使用浏览器下载
                const blob = new Blob([content], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast(t('dashboard.toast.export_success', { path: fileName }), 'success');
            }
        } catch (error: any) {
            console.error('Export failed:', error);
            showToast(`${t('dashboard.toast.export_error')}: ${error.toString()}`, 'error');
        }
    };

    const handleExport = () => {
        exportAccountsToJson(accounts);
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div
                className={`p-5 sm:p-7 space-y-6 ${CONTAINER_MAX_WIDTH}`}
                style={{ position: 'relative', zIndex: 1 }}
            >
                {/* 1. Command Header Bar: Greeting, Shield Status & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                {currentAccount
                                    ? t('dashboard.hello_user', {
                                        name: currentAccount.name || currentAccount.email.split('@')[0],
                                        defaultValue: `Hello, ${currentAccount.name || currentAccount.email.split('@')[0]} 👋`
                                    })
                                    : t('dashboard.hello', 'Hello 👋')
                                }
                            </h1>
                            <span
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
                                style={{
                                    backgroundColor: 'var(--color-badge-bg, rgba(147, 233, 190, 0.15))',
                                    color: 'var(--color-badge-text, #93e9be)',
                                    borderColor: 'var(--color-badge-border, rgba(147, 233, 190, 0.35))',
                                    boxShadow: '0 0 12px var(--color-accent-glow, rgba(147, 233, 190, 0.15))',
                                }}
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {t('dashboard.shield_active', 'Shield Active')}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium">
                            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-accent, #93e9be)' }} />
                            {t('dashboard.shield_subtitle', 'Antigravity Shield Gateway • Enterprise AI Rotation & Quota Guard')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                        <button
                            onClick={async () => {
                                try {
                                    await toggleAutoWarm();
                                    showToast(
                                        !isAutoWarmEnabled
                                            ? t('settings.warmup.enabled_toast', 'Auto-Warm enabled')
                                            : t('settings.warmup.disabled_toast', 'Auto-Warm disabled'),
                                        'info'
                                    );
                                } catch (err) {
                                    showToast(String(err), 'error');
                                }
                            }}
                            className={cn(
                                "px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-2 border cursor-pointer active:scale-95 shadow-sm",
                                isAutoWarmEnabled
                                    ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                    : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10"
                            )}
                            title={t('settings.warmup.title', 'Auto-Warm (100% Quota Recovery Warmup)')}
                        >
                            <Sparkles className={cn("w-3.5 h-3.5", isAutoWarmEnabled ? "text-amber-500 fill-amber-500/20" : "text-slate-400")} />
                            <span className="hidden sm:inline">{t('dashboard.auto_warm', 'Auto-Warm')}</span>
                            <span className={cn(
                                "w-2 h-2 rounded-full",
                                isAutoWarmEnabled ? "bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.8)]" : "bg-slate-400"
                            )} />
                        </button>
                        <AddAccountDialog onAdd={handleAddAccount} />
                        <button
                            className={`px-3.5 py-2 text-white text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm border cursor-pointer ${isRefreshing || !currentAccount ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                            style={{
                                backgroundColor: 'var(--color-primary-btn, #129a5f)',
                                borderColor: 'var(--color-accent-hover, rgba(147, 233, 190, 0.3))',
                                boxShadow: '0 2px 8px var(--color-accent-glow, rgba(147, 233, 190, 0.2))',
                            }}
                            onClick={handleRefreshCurrent}
                            disabled={isRefreshing || !currentAccount}
                            title={isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}</span>
                        </button>
                    </div>
                </div>

                {/* 2. Verification Required Banner (Alert state) */}
                <VerificationRequiredBanner accounts={accounts} />

                {/* 3. Hero Bento: Current Account & Best Candidates Twin Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                    <CurrentAccount
                        account={currentAccount}
                        onSwitch={() => navigate('/accounts')}
                    />
                    <BestAccounts
                        accounts={accounts}
                        currentAccountId={currentAccount?.id}
                        onSwitch={handleSwitch}
                    />
                </div>

                {/* 4. Fleet Velocity Radar & Predictive Runway */}
                <FleetVelocityGauge accounts={accounts} currentAccount={currentAccount} />

                {/* 5. Fleet Intelligence Matrix (4 Obsidian Metric Cards) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Total Accounts in Fleet */}
                    <div className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-[var(--color-badge-border)] transition-all duration-200 flex flex-col justify-between group">
                        <div className="flex items-center justify-between mb-3">
                            <div 
                                className="p-2.5 rounded-xl border"
                                style={{
                                    backgroundColor: 'var(--color-badge-bg)',
                                    borderColor: 'var(--color-badge-border)',
                                }}
                            >
                                <Users className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">{t('dashboard.pool', "POOL")}</span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.total}</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.total_accounts')}</div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden mt-4">
                            <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: 'var(--color-accent, #93e9be)' }} />
                        </div>
                    </div>

                    {/* Card 2: Average Gemini Pro Quota */}
                    <div className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-[var(--color-badge-border)] transition-all duration-200 flex flex-col justify-between group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 rounded-xl border" style={{ backgroundColor: 'var(--color-badge-bg)', borderColor: 'var(--color-badge-border)' }}>
                                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent, #93e9be)' }} />
                            </div>
                            <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                                style={stats.avgGemini >= 50 ? { backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-badge-text)' } : undefined}
                            >
                                {stats.avgGemini >= 50 ? t('dashboard.quota_sufficient') : t('dashboard.quota_low')}
                            </span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.avgGemini}%</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.avg_gemini')}</div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden mt-4">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${stats.avgGemini < 50 ? 'bg-amber-500' : ''}`}
                                style={{
                                    width: `${Math.min(100, Math.max(0, stats.avgGemini))}%`,
                                    backgroundColor: stats.avgGemini >= 50 ? 'var(--color-accent, #93e9be)' : undefined,
                                }}
                            />
                        </div>
                    </div>

                    {/* Card 3: Average Claude Quota */}
                    <div className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-sky-500/30 transition-all duration-200 flex flex-col justify-between group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                                <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${stats.avgClaude >= 50 ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                                {stats.avgClaude >= 50 ? t('dashboard.quota_sufficient') : t('dashboard.quota_low')}
                            </span>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.avgClaude}%</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.avg_claude')}</div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden mt-4">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${stats.avgClaude >= 50 ? 'bg-sky-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(100, Math.max(0, stats.avgClaude))}%` }}
                            />
                        </div>
                    </div>

                    {/* Card 4: Low Quota / Exhausted Attention */}
                    <div className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-amber-500/40 transition-all duration-200 flex flex-col justify-between group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            {stats.lowQuota > 0 ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse">
                                    {t('dashboard.attention', "ATTENTION")}
                                </span>
                            ) : (
                                <span 
                                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                                    style={{
                                        backgroundColor: 'var(--color-badge-bg)',
                                        color: 'var(--color-badge-text)',
                                    }}
                                >
                                    {t('dashboard.healthy', "HEALTHY")}
                                </span>
                            )}
                        </div>
                        <div>
                            <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.lowQuota}</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.low_quota_accounts')}</div>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-4 truncate">{t('dashboard.quota_desc')}</div>
                    </div>
                </div>

                {/* 6. Upstream Network Health & Latency Pulse */}
                <NetworkHealthPulse onOpenProxySettings={() => navigate('/settings')} />

                {/* 7. RTL Card & Regional Settings */}
                {isRtlRegionTimezone() && (
                    <AntigravityRtlCard compact={true} />
                )}

                {/* 8. Quick Navigation Bento Footer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <button
                        className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-[#93e9be]/40 transition-all duration-200 flex items-center justify-between group cursor-pointer text-left rtl:text-right"
                        onClick={() => navigate('/accounts')}
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-[#93e9be] group-hover:bg-[#93e9be]/15 transition-colors">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-slate-900 dark:text-white font-bold text-sm block">{t('dashboard.view_all_accounts')}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.manage_accounts_desc', 'Manage, rotate and inspect accounts')}</span>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-[#93e9be] group-hover:translate-x-1.5 rtl:rotate-180 rtl:group-hover:-translate-x-1.5 transition-all" />
                    </button>
                    <button
                        className="bg-white/80 dark:bg-[#0c100e]/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-white/10 hover:border-[#93e9be]/40 transition-all duration-200 flex items-center justify-between group cursor-pointer text-left rtl:text-right"
                        onClick={handleExport}
                    >
                        <div className="flex items-center gap-3.5">
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-[#93e9be] group-hover:bg-[#93e9be]/15 transition-colors">
                                <Download className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-slate-900 dark:text-white font-bold text-sm block">{t('dashboard.export_data')}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.export_accounts_desc', 'Export encrypted backup of active accounts')}</span>
                            </div>
                        </div>
                        <Download className="w-5 h-5 text-slate-400 group-hover:text-[#93e9be] group-hover:translate-y-0.5 transition-all" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
