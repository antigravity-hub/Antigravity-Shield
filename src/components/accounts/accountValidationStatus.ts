/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import type { TFunction } from 'i18next';

const TOS_HINTS = [
    'tos_violation',
    'terms of service',
    'appeal_url',
    'forms.gle',
    'policy violation',
    'disabled in this account',
];

const RATE_LIMIT_HINTS = [
    'resource_exhausted',
    'too many requests',
    '429',
    'rate limit',
    'rate-limited',
    'risk control',
    'risk-controlled',
    '风控',
    '冻结',
    'frozen',
];

const OAUTH_HINTS = [
    'unauthorized_client',
    'invalid_client',
    'invalid_grant',
    'oauth client',
    'not authorized',
];

function includesAny(text: string, hints: string[]): boolean {
    return hints.some((hint) => text.includes(hint));
}

export function isValidationBlockedTos(reason: string | undefined): boolean {
    const normalizedReason = (reason || '').toLowerCase();
    return includesAny(normalizedReason, TOS_HINTS);
}

export function getValidationBlockedStatusLabel(
    reason: string | undefined,
    t: TFunction,
): string {
    const normalizedReason = (reason || '').toLowerCase();

    if (includesAny(normalizedReason, TOS_HINTS)) {
        return t('accounts.status.tos_appeal_required', { defaultValue: 'Approval Required' });
    }

    if (includesAny(normalizedReason, RATE_LIMIT_HINTS)) {
        return t('accounts.status.risk_controlled', { defaultValue: 'Risk / Rate Limited' });
    }

    if (includesAny(normalizedReason, OAUTH_HINTS)) {
        return t('accounts.status.oauth_reauth_required', { defaultValue: 'OAuth Re-auth Required' });
    }

    return t('accounts.status.validation_required', { defaultValue: 'Verification Required' });
}