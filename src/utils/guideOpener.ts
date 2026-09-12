import { isTauri } from './env';

/**
 * Open the Antigravity Verification / Further Action Fix Guide PDF.
 * Works seamlessly in both Tauri desktop mode and standard Web browser mode.
 */
export async function openVerificationGuide() {
    const pdfRelativePath = 'guides/Antigravity_Verification_Guide.pdf';
    const webFallbackUrl = '/' + pdfRelativePath;

    if (isTauri()) {
        try {
            const { openUrl, openPath } = await import('@tauri-apps/plugin-opener');
            const { resolveResource } = await import('@tauri-apps/api/path');

            // Attempt to resolve the bundled asset path first
            try {
                const resourcePath = await resolveResource(pdfRelativePath);
                await openPath(resourcePath);
                return;
            } catch (pathErr) {
                console.warn('[guideOpener] Could not open via local file path, trying relative URL or window.open:', pathErr);
            }

            // Fallback to opening via local browser URL
            try {
                await openUrl(window.location.origin + '/' + pdfRelativePath);
                return;
            } catch (urlErr) {
                console.warn('[guideOpener] openUrl failed, falling back to window.open:', urlErr);
            }
        } catch (e) {
            console.error('[guideOpener] Tauri plugin-opener error:', e);
        }
    }

    // Web fallback
    window.open(webFallbackUrl, '_blank', 'noopener,noreferrer');
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
