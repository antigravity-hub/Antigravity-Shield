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
        // 1. Identify the account currently active in Antigravity Platform
        const platformAccountId = activeTargetAccounts?.platform || currentAccount?.id;
        if (!platformAccountId) return;

        const targetAccount = accounts.find(a => a.id === platformAccountId) || currentAccount;
        if (!targetAccount || !targetAccount.quota?.models || targetAccount.disabled || targetAccount.proxy_disabled) {
            return;
        }

        const now = Date.now();

        for (const model of targetAccount.quota.models) {
            const pct = model.percentage;
            // Trigger when quota is critically low (<= 5%)
            if (pct !== undefined && pct !== null && pct <= 5 && pct >= 0) {
                const alertKey = `${targetAccount.email}:${model.name}`;
                const lastAlert = lastAlertMap.get(alertKey) || 0;
                const prevPct = prevPercentageMap.current.get(alertKey);

                // Alert if cooldown elapsed OR if percentage dropped further while <= 5%
                const shouldAlert = (now - lastAlert > ALERT_COOLDOWN_MS) || (prevPct !== undefined && pct < prevPct);

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

                    // 1. Show In-App Warning Toast
                    showToast(alertMsg, 'warning', 8000);

                    // 2. Show Native Desktop Notification
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
                // If model recharged above 5%, reset tracking for this model
                const alertKey = `${targetAccount.email}:${model.name}`;
                lastAlertMap.delete(alertKey);
                prevPercentageMap.current.delete(alertKey);
            }
        }
    }, [accounts, currentAccount, activeTargetAccounts, t]);
}
