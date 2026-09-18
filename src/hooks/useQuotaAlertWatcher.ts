import { useEffect, useRef } from 'react';
import { useAccountStore } from '../stores/useAccountStore';
import { useConfigStore } from '../stores/useConfigStore';
import { showToast } from '../components/common/ToastContainer';
import { sendDesktopNotification } from '../services/notificationService';
import { getRecommendedBestAccount } from '../utils/bestAccount';
import { useTranslation } from 'react-i18next';

// Cache last alert timestamp per (email:grouped_key) to prevent spamming
const lastAlertMap = new Map<string, number>();
const lastAutoSwitchMap = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown
const AUTO_SWITCH_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per account

function isClaudeModel(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.includes('claude') || lower.includes('opus') || lower.includes('sonnet') || lower.includes('haiku');
}

function isGeminiModel(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.includes('gemini');
}

function formatGroupedModelNames(models: { name: string; display_name?: string }[]): string {
    const hasClaude = models.some(m => isClaudeModel(m.name));
    const hasGemini = models.some(m => isGeminiModel(m.name));

    const familyLabels: string[] = [];

    if (hasClaude) {
        const claudeModels = models.filter(m => isClaudeModel(m.name));
        if (claudeModels.length > 1) {
            familyLabels.push('Claude');
        } else {
            familyLabels.push(claudeModels[0].display_name || 'Claude');
        }
    }

    if (hasGemini) {
        const geminiModels = models.filter(m => isGeminiModel(m.name));
        if (geminiModels.length > 1) {
            familyLabels.push('Gemini');
        } else {
            familyLabels.push(geminiModels[0].display_name || 'Gemini');
        }
    }

    // Other models (e.g. GPT-OSS)
    const otherModels = models.filter(m => !isClaudeModel(m.name) && !isGeminiModel(m.name));
    for (const om of otherModels) {
        familyLabels.push(om.display_name || om.name);
    }

    return familyLabels.join(' & ') || 'Model';
}

