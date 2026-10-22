/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React, { useEffect, useState, useRef } from 'react';
import { X, Sparkles, Loader2, CheckCircle, RotateCcw, ExternalLink, ShieldAlert, Clock } from 'lucide-react';
import { request as invoke } from '../utils/request';
import { useTranslation } from 'react-i18next';
import { check as tauriCheck } from '@tauri-apps/plugin-updater';
import { relaunch as tauriRelaunch } from '@tauri-apps/plugin-process';
import { isTauri } from '../utils/env';
import { showToast } from './common/ToastContainer';
import { getUpdateSeverity, isGracePeriodActive, activateGracePeriod, UpdateSeverity } from '../utils/version';

interface UpdateInfo {
  has_update: boolean;
  latest_version: string;
  current_version: string;
  download_url: string;
  release_notes?: string;
  source?: string;
  has_signature?: boolean;
}

interface UpdateNotificationProps {
  onClose: () => void;
}

type UpdateState = 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'none' | 'manual';

// Helper to parse markdown inline tokens (**bold**, `code`, [link](url), *italic*) into React elements
const renderInlineTokens = (text: string): React.ReactNode => {
  if (!text) return text;
  const parts: React.ReactNode[] = [];
  const regex = /(\[.*?\]\(https?:\/\/[^\s)]+\)|\*\*.*?\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    const token = match[0];

    const linkMatch = token.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      parts.push(
        <a
          key={matchIndex}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {linkMatch[1]}
        </a>
      );
    } else if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      parts.push(
        <strong key={matchIndex} className="font-semibold text-gray-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      parts.push(
        <code
          key={matchIndex}
          className="px-1.5 py-0.5 mx-0.5 rounded font-mono text-[11px] bg-gray-200/70 dark:bg-slate-700/80 text-blue-600 dark:text-blue-300 border border-gray-300/40 dark:border-slate-600/40"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      parts.push(
        <em key={matchIndex} className="italic text-gray-700 dark:text-gray-300">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Custom parser to cleanly render changelog headers, lists, and quotes
const renderChangelogMarkdown = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const clean = trimmed.replace(/^[*\-+]\s+/, '').trim();

    // 1. H1 / H2 headers (# or ##)
    if (clean.startsWith('## ') || clean.startsWith('# ')) {
      const title = clean.replace(/^#{1,2}\s+/, '');
      elements.push(
        <div key={idx} className="pt-2.5 pb-0.5 first:pt-0">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5 pb-1 border-b border-gray-200/70 dark:border-slate-700/60">
            {renderInlineTokens(title)}
          </div>
        </div>
      );
      return;
    }

    // 2. H3 headers (###)
    if (clean.startsWith('### ')) {
      const title = clean.replace(/^###\s+/, '');
      elements.push(
        <div key={idx} className="pt-2 pb-0.5 first:pt-0">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            {renderInlineTokens(title)}
          </div>
        </div>
      );
      return;
    }

    // 3. H4 headers (####)
    if (clean.startsWith('#### ')) {
      const title = clean.replace(/^####\s+/, '');
      elements.push(
        <div key={idx} className="pt-1.5 pb-0.5">
          <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
            {renderInlineTokens(title)}
          </div>
        </div>
      );
      return;
    }

    // 4. Blockquotes (> ...)
    if (clean.startsWith('>')) {
      const quoteText = clean.replace(/^>\s*/, '');
      elements.push(
        <div key={idx} className="pl-2.5 my-1 border-l-2 border-blue-500/50 text-xs italic text-gray-600 dark:text-gray-400">
          {renderInlineTokens(quoteText)}
        </div>
      );
      return;
    }

    // 5. Standard bullet points / content lines
    elements.push(
      <div key={idx} className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
        <div className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 flex-1">
          {renderInlineTokens(clean)}
        </div>
      </div>
    );
  });

  return elements;
};

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [severity, setSeverity] = useState<UpdateSeverity>('none');
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>('checking');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const nativeUpdateRef = useRef<any>(null);
  const [dynamicNotes, setDynamicNotes] = useState<string>('');
  const [isLoadingNotes, setIsLoadingNotes] = useState<boolean>(false);

  useEffect(() => {
    checkUpdates();
  }, []);

  // Dynamically evaluate and resolve release notes for target version from GitHub or CHANGELOG.md
  useEffect(() => {
    const raw = (nativeUpdateRef.current?.body || updateInfo?.release_notes || '').trim();
    if (raw.length > 0 && !raw.includes('Release notes available on GitHub')) {
      setDynamicNotes(raw);
      return;
    }

    if (!updateInfo?.latest_version) return;

    let isMounted = true;
    setIsLoadingNotes(true);

    const resolveDynamicChangelog = async () => {
      try {
        const cleanVer = updateInfo.latest_version.replace(/^v/, '');

        // 1. Check GitHub Release API for this specific version tag
        try {
          const ghRes = await fetch(
            `https://api.github.com/repos/antigravity-hub/Antigravity-Shield/releases/tags/v${cleanVer}`
          );
          if (ghRes.ok) {
            const data = await ghRes.json();
            if (data.body && data.body.trim().length > 0) {
              if (isMounted) {
                setDynamicNotes(data.body.trim());
                setIsLoadingNotes(false);
                return;
              }
            }
          }
        } catch (_) {}

        // 2. Fallback: Parse section from upstream CHANGELOG.md (via CDN or raw GitHub)
        const changelogUrls = [
          'https://cdn.jsdelivr.net/gh/antigravity-hub/Antigravity-Shield@main/CHANGELOG.md',
          'https://raw.githubusercontent.com/antigravity-hub/Antigravity-Shield/main/CHANGELOG.md'
        ];

        for (const url of changelogUrls) {
          try {
            const cRes = await fetch(url);
            if (cRes.ok) {
              const text = await cRes.text();
              const lines = text.split('\n');
              let capturing = false;
              const collected: string[] = [];

              for (const line of lines) {
                const tr = line.trim();
                if ((tr.startsWith('*') || tr.startsWith('-')) && tr.includes('**v')) {
                  if (capturing) break;
                  if (tr.includes(`**v${cleanVer}`) || tr.includes(`**${cleanVer}`)) {
                    capturing = true;
                    continue;
                  }
                }
                if (capturing && (tr.startsWith('-') || tr.startsWith('*'))) {
                  collected.push(tr);
                }
              }

              if (collected.length > 0 && isMounted) {
                setDynamicNotes(collected.join('\n'));
                setIsLoadingNotes(false);
                return;
              }
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn('[Updater] Could not evaluate dynamic changelog:', err);
      } finally {
        if (isMounted) setIsLoadingNotes(false);
      }
    };

    resolveDynamicChangelog();
    return () => {
      isMounted = false;
    };
  }, [updateInfo?.latest_version, updateInfo?.release_notes]);

  const checkUpdates = async () => {
    try {
      // 1. Check for updates via backend
      const info = await invoke<UpdateInfo>('check_for_updates');
      if (!info.has_update) {
        onClose();
        return;
      }

      setUpdateInfo(info);

      // Determine severity (major/mandatory vs minor/dismissible)
      const detectedSeverity = getUpdateSeverity(info.current_version, info.latest_version);
      setSeverity(detectedSeverity);

      // If mandatory update has an active emergency grace period, do not block now
      if (detectedSeverity === 'major' && isGracePeriodActive(info.latest_version)) {
        onClose();
        return;
      }

      // 2. If not in Tauri — no auto-update possible
      if (!isTauri()) {
        console.warn('Auto update is only available in Tauri environment');
        onClose();
        return;
      }

      // Check if Linux and not AppImage (e.g. RPM or DEB packages).
      if (navigator.userAgent.toLowerCase().includes('linux')) {
        const isAppImage = await invoke<boolean>('check_appimage_installation');
        if (!isAppImage) {
          setUpdateState('manual');
          setTimeout(() => setIsVisible(true), 100);
          return;
        }
      }

      // 3. Check native updater bundle
      try {
        const update = await tauriCheck();
        if (!update) {
          // updater.json not ready or manual download needed
          console.warn('Native updater returned null, prompting manual release download');
          setUpdateState('manual');
          setTimeout(() => setIsVisible(true), 100);
          return;
        }

        nativeUpdateRef.current = update;
        setUpdateState('available');
        setTimeout(() => setIsVisible(true), 100);
      } catch (checkErr) {
        console.warn('Native updater check failed, falling back to manual release mode:', checkErr);
        setUpdateState('manual');
        setTimeout(() => setIsVisible(true), 100);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Update check failed:', errorMsg);
      onClose();
    }
  };

  const handleGracePeriod = () => {
    if (updateInfo) {
      activateGracePeriod(updateInfo.latest_version, 30);
      showToast(t('update_notification.grace_period_activated', '30-minute grace period active. Please update your system soon.'), 'info');
      handleClose();
    }
  };

  const handleDirectInstall = async () => {
    if (!updateInfo) return;
    try {
      setUpdateState('downloading');
      setDownloadProgress(0);
      if (updateInfo.has_signature === false) {
        showToast(t('update_notification.toast.downloading', 'Downloading update package...'), 'info');
      } else {
        showToast(t('update_notification.toast.switching_direct', 'Cryptographic verification unavailable. Initiating direct auto-install...'), 'info');
      }

      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{ percent: number }>('updater://direct-progress', (event) => {
        setDownloadProgress(event.payload.percent);
        if (event.payload.percent === 100) {
          showToast(t('update_notification.toast.launching_installer', 'Download complete. Launching installer...'), 'info');
        }
      });

      await invoke('download_and_install_direct', {
        downloadUrl: updateInfo.download_url,
        version: updateInfo.latest_version
      });
      unlisten();
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      console.error('Direct install failed:', errStr);
      setUpdateState('manual');
      showToast(t('update_notification.toast.signature_invalid', 'Automated verification unavailable. Switching to manual download.'), 'warning');
    }
  };

  const handleStartDownload = async () => {
    // If native updater is unavailable OR the release lacks a cryptographic signature,
    // immediately use our resilient direct auto-installer pipeline.
    // This prevents downloading 26MB via native updater only to fail signature check and re-download from scratch.
    if (!nativeUpdateRef.current || !updateInfo?.has_signature) {
      await handleDirectInstall();
      return;
    }

    try {
      setUpdateState('downloading');
      setDownloadProgress(0);

      let downloaded = 0;
      let contentLength = 0;

      await nativeUpdateRef.current.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            break;
        }
      });

      // Download complete — show restart prompt
      setUpdateState('ready');
      setDownloadProgress(100);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Update download failed:', errorMsg);
      if (errorMsg.toLowerCase().includes('minisign') || errorMsg.toLowerCase().includes('signature')) {
        console.warn('Signature verification failed, triggering resilient direct installer fallback...');
        await handleDirectInstall();
      } else {
        setUpdateState('error');
        showToast(`${t('update_notification.toast.failed')}: ${errorMsg}`, 'error');
      }
    }
  };

  const handleRestart = async () => {
    try {
      await tauriRelaunch();
    } catch (error) {
      console.error('Relaunch failed:', error);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(onClose, 400);
  };

  if (updateState === 'none') {
    return null;
  }

  const isMandatory = severity === 'major';
  const rawNotes = (dynamicNotes || nativeUpdateRef.current?.body || updateInfo?.release_notes || '').trim();
  const hasRealNotes = rawNotes.length > 0 && !rawNotes.includes('Release notes available on GitHub');

  // --- 1. MANDATORY / MAJOR UPDATE MODAL (Centered, Blocking, No Dismiss) ---
  if (isMandatory) {
    return (
      <div
        className={`
          fixed inset-0 z-[200] flex items-center justify-center p-4
          bg-black/75 backdrop-blur-md
          transition-all duration-300 ease-out
          ${isVisible && !isClosing ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div
          className={`
            relative overflow-hidden
            w-full max-w-md p-6
            rounded-2xl
            border border-red-500/30 dark:border-red-500/20
            shadow-[0_20px_60px_-15px_rgba(239,68,68,0.2)]
            bg-white dark:bg-slate-900
            transition-all duration-300 ease-out
            ${isVisible && !isClosing ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Header with pulsing alert badge */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className="relative flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-red-500/20 border border-red-500/30 text-red-500 dark:text-red-400 shadow-md">
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 mb-1">
                  {t('update_notification.mandatory_badge', 'MANDATORY UPDATE')}
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  {t('update_notification.mandatory_title', 'Critical Update Required')}
                </h2>
              </div>
            </div>

            {/* Version Transition Chip */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/60 mb-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{t('settings.about.version', 'Version')}:</span>
                <span className="font-mono font-medium px-2 py-0.5 rounded bg-gray-200/70 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
                  v{updateInfo?.current_version}
                </span>
                <span className="text-gray-400">➔</span>
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  v{updateInfo?.latest_version}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                {t('update_notification.required', "Required")}
              </span>
            </div>

            {/* Description & Release Reason */}
            <div className="mb-5">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('update_notification.reason_title', 'Update Highlights & Changelog:')}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-gray-50/90 dark:bg-slate-800/70 border border-gray-200/70 dark:border-slate-700/60 max-h-48 overflow-y-auto text-xs text-gray-700 dark:text-gray-200 leading-relaxed font-sans select-text scrollbar-thin">
                {hasRealNotes ? (
                  <div className="space-y-1.5">
                    {renderChangelogMarkdown(rawNotes)}
                  </div>
                ) : isLoadingNotes ? (
                  <div className="flex items-center gap-2 py-4 justify-center text-xs text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>{t('update_notification.evaluating_changelog_for_v', "Evaluating changelog for v")}{updateInfo?.latest_version}...</span>
                  </div>
                ) : (
                  <div className="py-2 text-xs text-gray-600 dark:text-gray-300">
                    <p className="mb-2">{t('update_notification.version_v', "Version v")}{updateInfo?.latest_version} {t('update_notification.contains_critical_architecture', "contains critical architecture and protocol upgrades.")}</p>
                    <a
                      href={`https://github.com/antigravity-hub/Antigravity-Shield/releases/tag/v${updateInfo?.latest_version}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      <span>{t('update_notification.view_full_release_notes_on_git', "View full release notes on GitHub")}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Downloading State */}
            {updateState === 'downloading' && (
              <div className="mb-5 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {t('update_notification.downloading', 'Downloading update in background...')}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {downloadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Ready State */}
            {updateState === 'ready' && (
              <div className="flex flex-col gap-3 mb-2">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-sm">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{t('update_notification.restart_prompt', 'Update downloaded and ready to install. Restart now?')}</span>
                </div>
                <button
                  onClick={handleRestart}
                  className="
                    w-full py-3 px-4 rounded-xl
                    bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500
                    text-white font-semibold text-sm
                    shadow-lg shadow-emerald-500/25
                    transition-all duration-200
                    flex items-center justify-center gap-2
                    active:scale-[0.98]
                  "
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t('update_notification.btn_restart', 'Restart & Install Now')}</span>
                </button>
              </div>
            )}

            {/* Available State */}
            {updateState === 'available' && (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleStartDownload}
                  className="
                    group/btn relative overflow-hidden
                    w-full py-3 px-4 rounded-xl
                    bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                    text-white font-semibold text-sm
                    shadow-lg shadow-blue-500/25
                    transition-all duration-200
                    flex items-center justify-center gap-2
                    active:scale-[0.98]
                  "
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{t('update_notification.btn_update', 'Update & Install Now')}</span>
                  <div className="absolute inset-0 -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-20 pointer-events-none" />
                </button>

                {/* Emergency Grace Period Button */}
                <button
                  onClick={handleGracePeriod}
                  className="
                    w-full py-2.5 px-3 rounded-xl
                    border border-gray-200 dark:border-slate-700
                    text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200
                    hover:bg-gray-100 dark:hover:bg-slate-800
                    transition-all duration-150
                    text-xs font-medium flex items-center justify-center gap-2
                  "
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('update_notification.btn_grace_period', 'Emergency: 30-Min Grace Period (Finish Task)')}</span>
                </button>

                {/* Fallback Direct Release Download Link */}
                {updateInfo?.download_url && (
                  <button
                    onClick={async () => {
                      try {
                        const { openUrl } = await import('@tauri-apps/plugin-opener');
                        await openUrl(updateInfo.download_url);
                      } catch {
                        window.open(updateInfo.download_url, '_blank');
                      }
                    }}
                    className="
                      w-full py-1.5 px-2 text-center
                      text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
                      transition-colors duration-150
                      text-xs flex items-center justify-center gap-1
                    "
                  >
                    <span>{t('settings.about.download_manual', 'Manual Download / Release Page')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Manual State */}
            {updateState === 'manual' && (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleDirectInstall}
                  className="
                    w-full py-3 px-4 rounded-xl
                    bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                    text-white font-semibold text-sm
                    shadow-lg shadow-blue-500/25
                    transition-all duration-200
                    flex items-center justify-center gap-2
                    active:scale-[0.98]
                  "
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{t('update_notification.btn_direct_install', 'Direct Auto-Install (Automatic)')}</span>
                </button>
                <button
                  onClick={async () => {
                    if (updateInfo) {
                      try {
                        const { openUrl } = await import('@tauri-apps/plugin-opener');
                        await openUrl(updateInfo.download_url);
                      } catch {
                        window.open(updateInfo.download_url, '_blank');
                      }
                    }
                  }}
                  className="
                    w-full py-2.5 px-3 rounded-xl
                    border border-gray-200 dark:border-slate-700
                    text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200
                    hover:bg-gray-100 dark:hover:bg-slate-800
                    transition-all duration-150
                    text-xs font-medium flex items-center justify-center gap-2
                  "
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('update_notification.btn_manual_browser', 'Open Release Page in Browser')}</span>
                </button>
                <button
                  onClick={handleGracePeriod}
                  className="
                    w-full py-2 px-3 rounded-xl
                    text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                    text-xs font-medium flex items-center justify-center gap-2
                  "
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('update_notification.btn_grace_period', 'Emergency: 30-Min Grace Period')}</span>
                </button>
              </div>
            )}

            {/* Error State */}
            {updateState === 'error' && (
              <div className="flex flex-col gap-2.5">
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs">
                  {t('update_notification.toast.failed', 'Auto-update failed')}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setUpdateState('checking');
                      setDownloadProgress(0);
                      checkUpdates();
                    }}
                    className="
                      flex-1 py-2.5 px-3 rounded-xl
                      bg-blue-600 hover:bg-blue-500 text-white
                      font-medium text-xs
                      flex items-center justify-center gap-1.5
                      transition-all duration-150
                    "
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('common.retry', 'Retry')}</span>
                  </button>
                  {updateInfo?.download_url && (
                    <button
                      onClick={async () => {
                        try {
                          const { openUrl } = await import('@tauri-apps/plugin-opener');
                          await openUrl(updateInfo.download_url);
                        } catch {
                          window.open(updateInfo.download_url, '_blank');
                        }
                      }}
                      className="
                        flex-1 py-2.5 px-3 rounded-xl
                        bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700
                        text-gray-700 dark:text-gray-300 font-medium text-xs
                        flex items-center justify-center gap-1.5
                        transition-all duration-150
                      "
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{t('settings.about.download_manual', 'Direct Link')}</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={handleGracePeriod}
                  className="
                    w-full py-2 px-3 rounded-xl
                    border border-gray-200 dark:border-slate-700
                    text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                    text-xs font-medium flex items-center justify-center gap-1.5
                  "
                >
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>{t('update_notification.btn_grace_period', 'Emergency: 30-Min Grace Period')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- 2. ROUTINE / MINOR UPDATE FLOATING TOAST (Dismissible for current session) ---
  return (
    <div
      className={`
        fixed top-6 right-6 z-[100]
        transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${isVisible && !isClosing ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95'}
      `}
    >
      <div className="
        relative overflow-hidden
        w-80 p-5
        rounded-2xl
        border border-white/20 dark:border-white/10
        shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]
        backdrop-blur-xl
        bg-white/70 dark:bg-slate-900/60
        group
      ">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/30 transition-colors duration-500" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/30 transition-colors duration-500" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                {updateState === 'ready' ? (
                  <CheckCircle className="w-4 h-4 text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-white" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white leading-tight">
                  {updateState === 'ready'
                    ? t('update_notification.ready')
                    : updateState === 'available'
                    ? t('update_notification.title_available', 'Update Available')
                    : t('update_notification.title')}
                </h3>
                {updateInfo && (
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    v{updateInfo.latest_version}
                  </p>
                )}
              </div>
            </div>

            {(updateState === 'available' || updateState === 'error' || updateState === 'ready' || updateState === 'manual') && (
              <button
                onClick={handleClose}
                className="
                  p-1 rounded-full 
                  text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
                  hover:bg-black/5 dark:hover:bg-white/10
                  transition-all duration-200
                "
                aria-label={t('common.cancel')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status message */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
              {updateState === 'available' && t('update_notification.available_desc', {
                version: updateInfo?.latest_version,
                defaultValue: `A new version (v${updateInfo?.latest_version}) is available. Would you like to update now?`
              })}
              {updateState === 'downloading' && t('update_notification.downloading')}
              {updateState === 'ready' && t('update_notification.restart_prompt')}
              {updateState === 'error' && t('update_notification.toast.failed')}
              {updateState === 'manual' && t('settings.about.new_version_available', {
                version: updateInfo?.latest_version || '',
                defaultValue: 'A new version is available. Please click below to download the update.'
              })}
            </p>

            {updateState === 'available' && hasRealNotes && (
              <div className="p-2.5 rounded-xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-700/60 text-xs text-gray-700 dark:text-gray-300 max-h-36 overflow-y-auto space-y-1.5 leading-relaxed select-text scrollbar-thin">
                {renderChangelogMarkdown(rawNotes)}
              </div>
            )}
          </div>

          {/* Action buttons when update is available */}
          {updateState === 'available' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={handleStartDownload}
                  className="
                    flex-1 group/btn
                    relative overflow-hidden
                    bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                    text-white font-medium
                    py-2.5 px-4 rounded-xl
                    shadow-lg shadow-blue-500/25
                    transition-all duration-300
                    flex items-center justify-center gap-2
                    active:scale-[0.98]
                  "
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{t('update_notification.btn_update', 'Update Now')}</span>
                  <div className="absolute inset-0 -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-20 pointer-events-none" />
                </button>
                <button
                  onClick={handleClose}
                  className="
                    px-3 py-2.5 rounded-xl
                    text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                    hover:bg-black/5 dark:hover:bg-white/10
                    transition-all duration-200
                    text-sm font-medium
                  "
                >
                  {t('update_notification.btn_later', 'Later')}
                </button>
              </div>

              {updateInfo?.download_url && (
                <button
                  onClick={async () => {
                    try {
                      const { openUrl } = await import('@tauri-apps/plugin-opener');
                      await openUrl(updateInfo.download_url);
                    } catch (e) {
                      window.open(updateInfo.download_url, '_blank');
                    }
                  }}
                  className="
                    w-full py-1.5 px-3 rounded-xl
                    text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                    hover:bg-black/5 dark:hover:bg-white/10
                    transition-all duration-200
                    text-xs font-medium flex items-center justify-center gap-1.5
                  "
                >
                  <span>{t('settings.about.download_manual', 'Manual Download / Release')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Progress bar during download */}
          {updateState === 'downloading' && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">{downloadProgress}%</p>
                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
              </div>
            </div>
          )}

          {/* Restart button when ready */}
          {updateState === 'ready' && (
            <div className="flex gap-2">
              <button
                onClick={handleRestart}
                className="
                  flex-1 group/btn
                  relative overflow-hidden
                  bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500
                  text-white font-medium
                  py-2.5 px-4 rounded-xl
                  shadow-lg shadow-green-500/25
                  transition-all duration-300
                  flex items-center justify-center gap-2
                  active:scale-[0.98]
                "
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('update_notification.btn_restart')}</span>
                <div className="absolute inset-0 -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-20 pointer-events-none" />
              </button>
              <button
                onClick={handleClose}
                className="
                  px-3 py-2.5 rounded-xl
                  text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                  hover:bg-black/5 dark:hover:bg-white/10
                  transition-all duration-200
                  text-sm font-medium
                "
              >
                {t('update_notification.btn_later')}
              </button>
            </div>
          )}

          {/* Manual download button */}
          {updateState === 'manual' && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (updateInfo) {
                    try {
                      const { openUrl } = await import('@tauri-apps/plugin-opener');
                      await openUrl(updateInfo.download_url);
                    } catch (e) {
                      window.open(updateInfo.download_url, '_blank');
                    }
                  }
                }}
                className="
                  flex-1 group/btn
                  relative overflow-hidden
                  bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                  text-white font-medium
                  py-2.5 px-4 rounded-xl
                  shadow-lg shadow-blue-500/25
                  transition-all duration-300
                  flex items-center justify-center gap-2
                  active:scale-[0.98]
                "
              >
                <span>{t('settings.about.download_page', 'Download Page')}</span>
              </button>
              <button
                onClick={handleClose}
                className="
                  px-3 py-2.5 rounded-xl
                  text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                  hover:bg-black/5 dark:hover:bg-white/10
                  transition-all duration-200
                  text-sm font-medium
                "
              >
                {t('update_notification.btn_later')}
              </button>
            </div>
          )}

          {/* Error state — retry button and manual download option */}
          {updateState === 'error' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setUpdateState('checking');
                    setDownloadProgress(0);
                    checkUpdates();
                  }}
                  className="
                    flex-1
                    bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                    text-white font-medium
                    py-2 px-3 rounded-xl
                    shadow-lg shadow-blue-500/25
                    transition-all duration-300
                    flex items-center justify-center gap-2
                    active:scale-[0.98] text-sm
                  "
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t('common.retry')}</span>
                </button>
                <button
                  onClick={handleClose}
                  className="
                    px-3 py-2 rounded-xl
                    text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                    hover:bg-black/5 dark:hover:bg-white/10
                    transition-all duration-200
                    text-sm font-medium
                  "
                >
                  {t('update_notification.btn_later')}
                </button>
              </div>

              {updateInfo?.download_url && (
                <button
                  onClick={async () => {
                    try {
                      const { openUrl } = await import('@tauri-apps/plugin-opener');
                      await openUrl(updateInfo.download_url);
                    } catch (e) {
                      window.open(updateInfo.download_url, '_blank');
                    }
                  }}
                  className="
                    w-full py-2 px-3 rounded-xl
                    bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
                    text-gray-700 dark:text-gray-300
                    transition-all duration-200
                    text-xs font-medium flex items-center justify-center gap-1.5
                  "
                >
                  <span>{t('settings.about.download_manual', 'Manual Download / Release')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
