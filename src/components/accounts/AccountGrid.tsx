/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Account } from '../../types/account';
import AccountCard from './AccountCard';
import { clusterAccountsByFamily } from '../../utils/familyGroup';

interface AccountGridProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    switchingTarget?: string | null;
    onSwitch: (accountId: string, targetIde?: string) => void;
    onRefresh: (accountId: string) => void;
    onViewDevice: (accountId: string) => void;
    onViewDetails: (accountId: string) => void;
    onExport: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onToggleProxy: (accountId: string) => void;
    onWarmup?: (accountId: string) => void;
    onUpdateLabel?: (accountId: string, label: string) => void;
    onViewError: (accountId: string) => void;
    quotaWindow?: '5h' | 'weekly';
    quotaProvider?: 'gemini' | 'claude';
}

function AccountGrid({
    accounts,
    selectedIds,
    refreshingIds,
    onToggleSelect,
    currentAccountId,
    switchingAccountId,
    switchingTarget,
    onSwitch,
    onRefresh,
    onViewDetails,
    onExport,
    onDelete,
    onToggleProxy,
    onViewDevice,
    onWarmup,
    onUpdateLabel,
    onViewError,
    quotaWindow,
    quotaProvider,
}: AccountGridProps) {
    const { t } = useTranslation();

    const displayChunks = useMemo(() => {
        if (accounts.length === 0) return [];
        const { accountFamilyMap } = clusterAccountsByFamily(accounts);
        const chunks: Array<
            | { type: 'single'; account: Account }
            | { type: 'family'; familyId: string; accounts: Account[] }
        > = [];

        const seenFamilyIds = new Set<string>();

        for (const account of accounts) {
            const family = accountFamilyMap.get(account.id);
            if (family && family.isFamily) {
                if (seenFamilyIds.has(family.id)) {
                    continue;
                }
                seenFamilyIds.add(family.id);
                // Collect member accounts present in the current view
                const membersInView = accounts.filter((a) => family.accountIds.includes(a.id));
                chunks.push({
                    type: 'family',
                    familyId: family.id,
                    accounts: membersInView,
                });
            } else {
                chunks.push({
                    type: 'single',
                    account,
                });
            }
        }

        return chunks;
    }, [accounts]);

    if (accounts.length === 0) {
        return (
            <div className="bg-white dark:bg-base-100 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                <p className="text-gray-400 mb-2">{t('accounts.empty.title')}</p>
                <p className="text-sm text-gray-400">{t('accounts.empty.desc')}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayChunks.map((chunk) => {
                if (chunk.type === 'single') {
                    const account = chunk.account;
                    return (
                        <AccountCard
                            key={account.id}
                            account={account}
                            selected={selectedIds.has(account.id)}
                            isRefreshing={refreshingIds.has(account.id)}
                            onSelect={() => onToggleSelect(account.id)}
                            isCurrent={account.id === currentAccountId}
                            isSwitching={account.id === switchingAccountId}
                            switchingTarget={account.id === switchingAccountId ? switchingTarget : null}
                            onSwitch={(targetIde?: string) => onSwitch(account.id, targetIde)}
                            onRefresh={() => onRefresh(account.id)}
                            onViewDevice={() => onViewDevice(account.id)}
                            onViewDetails={() => onViewDetails(account.id)}
                            onExport={() => onExport(account.id)}
                            onDelete={() => onDelete(account.id)}
                            onToggleProxy={() => onToggleProxy(account.id)}
                            onWarmup={onWarmup ? () => onWarmup(account.id) : undefined}
                            onUpdateLabel={onUpdateLabel ? (label: string) => onUpdateLabel(account.id, label) : undefined}
                            onViewError={() => onViewError(account.id)}
                            quotaWindow={quotaWindow}
                            quotaProvider={quotaProvider}
                        />
                    );
                }

                // Family Group Container with Dashed Border
                return (
                    <div
                        key={chunk.familyId}
                        className="col-span-full relative rounded-2xl border-2 border-dashed p-4 pt-6 my-1 transition-all"
                        style={{
                            borderColor: 'var(--color-badge-border)',
                            backgroundColor: 'rgba(var(--color-accent-rgb, 147, 233, 190), 0.03)',
                        }}
                    >
                        {/* Corner Badge on the dashed border line */}
                        <div
                            className="absolute -top-3 start-4 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-sm bg-white dark:bg-[#121714] border select-none"
                            style={{
                                borderColor: 'var(--color-badge-border)',
                                color: 'var(--color-accent)',
                            }}
                        >
                            <Users className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                            <span>{t('accounts.family_group', 'Family Group')}</span>
                            <span
                                className="text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold"
                                style={{
                                    backgroundColor: 'var(--color-badge-bg)',
                                    color: 'var(--color-accent)',
                                }}
                            >
                                {chunk.accounts.length}
                            </span>
                        </div>

                        {/* Inner grid for family cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {chunk.accounts.map((account) => (
                                <AccountCard
                                    key={account.id}
                                    account={account}
                                    selected={selectedIds.has(account.id)}
                                    isRefreshing={refreshingIds.has(account.id)}
                                    onSelect={() => onToggleSelect(account.id)}
                                    isCurrent={account.id === currentAccountId}
                                    isSwitching={account.id === switchingAccountId}
                                    switchingTarget={account.id === switchingAccountId ? switchingTarget : null}
                                    onSwitch={(targetIde?: string) => onSwitch(account.id, targetIde)}
                                    onRefresh={() => onRefresh(account.id)}
                                    onViewDevice={() => onViewDevice(account.id)}
                                    onViewDetails={() => onViewDetails(account.id)}
                                    onExport={() => onExport(account.id)}
                                    onDelete={() => onDelete(account.id)}
                                    onToggleProxy={() => onToggleProxy(account.id)}
                                    onWarmup={onWarmup ? () => onWarmup(account.id) : undefined}
                                    onUpdateLabel={onUpdateLabel ? (label: string) => onUpdateLabel(account.id, label) : undefined}
                                    onViewError={() => onViewError(account.id)}
                                    quotaWindow={quotaWindow}
                                    quotaProvider={quotaProvider}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default AccountGrid;
