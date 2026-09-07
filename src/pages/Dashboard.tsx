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
import { exportAccounts } from '../services/accountService';
import { useAccountStore } from '../stores/useAccountStore';
import { Account } from '../types/account';
import { isTauri } from '../utils/env';
import { request as invoke } from '../utils/request';

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

    useEffect(() => {
        fetchAccounts();
        fetchCurrentAccount();
    }, []);

    // 计算统计数据
    const stats = useMemo(() => {
        const getGeminiProQuota = (a: Account) =>
            findQuotaModel(a.quota?.models, 'gemini-pro')?.percentage || 0;

        const geminiQuotas = accounts
            .map(a => getGeminiProQuota(a))
            .filter(q => q > 0);

        const geminiImageQuotas = accounts
            .map(a => findImageQuotaModel(a.quota?.models)?.percentage || 0)
            .filter(q => q > 0);

        const claudeQuotas = accounts
            .map(a => findQuotaModel(a.quota?.models, 'claude')?.percentage || 0)
            .filter(q => q > 0);

        const lowQuotaCount = accounts.filter(a => {
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
    }, [accounts]);

    const isSwitchingRef = useRef(false);

    const handleSwitch = async (accountId: string) => {
        if (loading || isSwitchingRef.current) return;

        isSwitchingRef.current = true;
        console.log('[Dashboard] handleSwitch called for', accountId);
        try {
            await switchAccount(accountId);
            showToast(t('dashboard.toast.switch_success'), 'success');
        } catch (error) {
            console.error('切换账号失败:', error);
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
            // 刷新成功后重新获取最新数据
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
                className="p-6 space-y-6 max-w-7xl mx-auto"
                style={{ position: 'relative', zIndex: 1 }}
            >
                {/* 问候语、Shield 状态和操作按钮 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                {currentAccount
                                    ? t('dashboard.hello').replace('用户', currentAccount.name || currentAccount.email.split('@')[0])
                                    : t('dashboard.hello')
                                }
                            </h1>
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Shield Active
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-cyan-500" />
                            Antigravity Shield Gateway • Enterprise AI Rotation & Quota Guard
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                        <AddAccountDialog onAdd={handleAddAccount} />
                        <button
                            className={`px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg shadow-cyan-500/25 border border-cyan-400/30 cursor-pointer ${isRefreshing || !currentAccount ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
                            onClick={handleRefreshCurrent}
                            disabled={isRefreshing || !currentAccount}
                            title={isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh_quota')}</span>
                        </button>
                    </div>
                </div>

                {/* 统计卡片 - 5 columns */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                    {/* Card 1: Total Accounts */}
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200 cyber-card group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/20 rounded-xl">
                                <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">POOL</span>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.total}</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dashboard.total_accounts')}</div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                    </div>

                    {/* Card 2: Avg Gemini */}
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 cyber-card group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 rounded-xl">
                                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${stats.avgGemini >= 50 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                                {stats.avgGemini >= 50 ? t('dashboard.quota_sufficient') : t('dashboard.quota_low')}
                            </span>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.avgGemini}%</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dashboard.avg_gemini')}</div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${stats.avgGemini >= 50 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-rose-500'}`} 
                                style={{ width: `${Math.min(100, Math.max(0, stats.avgGemini))}%` }} 
                            />
                        </div>
                    </div>

                    {/* Card 3: Avg Gemini Image */}
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 cyber-card group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-purple-500/10 dark:bg-purple-500/15 border border-purple-500/20 rounded-xl">
                                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${stats.avgGeminiImage >= 50 ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                                {stats.avgGeminiImage >= 50 ? t('dashboard.quota_sufficient') : t('dashboard.quota_low')}
                            </span>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.avgGeminiImage}%</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dashboard.avg_gemini_image')}</div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${stats.avgGeminiImage >= 50 ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-amber-500 to-rose-500'}`} 
                                style={{ width: `${Math.min(100, Math.max(0, stats.avgGeminiImage))}%` }} 
                            />
                        </div>
                    </div>

                    {/* Card 4: Avg Claude */}
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/10 transition-all duration-200 cyber-card group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 rounded-xl">
                                <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${stats.avgClaude >= 50 ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                                {stats.avgClaude >= 50 ? t('dashboard.quota_sufficient') : t('dashboard.quota_low')}
                            </span>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.avgClaude}%</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dashboard.avg_claude')}</div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${stats.avgClaude >= 50 ? 'bg-gradient-to-r from-sky-500 to-blue-500' : 'bg-gradient-to-r from-amber-500 to-rose-500'}`} 
                                style={{ width: `${Math.min(100, Math.max(0, stats.avgClaude))}%` }} 
                            />
                        </div>
                    </div>

                    {/* Card 5: Low Quota Alerts */}
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-200 cyber-card group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            {stats.lowQuota > 0 && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse">
                                    ATTENTION
                                </span>
                            )}
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tight">{stats.lowQuota}</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dashboard.low_quota_accounts')}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">{t('dashboard.quota_desc')}</div>
                    </div>
                </div>

                {/* 双栏布局 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                {/* 快速链接 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <button
                        className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200 flex items-center justify-between group cursor-pointer"
                        onClick={() => navigate('/accounts')}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 group-hover:bg-cyan-500/20 transition-colors">
                                <Users className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <span className="text-slate-800 dark:text-slate-200 font-bold text-sm block">{t('dashboard.view_all_accounts')}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Manage, rotate and inspect accounts</span>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-cyan-500 group-hover:translate-x-1.5 transition-transform" />
                    </button>
                    <button
                        className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800/80 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 flex items-center justify-between group cursor-pointer"
                        onClick={handleExport}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 transition-colors">
                                <Download className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <span className="text-slate-800 dark:text-slate-200 font-bold text-sm block">{t('dashboard.export_data')}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Export encrypted backup of active accounts</span>
                            </div>
                        </div>
                        <Download className="w-5 h-5 text-purple-500 group-hover:translate-y-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
