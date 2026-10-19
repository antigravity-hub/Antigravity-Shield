import { isTauri } from './env';
import { request as invoke } from './request';

/**
 * Open the Antigravity Verification / Further Action Fix Guide in the high-fidelity in-app modal.
 * This prevents unexpected browser window redirects and eliminates tauri.localhost connection errors.
 */
export function openVerificationGuide() {
    window.dispatchEvent(new CustomEvent('open-verification-guide'));
}

/**
 * Open the QR Code scanning modal for instant phone camera verification.
 */
export function openVerificationQrModal(email: string, url: string) {
    window.dispatchEvent(new CustomEvent('open-verification-qr', { detail: { email, url } }));
}

/**
 * Open the guide directly using the operating system's native PDF reader (Adobe, Edge, etc.)
 * Extracts the bundled binary directly to the system temp directory without relying on tauri.localhost.
 */
export async function openVerificationGuideInSystem(): Promise<string> {
    const pdfRelativePath = 'guides/Antigravity_Verification_Guide.pdf';

    if (isTauri()) {
        try {
            const savedPath = await invoke<string>('open_verification_guide_doc');
            return savedPath;
        } catch (tauriErr) {
            console.warn('[guideOpener] invoke open_verification_guide_doc failed:', tauriErr);
        }
    }

    // Web fallback: open in browser tab or trigger direct download
    const fallbackUrl = '/' + pdfRelativePath;
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    return fallbackUrl;
}

/**
 * Download the verification guide PDF directly
 */
export function downloadVerificationGuide() {
    const link = document.createElement('a');
    link.href = '/guides/Antigravity_Verification_Guide.pdf';
    link.download = 'Antigravity_Verification_Guide.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Open external web URL safely in browser
 */
export async function openExternalUrl(url: string) {
    if (isTauri()) {
        try {
            const { openUrl } = await import('@tauri-apps/plugin-opener');
            await openUrl(url);
            return;
        } catch (e) {
            console.warn('[guideOpener] plugin-opener openUrl failed:', e);
        }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Clean and unescape a URL string (handling escaped unicode ampersands and quotes)
 */
export function cleanValidationUrl(url: string): string {
    let cleaned = url
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, '')
        .replace(/\\/g, '')
        .trim();
    if (cleaned.endsWith(',')) {
        cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
}

export const GOOGLE_DEFAULT_APPEAL_URL = 'https://forms.gle/hGzM9MEUv2azZsrb9';

/**
 * Filter to verify a URL is an actual user-facing action/appeal URL, and NOT an internal API endpoint.
 */
export function isValidUserActionUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;

    const lower = trimmed.toLowerCase();
    // Strictly reject internal Google Cloud Code backend endpoints
    if (
        lower.includes('googleapis.com/v1internal') ||
        lower.includes(':fetchavailablemodels') ||
        lower.includes(':retrieveuserquotasummary') ||
        lower.includes(':loadcodeassist') ||
        lower.includes(':generatecontent') ||
        lower.includes(':streamgeneratecontent')
    ) {
        return false;
    }
    return true;
}

/**
 * Check if an account error corresponds to a Google Terms of Service suspension / appeal requirement
 */
export function isAccountTosViolation(account: {
    validation_blocked_reason?: string;
    disabled_reason?: string;
    proxy_disabled_reason?: string;
    validation_url?: string;
    quota?: { forbidden_reason?: string; disabled_reason?: string; error_details?: string };
} | null | undefined): boolean {
    if (!account) return false;
    const combined = [
        account.validation_blocked_reason,
        account.disabled_reason,
        account.proxy_disabled_reason,
        account.validation_url,
        account.quota?.forbidden_reason,
        account.quota?.disabled_reason,
        (account.quota as any)?.error_details,
    ].filter(Boolean).join(' ').toLowerCase();

    return combined.includes('tos_violation') ||
        combined.includes('terms of service') ||
        combined.includes('appeal_url') ||
        combined.includes('forms.gle');
}

/**
 * Extract a direct Google verification / appeal URL from an account or its error payloads
 */
export function extractAccountValidationUrl(account: {
    validation_url?: string;
    validation_blocked_reason?: string;
    disabled_reason?: string;
    proxy_disabled_reason?: string;
    quota?: { forbidden_reason?: string; disabled_reason?: string; error_details?: string };
} | null | undefined): string | null {
    if (!account) return null;

    // 1. Direct validation_url on account
    if (account.validation_url && typeof account.validation_url === 'string') {
        const cleaned = cleanValidationUrl(account.validation_url);
        if (isValidUserActionUrl(cleaned)) {
            return cleaned;
        }
    }

    const raw = account.validation_blocked_reason || account.disabled_reason || account.quota?.forbidden_reason || account.proxy_disabled_reason || account.quota?.disabled_reason || (account.quota as any)?.error_details || '';
    if (!raw) {
        return isAccountTosViolation(account) ? GOOGLE_DEFAULT_APPEAL_URL : null;
    }

    const trimmed = raw.trim();

    // 2. High-priority direct match for Google appeal form URL (forms.gle)
    const formsMatch = trimmed.match(/https?:\/\/forms\.gle\/[^\s"'\],}]+/i);
    if (formsMatch) {
        const cleaned = cleanValidationUrl(formsMatch[0]);
        if (isValidUserActionUrl(cleaned)) {
            return cleaned;
        }
    }

    // 3. Embedded JSON substring extraction (handles "Network error: Quota API ... { ... }")
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonSub = trimmed.slice(firstBrace, lastBrace + 1);
        try {
            const parsed = JSON.parse(jsonSub);
            let meta = parsed?.error?.details?.[0]?.metadata;
            if (!meta && typeof parsed?.error === 'string') {
                try {
                    const inner = JSON.parse(parsed.error);
                    meta = inner?.error?.details?.[0]?.metadata;
                } catch (_) {}
            }
            const url = meta?.appeal_url || meta?.validation_url || parsed?.appeal_url || parsed?.validation_url;
            if (url && typeof url === 'string') {
                const cleaned = cleanValidationUrl(url);
                if (isValidUserActionUrl(cleaned)) {
                    return cleaned;
                }
            }
        } catch (_) {}
    }

    // 4. Safe URL search across all candidate links, strictly filtering out internal API endpoints
    const allUrls = trimmed.match(/https?:\/\/[^\s"'\],}]+/g) || [];
    for (const candidate of allUrls) {
        const cleaned = cleanValidationUrl(candidate);
        if (isValidUserActionUrl(cleaned)) {
            return cleaned;
        }
    }

    // 5. Fallback: If this is a TOS violation, provide Google's official appeal form
    if (isAccountTosViolation(account)) {
        return GOOGLE_DEFAULT_APPEAL_URL;
    }

    return null;
}