export function useQuotaAlertWatcher() {
    const { t } = useTranslation();
    const { config } = useConfigStore();
    const { accounts, currentAccount, activeTargetAccounts, switchAccount, fetchAccounts } = useAccountStore();
    const prevPercentageMap = useRef<Map<string, number>>(new Map());
    const isAutoSwitchingRef = useRef(false);

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
        const autoSwitchEnabled = config?.auto_switch_on_quota !== false;

        for (const targetId of targetIds) {
            const targetAccount = accounts.find(a => a.id === targetId);
            if (!targetAccount || targetAccount.disabled || targetAccount.proxy_disabled) {
                continue;
            }

            let targetEnv: 'ide' | 'platform' | 'agy' | undefined = undefined;
            if (activeTargetAccounts?.ide === targetId) targetEnv = 'ide';
            else if (activeTargetAccounts?.platform === targetId) targetEnv = 'platform';
            else if (activeTargetAccounts?.agy === targetId) targetEnv = 'agy';

            // Collect all critically low models for this account
            const criticalModels: { name: string; display_name?: string; percentage: number }[] = [];
            let hasNewZero = false;

            // A. Check individual rolling models
            if (targetAccount.quota?.models) {
                for (const model of targetAccount.quota.models) {
                    const pct = model.percentage;
                    if (pct !== undefined && pct !== null && pct <= 5 && pct >= 0) {
                        criticalModels.push({
                            name: model.name,
                            display_name: model.display_name,
                            percentage: pct,
                        });

                        const alertKey = `${targetAccount.email}:${model.name}`;
                        const prevPct = prevPercentageMap.current.get(alertKey);
                        if (pct === 0 && prevPct !== 0) {
                            hasNewZero = true;
                        }
                        prevPercentageMap.current.set(alertKey, pct);
                    } else if (pct !== undefined && pct > 5) {
                        const alertKey = `${targetAccount.email}:${model.name}`;
                        lastAlertMap.delete(alertKey);
                        prevPercentageMap.current.delete(alertKey);
                    }
                }
            }

            // B. Check weekly quota groups
            let weeklyClaudeDepleted = false;
            let weeklyGeminiDepleted = false;
            if (targetAccount.quota?.quota_groups) {
                for (const group of targetAccount.quota.quota_groups) {
                    for (const bucket of group.buckets || []) {
                        const bWindow = (bucket.window || '').toLowerCase();
                        const isWeekly = bWindow.includes('week') || (bucket.bucket_id || '').toLowerCase().includes('week');
                        if (isWeekly && typeof bucket.remaining_fraction === 'number') {
                            const pct = Math.round(bucket.remaining_fraction * 100);
                            const bId = (bucket.bucket_id || '').toLowerCase();
                            const gName = (group.display_name || '').toLowerCase();

                            if (pct === 0) {
                                if (bId.includes('claude') || gName.includes('claude')) {
                                    weeklyClaudeDepleted = true;
                                }
                                if (bId.includes('gemini') || gName.includes('gemini')) {
                                    weeklyGeminiDepleted = true;
                                }
                            }

                            if (pct <= 5 && pct >= 0) {
                                const groupLabel = group.display_name || bucket.display_name || 'Weekly';
                                criticalModels.push({
                                    name: bucket.bucket_id || groupLabel,
                                    display_name: `${groupLabel} (Weekly)`,
                                    percentage: pct,
                                });

                                const alertKey = `${targetAccount.email}:weekly:${bucket.bucket_id}`;
                                const prevPct = prevPercentageMap.current.get(alertKey);
                                if (pct === 0 && prevPct !== 0) {
                                    hasNewZero = true;
                                }
                                prevPercentageMap.current.set(alertKey, pct);
                            }
                        }
                    }
                }
            }

            if (criticalModels.length === 0) {
                continue;
            }

            // 1. Grouped Alert Handling (Never send multiple toasts for the same account!)
            const accountAlertKey = `${targetAccount.email}:grouped`;
            const lastAlertTime = lastAlertMap.get(accountAlertKey) || 0;
            const minPercentage = Math.min(...criticalModels.map(m => m.percentage));
            const shouldAlert = (now - lastAlertTime > ALERT_COOLDOWN_MS) || hasNewZero;

            if (shouldAlert) {
                lastAlertMap.set(accountAlertKey, now);

                const combinedModelName = formatGroupedModelNames(criticalModels);
                const alertTitle = t('notifications.quota_alert_title', {
                    defaultValue: 'Antigravity Shield - Low Quota Alert',
                });
                const alertMsg = t('notifications.quota_critical_alert', {
                    defaultValue: `⚠️ Critical Quota Alert: ${combinedModelName} is at ${minPercentage}% on account ${targetAccount.email}. Switch accounts or wait for quota reset.`,
                    model: combinedModelName,
                    email: targetAccount.email,
                    percentage: minPercentage,
                });

                showToast(alertMsg, 'warning', 8000);
                sendDesktopNotification(alertTitle, alertMsg);
            }

            // 2. Intelligent Auto-Switching on Quota Depletion (0%)
            const claudeDepleted = weeklyClaudeDepleted || criticalModels.some(m => isClaudeModel(m.name) && m.percentage === 0);
            const geminiDepleted = weeklyGeminiDepleted || criticalModels.some(m => isGeminiModel(m.name) && m.percentage === 0);

            if (autoSwitchEnabled && (claudeDepleted || geminiDepleted) && !isAutoSwitchingRef.current) {
                const lastSwitch = lastAutoSwitchMap.get(targetAccount.id) || 0;
                if (now - lastSwitch < AUTO_SWITCH_COOLDOWN_MS) {
                    continue;
                }

                if (claudeDepleted) {
                    // Step 1: Find next Claude account
                    const bestClaude = getRecommendedBestAccount(accounts, targetAccount.id, {
                        category: 'claude',
                    });

                    if (bestClaude.account && bestClaude.claudeScore > 0) {
                        const nextAccount = bestClaude.account;
                        isAutoSwitchingRef.current = true;
                        lastAutoSwitchMap.set(targetAccount.id, now);
                        lastAutoSwitchMap.set(nextAccount.id, now);

                        const switchTitle = t('notifications.auto_switch_title', {
                            defaultValue: 'Antigravity Shield - Auto Switched',
                        });
                        const switchMsg = t('notifications.auto_switch_claude_success', {
                            defaultValue: `⚡ Auto-Switched: Claude quota exhausted on ${targetAccount.email}. Switched to ${nextAccount.email} (${bestClaude.claudeScore}% Claude quota).`,
                            from: targetAccount.email,
                            to: nextAccount.email,
                            score: bestClaude.claudeScore,
                        });

                        (async () => {
                            try {
                                console.log(`[QuotaAlertWatcher] Auto-switching target ${targetEnv || 'default'} from ${targetAccount.email} to ${nextAccount.email} (Claude score: ${bestClaude.claudeScore}%)`);
                                await switchAccount(nextAccount.id, targetEnv);
                                showToast(switchMsg, 'success', 8000);
                                sendDesktopNotification(switchTitle, switchMsg);
                                await fetchAccounts();
                            } catch (err) {
                                console.error('[QuotaAlertWatcher] Auto-switch failed:', err);
                            } finally {
                                isAutoSwitchingRef.current = false;
                            }
                        })();
                        break;
                    } else {
                        // Step 2: Fallback to Gemini if all Claude quotas exhausted!
                        const bestGemini = getRecommendedBestAccount(accounts, targetAccount.id, {
                            category: 'gemini',
                        });

                        if (bestGemini.account && bestGemini.geminiScore > 0) {
                            const nextAccount = bestGemini.account;
                            isAutoSwitchingRef.current = true;
                            lastAutoSwitchMap.set(targetAccount.id, now);
                            lastAutoSwitchMap.set(nextAccount.id, now);

                            const switchTitle = t('notifications.auto_switch_title', {
                                defaultValue: 'Antigravity Shield - Auto Switched',
                            });
                            const switchMsg = t('notifications.auto_switch_fallback_gemini', {
                                defaultValue: `⚡ Auto-Switched: All Claude quotas depleted. Fallback switched to ${nextAccount.email} (${bestGemini.geminiScore}% Gemini quota).`,
                                from: targetAccount.email,
                                to: nextAccount.email,
                                score: bestGemini.geminiScore,
                            });

                            (async () => {
                                try {
                                    console.log(`[QuotaAlertWatcher] All Claude depleted. Fallback auto-switching to ${nextAccount.email} (Gemini score: ${bestGemini.geminiScore}%)`);
                                    await switchAccount(nextAccount.id, targetEnv);
                                    showToast(switchMsg, 'info', 8000);
                                    sendDesktopNotification(switchTitle, switchMsg);
                                    await fetchAccounts();
                                } catch (err) {
                                    console.error('[QuotaAlertWatcher] Fallback auto-switch failed:', err);
                                } finally {
                                    isAutoSwitchingRef.current = false;
                                }
                            })();
                            break;
                        } else {
                            // Step 3: All Claude and Gemini quotas depleted!
                            const exhaustedTitle = t('notifications.quota_exhausted_title', {
                                defaultValue: 'Antigravity Shield - Quota Depleted',
                            });
                            const exhaustedMsg = t('notifications.all_quotas_depleted', {
                                defaultValue: '⚠️ All Claude and Gemini quotas exhausted across all available accounts.',
                            });
                            showToast(exhaustedMsg, 'error', 9000);
                            sendDesktopNotification(exhaustedTitle, exhaustedMsg);
                        }
                    }
                } else if (geminiDepleted) {
                    // Gemini was depleted: Switch to next account with Gemini quota
                    const bestGemini = getRecommendedBestAccount(accounts, targetAccount.id, {
                        category: 'gemini',
                    });

                    if (bestGemini.account && bestGemini.geminiScore > 0) {
                        const nextAccount = bestGemini.account;
                        isAutoSwitchingRef.current = true;
                        lastAutoSwitchMap.set(targetAccount.id, now);
                        lastAutoSwitchMap.set(nextAccount.id, now);

                        const switchTitle = t('notifications.auto_switch_title', {
                            defaultValue: 'Antigravity Shield - Auto Switched',
                        });
                        const switchMsg = t('notifications.auto_switch_gemini_success', {
                            defaultValue: `⚡ Auto-Switched: Gemini quota exhausted on ${targetAccount.email}. Switched to ${nextAccount.email} (${bestGemini.geminiScore}% Gemini quota).`,
                            from: targetAccount.email,
                            to: nextAccount.email,
                            score: bestGemini.geminiScore,
                        });

                        (async () => {
                            try {
                                console.log(`[QuotaAlertWatcher] Auto-switching target ${targetEnv || 'default'} to ${nextAccount.email} (Gemini score: ${bestGemini.geminiScore}%)`);
                                await switchAccount(nextAccount.id, targetEnv);
                                showToast(switchMsg, 'success', 8000);
                                sendDesktopNotification(switchTitle, switchMsg);
                                await fetchAccounts();
                            } catch (err) {
                                console.error('[QuotaAlertWatcher] Auto-switch failed:', err);
                            } finally {
                                isAutoSwitchingRef.current = false;
                            }
                        })();
                        break;
                    }
                }
            }
        }
    }, [accounts, currentAccount, activeTargetAccounts, config?.auto_switch_on_quota, t, switchAccount, fetchAccounts]);
}
