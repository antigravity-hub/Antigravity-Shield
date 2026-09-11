import { create } from 'zustand';
import { Account } from '../types/account';
import * as accountService from '../services/accountService';

interface AccountState {
    accounts: Account[];
    currentAccount: Account | null;
    currentTargetIde: string | null;
    activeTargetAccounts: {
        platform: string | null;
        ide: string | null;
        agy: string | null;
    };
    loading: boolean;
    error: string | null;
    lastSyncedAt: number | null;

    // Actions
    fetchAccounts: () => Promise<void>;
    fetchCurrentAccount: () => Promise<void>;
    fetchActiveTargetAccounts: () => Promise<void>;
    isTargetActiveForAccount: (accountId: string, target: 'platform' | 'ide' | 'agy') => boolean;
    hasAnyActiveTarget: (accountId: string) => boolean;
    addAccount: (email: string, refreshToken: string) => Promise<void>;
    deleteAccount: (accountId: string) => Promise<void>;
    deleteAccounts: (accountIds: string[]) => Promise<void>;
    switchAccount: (accountId: string, targetIde?: string) => Promise<void>;
    refreshQuota: (accountId: string) => Promise<void>;
    refreshActiveAccountQuota: () => Promise<void>;
    refreshAllQuotas: () => Promise<accountService.RefreshStats>;
    reorderAccounts: (accountIds: string[]) => Promise<void>;

    // 新增 actions
    startOAuthLogin: () => Promise<void>;
    completeOAuthLogin: () => Promise<void>;
    cancelOAuthLogin: () => Promise<void>;
    importV1Accounts: () => Promise<void>;
    importFromDb: () => Promise<void>;
    importFromCustomDb: (path: string) => Promise<void>;
    syncAccountFromDb: () => Promise<void>;
    toggleProxyStatus: (accountId: string, enable: boolean, reason?: string) => Promise<void>;
    warmUpAccounts: () => Promise<string>;
    warmUpAccount: (accountId: string) => Promise<string>;
    updateAccountLabel: (accountId: string, label: string) => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
    accounts: [],
    currentAccount: null,
    currentTargetIde: localStorage.getItem('antigravity_current_target_ide') || 'platform',
    activeTargetAccounts: {
        platform: localStorage.getItem('antigravity_active_platform_account'),
        ide: localStorage.getItem('antigravity_active_ide_account'),
        agy: localStorage.getItem('antigravity_active_agy_account'),
    },
    loading: false,
    error: null,
    lastSyncedAt: null,

    isTargetActiveForAccount: (accountId: string, target: 'platform' | 'ide' | 'agy') => {
        const acc = get().accounts.find(a => a.id === accountId);
        if (acc?.active_targets?.includes(target)) return true;
        const targetMap = get().activeTargetAccounts;
        return targetMap[target] === accountId;
    },

    hasAnyActiveTarget: (accountId: string) => {
        const acc = get().accounts.find(a => a.id === accountId);
        if (acc?.active_targets && acc.active_targets.length > 0) return true;
        const targetMap = get().activeTargetAccounts;
        return targetMap.platform === accountId || targetMap.ide === accountId || targetMap.agy === accountId;
    },

    fetchActiveTargetAccounts: async () => {
        try {
            const targets = await accountService.getActiveTargetAccounts();
            if (targets) {
                if (targets.platform) localStorage.setItem('antigravity_active_platform_account', targets.platform);
                if (targets.ide) localStorage.setItem('antigravity_active_ide_account', targets.ide);
                if (targets.agy) localStorage.setItem('antigravity_active_agy_account', targets.agy);
                set({ activeTargetAccounts: targets });
            }
        } catch (e) {
            console.error('Fetch active target accounts failed:', e);
        }
    },

