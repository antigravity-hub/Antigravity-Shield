import { useEffect, useRef } from 'react';
import { useAccountStore } from '../stores/useAccountStore';
import { showToast } from '../components/common/ToastContainer';
import { useTranslation } from 'react-i18next';

// Cache last alert timestamp per (email:model) to prevent spamming
const lastAlertMap = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown

export function useQuotaAlertWatcher() {
    const { t } = useTranslation();
    const { accounts, currentAccount, activeTargetAccounts } = useAccountStore();
    const prevPercentageMap = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        // Request desktop notification permission on initial mount if supported
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, []);

    useEffect(() => {
        // 1. Collect target account IDs (platform, ide, cli, currentAccount)
        const targetIds = new Set<string>();
        if (activeTargetAccounts?.platform) targetIds.add(activeTargetAccounts.platform);
        if (activeTargetAccounts?.ide) targetIds.add(activeTargetAccounts.ide);
        if (activeTargetAccounts?.agy) targetIds.add(activeTargetAccounts.agy);
        if (targetIds.size === 0 && currentAccount?.id) {
            targetIds.add(currentAccount.id);
        }

        const now = Date.now();

        for (const targetId of targetIds) {
            const targetAccount = accounts.find(a => a.id === targetId);
            if (!targetAccount || targetAccount.disabled || targetAccount.proxy_disabled) {
                continue;
            }

            // A. Check individual 5h rolling models
            if (targetAccount.quota?.models) {
                for (const model of targetAccount.quota.models) {
                    const pct = model.percentage;
                    if (pct !== undefined && pct !== null && pct <= 5 && pct >= 0) {
                        const alertKey = `${targetAccount.email}:${model.name}`;
                        const lastAlert = lastAlertMap.get(alertKey) || 0;
                        const prevPct = prevPercentageMap.current.get(alertKey);

                        // Trigger alert if cooldown elapsed or reached 0%
                        const shouldAlert = (now - lastAlert > ALERT_COOLDOWN_MS) || (pct === 0 && prevPct !== 0);

                        if (shouldAlert) {
                            lastAlertMap.set(alertKey, now);
                            prevPercentageMap.current.set(alertKey, pct);

                            const modelLabel = model.display_name || model.name;
                            const alertMsg = t(
                                'notifications.quota_critical_alert',
                                {
                                    defaultValue: `⚠️ Antigravity Platform: Model ${modelLabel} on ${targetAccount.email} is critically low (${pct}%)!`,
                                    model: modelLabel,
                                    email: targetAccount.email,
                                    percentage: pct
                                }
                            );

                            showToast(alertMsg, 'warning', 8000);

                            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                                try {
                                    new Notification('Antigravity Shield - Low Quota Alert', {
                                        body: alertMsg,
                                        icon: '/icons/128x128.png',
                                    });
                                } catch (e) {
                                    console.warn('[QuotaAlert] Failed to show desktop notification:', e);
                                }
                            }
                        }
                    } else if (pct !== undefined && pct > 5) {
                        const alertKey = `${targetAccount.email}:${model.name}`;
                        lastAlertMap.delete(alertKey);
                        prevPercentageMap.current.delete(alertKey);
                    }
                }
            }

            // B. Check weekly quota groups
            if (targetAccount.quota?.quota_groups) {
                for (const group of targetAccount.quota.quota_groups) {
                    for (const bucket of group.buckets || []) {
                        const bWindow = (bucket.window || '').toLowerCase();
                        const isWeekly = bWindow.includes('week') || (bucket.bucket_id || '').toLowerCase().includes('week');
                        if (isWeekly && typeof bucket.remaining_fraction === 'number') {
                            const pct = Math.round(bucket.remaining_fraction * 100);
                            if (pct <= 5 && pct >= 0) {
                                const alertKey = `${targetAccount.email}:weekly:${bucket.bucket_id}`;
                                const lastAlert = lastAlertMap.get(alertKey) || 0;
                                const prevPct = prevPercentageMap.current.get(alertKey);

                                const shouldAlert = (now - lastAlert > ALERT_COOLDOWN_MS) || (pct === 0 && prevPct !== 0);

                                if (shouldAlert) {
                                    lastAlertMap.set(alertKey, now);
                                    prevPercentageMap.current.set(alertKey, pct);

                                    const groupLabel = group.display_name || bucket.display_name || 'Weekly';
                                    const alertMsg = t(
                                        'notifications.quota_critical_alert',
                                        {
                                            defaultValue: `⚠️ Antigravity Platform: Weekly quota for ${groupLabel} on ${targetAccount.email} is critically low (${pct}%)!`,
                                            model: `${groupLabel} (Weekly)`,
                                            email: targetAccount.email,
                                            percentage: pct
                                        }
                                    );

                                    showToast(alertMsg, 'warning', 8000);

                                    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                                        try {
                                            new Notification('Antigravity Shield - Low Quota Alert', {
                                                body: alertMsg,
                                                icon: '/icons/128x128.png',
                                            });
                                        } catch (e) {
                                            console.warn('[QuotaAlert] Failed to show desktop notification:', e);
                                        }
                                    }
                                }
                            } else if (pct > 5) {
                                const alertKey = `${targetAccount.email}:weekly:${bucket.bucket_id}`;
                                lastAlertMap.delete(alertKey);
                                prevPercentageMap.current.delete(alertKey);
                            }
                        }
                    }
                }
            }
        }
    }, [accounts, currentAccount, activeTargetAccounts, t]);
}
