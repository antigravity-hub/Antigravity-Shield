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