    fetchAccounts: async () => {
        set({ loading: true, error: null });
        try {
            console.log('[Store] Fetching accounts...');
            const accounts = await accountService.listAccounts();
            const targetAccounts = get().activeTargetAccounts;
            const currentAcc = get().currentAccount;
            const enrichedAccounts = accounts.map(acc => {
                const targets = new Set(acc.active_targets || []);
                if (targetAccounts.platform === acc.id) targets.add('platform');
                if (targetAccounts.ide === acc.id) targets.add('ide');
                if (targetAccounts.agy === acc.id) targets.add('agy');
                if (targets.size === 0 && currentAcc?.id === acc.id) {
                    const ide = get().currentTargetIde || 'platform';
                    targets.add(ide === 'ide' ? 'ide' : (ide === 'agy' ? 'agy' : 'platform'));
                }
                return {
                    ...acc,
                    active_targets: Array.from(targets)
                };
            });
            set({ accounts: enrichedAccounts, loading: false });
        } catch (error) {
            console.error('[Store] Fetch accounts failed:', error);
            set({ error: String(error), loading: false });
        }
    },

    fetchCurrentAccount: async () => {
        set({ loading: true, error: null });
        try {
            const account = await accountService.getCurrentAccount();
            const stored = localStorage.getItem('antigravity_current_target_ide');
            await get().fetchActiveTargetAccounts();
            set({
                currentAccount: account,
                currentTargetIde: stored || get().currentTargetIde || 'platform',
                loading: false
            });
        } catch (error) {
            set({ error: String(error), loading: false });
        }
    },

