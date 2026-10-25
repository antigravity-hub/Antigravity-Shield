/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { useEffect, useRef } from 'react';
import { useAccountStore } from '../stores/useAccountStore';
import { useConfigStore } from '../stores/useConfigStore';
import { Account } from '../types/account';
import { showToast } from '../components/common/ToastContainer';
import { sendDesktopNotification } from '../services/notificationService';
import { showFloatingOverlay } from '../services/overlayNotificationService';
import { getRecommendedBestAccount, getAccountEffectiveScores } from '../utils/bestAccount';
import { extractModelScore, getModelDisplayName } from '../utils/modelCategory';
import { useTranslation } from 'react-i18next';

// Cache last alert timestamp per (email:grouped_key) to prevent spamming
const lastAlertMap = new Map<string, number>();
const lastAutoSwitchMap = new Map<string, number>();
let lastGlobalExhaustedAlert = 0;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown
const AUTO_SWITCH_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per account
const GLOBAL_EXHAUSTED_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown for global quota exhausted alerts

function isClaudeModel(name: string, displayName?: string): boolean {
    const lower = `${name || ''} ${displayName || ''}`.toLowerCase();
    return lower.includes('claude') || lower.includes('opus') || lower.includes('sonnet') || lower.includes('haiku') || lower.includes('anthropic');
}

function isGeminiModel(name: string, displayName?: string): boolean {
    const lower = `${name || ''} ${displayName || ''}`.toLowerCase();
    return lower.includes('gemini') || lower.includes('flash') || lower.includes('pro') || lower.includes('ultra') || lower.includes('bison') || lower.includes('gemma');
}

function formatGroupedModelNames(models: { name: string; display_name?: string }[], t?: any): string {
    const hasClaude = models.some(m => isClaudeModel(m.name, m.display_name));
    const hasGemini = models.some(m => isGeminiModel(m.name, m.display_name));

    const familyLabels: string[] = [];

    const geminiLabel = t ? t('notifications.family_gemini', { defaultValue: 'Gemini' }) : 'Gemini';
    const claudeLabel = t ? t('notifications.family_claude', { defaultValue: 'Claude' }) : 'Claude';
    const andSeparator = t ? t('notifications.and_separator', { defaultValue: ' & ' }) : ' & ';

    // Always group all Gemini variants cleanly as "Gemini" / "جمینای", never listing 10-20 models individually
    if (hasGemini) {
        familyLabels.push(geminiLabel);
    }

    // Always group all Claude variants cleanly as "Claude" / "کلود"
    if (hasClaude) {
        familyLabels.push(claudeLabel);
    }

    // If neither matched (e.g. pure experimental/custom model), fallback to generic or count
    if (familyLabels.length === 0) {
        if (models.length === 1) {
            return models[0].display_name || models[0].name;
        }
        return t ? t('notifications.other_models', { defaultValue: 'Other models' }) : 'Other models';
    }

    return familyLabels.join(andSeparator);
}

