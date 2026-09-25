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

/**
 * Extract a direct Google verification / appeal URL from an account or its error payloads
 */
export function extractAccountValidationUrl(account: {
    validation_url?: string;
    validation_blocked_reason?: string;
    disabled_reason?: string;
    proxy_disabled_reason?: string;
    quota?: { forbidden_reason?: string };
} | null | undefined): string | null {
    if (!account) return null;

    if (account.validation_url && typeof account.validation_url === 'string') {
        const cleaned = cleanValidationUrl(account.validation_url);
        if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
            return cleaned;
        }
    }

    const raw = account.validation_blocked_reason || account.disabled_reason || account.quota?.forbidden_reason || account.proxy_disabled_reason || '';
    if (!raw) return null;

    const trimmed = raw.trim();
    try {
        const parsed = JSON.parse(trimmed);
        let meta = parsed?.error?.details?.[0]?.metadata;
        if (!meta && typeof parsed?.error === 'string') {
            try {
                const inner = JSON.parse(parsed.error);
                meta = inner?.error?.details?.[0]?.metadata;
            } catch (_) {}
        }
        const url = meta?.validation_url || meta?.appeal_url || parsed?.validation_url || parsed?.appeal_url;
        if (url && typeof url === 'string') {
            const cleaned = cleanValidationUrl(url);
            if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
                return cleaned;
            }
        }
    } catch (_) {}

    // Fallback: regex search for http/https URLs in the raw error
    const match = trimmed.match(/https?:\/\/[^\s"']+/);
    if (match) {
        const cleaned = cleanValidationUrl(match[0]);
        if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
            return cleaned;
        }
    }

    return null;
}