    addAccount: async (email: string, refreshToken: string) => {
        set({ loading: true, error: null });
        try {
            await accountService.addAccount(email, refreshToken);
            await get().fetchAccounts();
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deleteAccount: async (accountId: string) => {
        set({ loading: true, error: null });
        try {
            await accountService.deleteAccount(accountId);
            await Promise.all([
                get().fetchAccounts(),
                get().fetchCurrentAccount()
            ]);
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    deleteAccounts: async (accountIds: string[]) => {
        set({ loading: true, error: null });
        try {
            await accountService.deleteAccounts(accountIds);
            await Promise.all([
                get().fetchAccounts(),
                get().fetchCurrentAccount()
            ]);
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    switchAccount: async (accountId: string, targetIde?: string) => {
        set({ loading: true, error: null });
        try {
            await accountService.switchAccount(accountId, targetIde);
            const resolvedTarget = (targetIde === 'ide' ? 'ide' : (targetIde === 'agy' || targetIde === 'cli' ? 'agy' : 'platform')) as 'platform' | 'ide' | 'agy';
            localStorage.setItem('antigravity_current_target_ide', resolvedTarget);

            // Update activeTargetAccounts map
            const currentTargets = { ...get().activeTargetAccounts };
            currentTargets[resolvedTarget] = accountId;
            localStorage.setItem(`antigravity_active_${resolvedTarget}_account`, accountId);

            // Immediately update in-memory accounts active_targets
            const updatedAccounts = get().accounts.map(acc => {
                const targets = new Set(acc.active_targets || []);
                if (acc.id !== accountId) {
                    targets.delete(resolvedTarget);
                } else {
                    targets.add(resolvedTarget);
                }
                return {
                    ...acc,
                    active_targets: Array.from(targets)
                };
            });

            set({
                loading: false,
                currentTargetIde: resolvedTarget,
                activeTargetAccounts: currentTargets,
                accounts: updatedAccounts,
            });

            await Promise.all([
                get().fetchCurrentAccount(),
                get().fetchAccounts(),
            ]);
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    refreshQuota: async (accountId: string) => {
        set({ loading: true, error: null });
        try {
            await accountService.fetchAccountQuota(accountId);
            await get().fetchAccounts();
            set({ loading: false, lastSyncedAt: Date.now() });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    refreshActiveAccountQuota: async () => {
        const { currentAccount, accounts, activeTargetAccounts } = get();
        const targetIds = new Set<string>();
        if (currentAccount?.id) targetIds.add(currentAccount.id);
        Object.values(activeTargetAccounts).forEach(id => {
            if (id) targetIds.add(id);
        });

        if (targetIds.size === 0 && accounts.length > 0) {
            targetIds.add(accounts[0].id);
        }

        if (targetIds.size === 0) return;

        try {
            for (const id of targetIds) {
                await accountService.fetchAccountQuota(id);
            }
            await get().fetchAccounts();
            set({ lastSyncedAt: Date.now() });
        } catch (error) {
            console.error('[AccountStore] refreshActiveAccountQuota error:', error);
        }
    },

    refreshAllQuotas: async () => {
        set({ loading: true, error: null });
        try {
            const stats = await accountService.refreshAllQuotas();
            await get().fetchAccounts();
            set({ loading: false, lastSyncedAt: Date.now() });
            return stats;
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    /**
     * 重新排序账号列表
     * 采用乐观更新策略：先更新本地状态再调用后端持久化，以提供流畅的拖拽体验
     */
    reorderAccounts: async (accountIds: string[]) => {
        const { accounts } = get();

        // 创建 ID 到账号的映射
        const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

        // 按新顺序重建账号数组
        const reorderedAccounts = accountIds
            .map(id => accountMap.get(id))
            .filter((acc): acc is Account => acc !== undefined);

        // 添加未在新顺序中的账号（保持原有顺序）
        const remainingAccounts = accounts.filter(acc => !accountIds.includes(acc.id));
        const finalAccounts = [...reorderedAccounts, ...remainingAccounts];

        // 乐观更新本地状态
        set({ accounts: finalAccounts });

        try {
            await accountService.reorderAccounts(accountIds);
        } catch (error) {
            // 后端失败时回滚到原始顺序
            console.error('[AccountStore] Reorder accounts failed:', error);
            set({ accounts });
            throw error;
        }
    },

    startOAuthLogin: async () => {
        set({ loading: true, error: null });
        try {
            await accountService.startOAuthLogin();
            await get().fetchAccounts();
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    completeOAuthLogin: async () => {
        set({ loading: true, error: null });
        try {
            await accountService.completeOAuthLogin();
            await get().fetchAccounts();
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    cancelOAuthLogin: async () => {
        try {
            await accountService.cancelOAuthLogin();
            set({ loading: false, error: null });
        } catch (error) {
            console.error('[Store] Cancel OAuth failed:', error);
        }
    },

    importV1Accounts: async () => {
        set({ loading: true, error: null });
        try {
            await accountService.importV1Accounts();
            await get().fetchAccounts();
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    importFromDb: async () => {
        set({ loading: true, error: null });
        try {
            await accountService.importFromDb();
            await Promise.all([
                get().fetchAccounts(),
                get().fetchCurrentAccount()
            ]);
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    importFromCustomDb: async (path: string) => {
        set({ loading: true, error: null });
        try {
            await accountService.importFromCustomDb(path);
            await Promise.all([
                get().fetchAccounts(),
                get().fetchCurrentAccount()
            ]);
            set({ loading: false });
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        }
    },

    syncAccountFromDb: async () => {
        try {
            const syncedAccount = await accountService.syncAccountFromDb();
            if (syncedAccount) {
                console.log('[AccountStore] Account synced from DB:', syncedAccount.email);
                await get().fetchAccounts();
                set({ currentAccount: syncedAccount });
            }
        } catch (error) {
            console.error('[AccountStore] Sync from DB failed:', error);
        }
    },

    toggleProxyStatus: async (accountId: string, enable: boolean, reason?: string) => {
        try {
            await accountService.toggleProxyStatus(accountId, enable, reason);
            await get().fetchAccounts();
        } catch (error) {
            console.error('[AccountStore] Toggle proxy status failed:', error);
            throw error;
        }
    },

    warmUpAccounts: async () => {
        set({ loading: true, error: null });
        try {
            const result = await accountService.warmUpAllAccounts();
            set({ loading: false });
            return result;
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        } finally {
            await get().fetchAccounts();
        }
    },

    warmUpAccount: async (accountId: string) => {
        set({ loading: true, error: null });
        try {
            const result = await accountService.warmUpAccount(accountId);
            set({ loading: false });
            return result;
        } catch (error) {
            set({ error: String(error), loading: false });
            throw error;
        } finally {
            await get().fetchAccounts();
        }
    },

    updateAccountLabel: async (accountId: string, label: string) => {
        try {
            await accountService.updateAccountLabel(accountId, label);
            // 乐观更新本地状态
            const { accounts } = get();
            const updatedAccounts = accounts.map(acc =>
                acc.id === accountId ? { ...acc, custom_label: label || undefined } : acc
            );
            set({ accounts: updatedAccounts });
        } catch (error) {
            console.error('[AccountStore] Update label failed:', error);
            throw error;
        }
    },
}));