function getTargetEnvLabel(
    targetId: string,
    activeTargetAccounts: { ide?: string | null; platform?: string | null; agy?: string | null } | null | undefined,
    t?: any
): string {
    const isPlatform = activeTargetAccounts?.platform === targetId;
    const isIde = activeTargetAccounts?.ide === targetId;
    const isAgy = activeTargetAccounts?.agy === targetId;

    if (isPlatform && isIde) {
        return t ? t('notifications.target_ide_and_platform', { defaultValue: 'IDE & Platform' }) : 'IDE & Platform';
    }
    if (isPlatform) {
        return t ? t('notifications.target_platform', { defaultValue: 'Platform (Harness)' }) : 'Platform (Harness)';
    }
    if (isIde) {
        return t ? t('notifications.target_ide', { defaultValue: 'IDE' }) : 'IDE';
    }
    if (isAgy) {
        return t ? t('notifications.target_agy', { defaultValue: 'AGY CLI' }) : 'AGY CLI';
    }
    return '';
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
            if (!targetAccount || targetAccount.disabled || targetAccount.validation_blocked || targetAccount.quota?.is_forbidden) {
                continue;
            }

            let targetEnv: 'ide' | 'platform' | 'agy' | undefined = undefined;
            if (activeTargetAccounts?.ide === targetId) targetEnv = 'ide';
            else if (activeTargetAccounts?.platform === targetId) targetEnv = 'platform';
            else if (activeTargetAccounts?.agy === targetId) targetEnv = 'agy';

            const targetLabel = getTargetEnvLabel(targetId, activeTargetAccounts, t);
            const targetPrefix = targetLabel ? `[${targetLabel}] ` : '';

            // Collect all critically low models for this account (configured threshold or default 5%)
            const DEPLETED_THRESHOLD = typeof config?.auto_switch_threshold_percentage === 'number'
                ? Math.max(1, Math.min(config.auto_switch_threshold_percentage, 90))
                : 5;
            const criticalModels: { name: string; display_name?: string; percentage: number }[] = [];
            let hasNewDepleted = false;

            // A. Check individual rolling models
            if (targetAccount.quota?.models) {
                for (const model of targetAccount.quota.models) {
                    const pct = model.percentage;
                    if (pct !== undefined && pct !== null && pct <= DEPLETED_THRESHOLD && pct >= 0) {
                        criticalModels.push({
                            name: model.name,
                            display_name: model.display_name,
                            percentage: pct,
                        });

                        const alertKey = `${targetAccount.email}:${model.name}`;
                        const prevPct = prevPercentageMap.current.get(alertKey);
                        if (pct <= DEPLETED_THRESHOLD && prevPct !== undefined && prevPct > DEPLETED_THRESHOLD) {
                            hasNewDepleted = true;
                        }
                        prevPercentageMap.current.set(alertKey, pct);
                    } else if (pct !== undefined && pct > DEPLETED_THRESHOLD) {
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

                            if (pct <= DEPLETED_THRESHOLD) {
                                if (bId.includes('claude') || gName.includes('claude')) {
                                    weeklyClaudeDepleted = true;
                                }
                                if (bId.includes('gemini') || gName.includes('gemini')) {
                                    weeklyGeminiDepleted = true;
                                }
                            }

                            if (pct <= DEPLETED_THRESHOLD && pct >= 0) {
                                const groupLabel = group.display_name || bucket.display_name || 'Weekly';
                                criticalModels.push({
                                    name: bucket.bucket_id || groupLabel,
                                    display_name: `${groupLabel} (Weekly)`,
                                    percentage: pct,
                                });

                                const alertKey = `${targetAccount.email}:weekly:${bucket.bucket_id}`;
                                const prevPct = prevPercentageMap.current.get(alertKey);
                                if (pct <= DEPLETED_THRESHOLD && prevPct !== undefined && prevPct > DEPLETED_THRESHOLD) {
                                    hasNewDepleted = true;
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
            const claudeDepleted = weeklyClaudeDepleted || criticalModels.some(m => isClaudeModel(m.name, m.display_name) && m.percentage <= DEPLETED_THRESHOLD);
            const geminiDepleted = weeklyGeminiDepleted || criticalModels.some(m => isGeminiModel(m.name, m.display_name) && m.percentage <= DEPLETED_THRESHOLD);
            const willAutoSwitch = autoSwitchEnabled && (claudeDepleted || geminiDepleted) && !isAutoSwitchingRef.current;

            const accountAlertKey = `${targetAccount.email}:grouped`;
            const lastAlertTime = lastAlertMap.get(accountAlertKey) || 0;
            const minPercentage = Math.min(...criticalModels.map(m => m.percentage));
            const shouldAlert = (now - lastAlertTime > ALERT_COOLDOWN_MS) || hasNewDepleted;

            if (shouldAlert && !willAutoSwitch) {
                lastAlertMap.set(accountAlertKey, now);

                const combinedModelName = formatGroupedModelNames(criticalModels, t);
                const alertTitle = t('notifications.quota_alert_title', {
                    defaultValue: 'Antigravity Shield - Low Quota Alert',
                });
                const alertMsg = t('notifications.quota_critical_alert', {
                    defaultValue: `⚠️ Critical Quota Alert: ${targetPrefix}${combinedModelName} quota is at ${minPercentage}% on account ${targetAccount.email}.`,
                    target: targetPrefix,
                    model: combinedModelName,
                    email: targetAccount.email,
                    percentage: minPercentage,
                });

                showToast(alertMsg, 'warning', 8000);
                sendDesktopNotification(alertTitle, alertMsg);
            }

            // 2. Intelligent Auto-Switching or In-App Guidance on Quota Depletion (<= 5%)
            if (autoSwitchEnabled && (claudeDepleted || geminiDepleted) && !isAutoSwitchingRef.current) {
                const lastSwitch = lastAutoSwitchMap.get(targetAccount.id) || 0;
                if (now - lastSwitch < AUTO_SWITCH_COOLDOWN_MS) {
                    continue;
                }

                // Calculate current effective scores on the active account
                const currentScores = getAccountEffectiveScores(targetAccount);

                // Exclude accounts already actively running in other slots (e.g. IDE or Platform)
                const otherActiveSlots = [
                    activeTargetAccounts?.ide,
                    activeTargetAccounts?.platform,
                    activeTargetAccounts?.agy,
                ].filter(id => id && id !== targetAccount.id);

                const triggerGracefulAutoSwitch = async (
                    sourceAccount: typeof targetAccount,
                    nextAccount: Account | null,
                    modelFamily: string,
                    quotaScore: number,
                    switchTitle: string,
                    switchMsg: string,
                    modelSwitchMode?: { canFocusApp: boolean; geminiScore: number }
                ) => {
                    // Do not show intrusive floating countdown overlay or notifications for IDE environment
                    const isIdeSwitch = targetEnv === 'ide' || (activeTargetAccounts?.ide === sourceAccount.id);
                    const overlayEnabled = config?.overlay_notifications_enabled !== false && !isIdeSwitch;
                    const countdownSecs = config?.auto_switch_countdown_secs || 30;

                    isAutoSwitchingRef.current = true;
                    lastAutoSwitchMap.set(sourceAccount.id, now);

                    try {
                        let shouldSwitch = false;

                        if (overlayEnabled) {
                            try {
                                const action = await showFloatingOverlay({
                                    notification_type: 'countdown',
                                    title: switchTitle,
                                    message: switchMsg,
                                    model_name: modelFamily,
                                    current_email: sourceAccount.email,
                                    target_email: nextAccount?.email,
                                    target_quota_score: quotaScore,
                                    countdown_secs: countdownSecs,
                                    target_account_id: nextAccount?.id,
                                    target_env: targetEnv,
                                    can_focus_app: modelSwitchMode?.canFocusApp,
                                    gemini_score: modelSwitchMode?.geminiScore,
                                });

                                if (action === 'focus_app') {
                                    console.log(`[QuotaAlertWatcher] User chose to focus app and continue with Gemini on ${sourceAccount.email}`);
                                    lastAutoSwitchMap.set(sourceAccount.id, Date.now() + 15 * 60 * 1000);
                                    shouldSwitch = false;
                                } else if (action === 'snooze') {
                                    console.log(`[QuotaAlertWatcher] Auto-switch snoozed for 5 minutes on ${sourceAccount.email}`);
                                    lastAutoSwitchMap.set(sourceAccount.id, Date.now() + 5 * 60 * 1000);
                                    shouldSwitch = false;
                                } else if (action === 'cancel') {
                                    console.log(`[QuotaAlertWatcher] Auto-switch cancelled for 30 minutes on ${sourceAccount.email}`);
                                    lastAutoSwitchMap.set(sourceAccount.id, Date.now() + 30 * 60 * 1000);
                                    shouldSwitch = false;
                                } else if (action === 'switch_now' && nextAccount) {
                                    console.log(`[QuotaAlertWatcher] User confirmed switch_now from overlay for ${sourceAccount.email}`);
                                    lastAutoSwitchMap.set(sourceAccount.id, Date.now() + 15 * 60 * 1000);
                                    shouldSwitch = true;
                                }
                            } catch (e) {
                                console.warn('[QuotaAlertWatcher] Overlay notification failed, falling back to direct switch:', e);
                                if (!modelSwitchMode?.canFocusApp && nextAccount) {
                                    shouldSwitch = true;
                                }
                            }
                        } else {
                            if (!modelSwitchMode?.canFocusApp && nextAccount) {
                                shouldSwitch = true;
                            }
                        }

                        if (shouldSwitch && nextAccount) {
                            try {
                                console.log(`[QuotaAlertWatcher] Auto-switching target ${targetEnv || 'default'} from ${sourceAccount.email} to ${nextAccount.email} (${modelFamily} score: ${quotaScore}%)`);
                                lastAutoSwitchMap.set(sourceAccount.id, Date.now() + 15 * 60 * 1000);
                                lastAutoSwitchMap.set(nextAccount.id, Date.now() + 15 * 60 * 1000);
                                await switchAccount(nextAccount.id, targetEnv);
                                
                                // For IDE switch, do NOT show toast or desktop notification - keep it 100% silent and undisruptive
                                if (!isIdeSwitch) {
                                    showToast(switchMsg, 'success', 8000);
                                    if (!overlayEnabled) {
                                        sendDesktopNotification(switchTitle, switchMsg);
                                    }
                                } else {
                                    console.log(`[QuotaAlertWatcher] IDE switch completed silently for ${nextAccount.email}`);
                                }
                                await fetchAccounts();
                            } catch (err) {
                                console.error('[QuotaAlertWatcher] Auto-switch failed:', err);
                            }
                        }
                    } finally {
                        isAutoSwitchingRef.current = false;
                    }
                };

                // ── Strategy A: Claude is depleted, but Gemini on this account is healthy (> 15%) ────────
                // Zero-restart: Offer to focus app and continue with Gemini without restarting the app!
                if (claudeDepleted && !geminiDepleted && currentScores.geminiScore > 15) {
                    const claudeStandby = getRecommendedBestAccount(accounts, targetAccount.id, {
                        category: 'claude',
                        excludedAccountIds: otherActiveSlots,
                        minQuotaThreshold: 15,
                    });

                    const hasClaudeStandby = Boolean(claudeStandby.account && claudeStandby.claudeScore > 15);
                    const nextAccount = hasClaudeStandby ? claudeStandby.account : null;
                    const candidateScore = hasClaudeStandby ? claudeStandby.claudeScore : 0;

                    const switchTitle = t('notifications.model_switch_title', {
                        defaultValue: 'Antigravity Shield - Claude Quota Depleted',
                    });
                    const switchMsg = t('notifications.model_switch_msg', {
                        defaultValue: `Claude quota depleted. Gemini is ready (${currentScores.geminiScore}%). Switch model in chat to continue.`,
                        score: currentScores.geminiScore,
                    });

                    (async () => {
                        await triggerGracefulAutoSwitch(
                            targetAccount,
                            nextAccount,
                            'Claude',
                            candidateScore,
                            switchTitle,
                            switchMsg,
                            { canFocusApp: true, geminiScore: currentScores.geminiScore }
                        );
                    })();
                    break;
                }

                // ── Strategy B: True Account Depletion or Gemini Depleted ─────────────────────────────
                // Determine primary depleted model dynamically:
                const sortedCritical = [...criticalModels].sort((a, b) => {
                    if (a.percentage !== b.percentage) {
                        return a.percentage - b.percentage;
                    }
                    return extractModelScore(b.name) - extractModelScore(a.name);
                });
                const mostCritical = sortedCritical[0];
                const isClaude = isClaudeModel(mostCritical.name, mostCritical.display_name);
                const primaryCategory: 'gemini' | 'claude' = isClaude ? 'claude' : 'gemini';
                const modelLabel = getModelDisplayName(mostCritical) || mostCritical.display_name || mostCritical.name;

                // Step 1: Find best standby account for the primary category
                let targetCandidate = getRecommendedBestAccount(accounts, targetAccount.id, {
                    category: primaryCategory,
                    excludedAccountIds: otherActiveSlots,
                    minQuotaThreshold: 15,
                });
                let candidateScore = primaryCategory === 'gemini' ? targetCandidate.geminiScore : targetCandidate.claudeScore;

                // Step 2: Only fallback to alternative category if BOTH categories on the CURRENT account are truly exhausted
                if ((!targetCandidate.account || candidateScore <= DEPLETED_THRESHOLD) && currentScores.geminiScore <= DEPLETED_THRESHOLD) {
                    const fallbackCategory = primaryCategory === 'gemini' ? 'claude' : 'gemini';
                    const fallbackCandidate = getRecommendedBestAccount(accounts, targetAccount.id, {
                        category: fallbackCategory,
                        excludedAccountIds: otherActiveSlots,
                        minQuotaThreshold: 15,
                    });
                    const fallbackScore = fallbackCategory === 'gemini' ? fallbackCandidate.geminiScore : fallbackCandidate.claudeScore;
                    if (fallbackCandidate.account && fallbackScore > DEPLETED_THRESHOLD) {
                        targetCandidate = fallbackCandidate;
                        candidateScore = fallbackScore;
                    }
                }

                if (targetCandidate.account && candidateScore > DEPLETED_THRESHOLD) {
                    const nextAccount = targetCandidate.account;
                    const switchTitle = t('notifications.auto_switch_title', {
                        defaultValue: 'Antigravity Shield - Auto Switched',
                    });
                    const switchMsg = t('notifications.auto_switch_success', {
                        defaultValue: `⚡ Auto-Switched: ${targetPrefix}${modelLabel} reached ${mostCritical.percentage}%. Switched to ${nextAccount.email} (${candidateScore}% quota).`,
                        target: targetPrefix,
                        model: modelLabel,
                        from: targetAccount.email,
                        to: nextAccount.email,
                        percent: mostCritical.percentage,
                        score: candidateScore,
                    });

                    (async () => {
                        await triggerGracefulAutoSwitch(
                            targetAccount,
                            nextAccount,
                            modelLabel,
                            candidateScore,
                            switchTitle,
                            switchMsg
                        );
                    })();
                    break;
                } else {
                    // All quotas depleted across all accounts (throttled to 1 alert per 15 minutes)
                    if (now - lastGlobalExhaustedAlert > GLOBAL_EXHAUSTED_COOLDOWN_MS) {
                        lastGlobalExhaustedAlert = now;
                        const exhaustedTitle = t('notifications.quota_exhausted_title', {
                            defaultValue: 'Antigravity Shield - Quota Depleted',
                        });
                        const exhaustedMsg = t('notifications.all_quotas_depleted', {
                            defaultValue: '⚠️ Quotas exhausted across all available accounts.',
                        });
                        showToast(exhaustedMsg, 'error', 9000);
                        sendDesktopNotification(exhaustedTitle, exhaustedMsg);
                    }
                    break; // Prevent duplicate alerts across multiple target environments in the same tick
                }
            }
        }
    }, [accounts, currentAccount, activeTargetAccounts, config?.auto_switch_on_quota, config?.auto_switch_threshold_percentage, config?.overlay_notifications_enabled, config?.auto_switch_countdown_secs, t, switchAccount, fetchAccounts]);
}
