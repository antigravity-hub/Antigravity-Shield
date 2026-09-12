import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Check, Sparkles, AlertCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { request as invoke } from '../../utils/request';
import { showToast } from '../common/ToastContainer';
import { useAppVersion } from '../../constants/version';

type CheckStatus = 'idle' | 'checking' | 'up-to-date' | 'has-update' | 'cooldown' | 'error';

interface UpdateInfoResponse {
  has_update: boolean;
  latest_version: string;
  current_version: string;
  download_url?: string;
  source?: string;
}

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = 'antigravity_last_manual_update_check';

export const NavVersionBadge: React.FC = () => {
  const { t } = useTranslation();
  const currentVersion = useAppVersion();

  const [status, setStatus] = useState<CheckStatus>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Check cooldown expiry on mount / tick
  useEffect(() => {
    const updateCooldown = () => {
      const lastCheckStr = localStorage.getItem(STORAGE_KEY);
      if (!lastCheckStr) {
        setCooldownRemaining(0);
        return;
      }
      const lastCheck = parseInt(lastCheckStr, 10);
      if (isNaN(lastCheck)) {
        setCooldownRemaining(0);
        return;
      }
      const elapsed = Math.floor((Date.now() - lastCheck) / 1000);
      const remaining = COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        setCooldownRemaining(remaining);
      } else {
        setCooldownRemaining(0);
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckUpdate = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // If already checking, prevent duplicate clicks
      if (status === 'checking') return;

      // If already flagged that an update is ready, clicking again can re-open the update modal
      if (status === 'has-update') {
        window.dispatchEvent(new CustomEvent('open-update-notification'));
        return;
      }

      // 1. Verify 1-minute cooldown limit
      const lastCheckStr = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();
      if (lastCheckStr) {
        const lastCheck = parseInt(lastCheckStr, 10);
        if (!isNaN(lastCheck)) {
          const elapsedSeconds = Math.floor((now - lastCheck) / 1000);
          if (elapsedSeconds < COOLDOWN_SECONDS) {
            const remaining = COOLDOWN_SECONDS - elapsedSeconds;
            setCooldownRemaining(remaining);
            setStatus('cooldown');

            showToast(
              t('settings.about.check_cooldown', {
                seconds: remaining,
                defaultValue: `Please wait ${remaining}s before checking again.`,
              }),
              'info'
            );

            // Return to idle after a brief shake notice
            setTimeout(() => {
              setStatus('idle');
            }, 1800);
            return;
          }
        }
      }

      // 2. Cooldown passed: Set new timestamp and enter 'checking' state
      localStorage.setItem(STORAGE_KEY, now.toString());
      setCooldownRemaining(COOLDOWN_SECONDS);
      setStatus('checking');

      try {
        let result: UpdateInfoResponse | null = null;

        // Try backend invoke
        try {
          result = await invoke<UpdateInfoResponse>('check_for_updates');
        } catch (backendErr) {
          console.warn('[NavVersionBadge] Backend check_for_updates failed, using direct GitHub fallback...', backendErr);
          // Fallback to direct GitHub release API (e.g. for pure web mode)
          const resp = await fetch('https://api.github.com/repos/DoctorGuidance/Antigravity-Shield/releases/latest');
          if (resp.ok) {
            const release = await resp.json();
            const tag = (release.tag_name || '').replace(/^v/i, '');
            const cur = currentVersion.replace(/^v/i, '');
            const hasUpdate = Boolean(tag && tag !== cur);
            result = {
              has_update: hasUpdate,
              latest_version: tag || currentVersion,
              current_version: currentVersion,
              download_url: release.html_url,
              source: 'GitHub API',
            };
          } else {
            throw backendErr;
          }
        }

        if (result && result.has_update) {
          setLatestVersion(result.latest_version);
          setStatus('has-update');

          const sourceMsg = result.source && result.source !== 'GitHub API' ? ` (via ${result.source})` : '';
          showToast(
            t('settings.about.new_version_available', {
              version: result.latest_version,
              defaultValue: `New version v${result.latest_version} available!`,
            }) + sourceMsg,
            'info'
          );

          // Trigger full update modal
          window.dispatchEvent(new CustomEvent('open-update-notification'));
        } else {
          setStatus('up-to-date');
          showToast(
            t('settings.about.latest_version', {
              defaultValue: "You're up to date!",
            }),
            'success'
          );

          // Reset to idle after 3.5 seconds
          setTimeout(() => {
            setStatus('idle');
          }, 3500);
        }
      } catch (err: any) {
        console.error('[NavVersionBadge] Check update error:', err);
        setStatus('error');
        const errMsg = err?.message || String(err);
        showToast(
          `${t('settings.about.update_check_failed', { defaultValue: 'Update check failed' })}: ${errMsg}`,
          'error'
        );

        setTimeout(() => {
          setStatus('idle');
        }, 3500);
      }
    },
    [status, currentVersion, t]
  );

  // Compute tooltip text
  const getTooltip = () => {
    if (status === 'checking') {
      return t('settings.about.checking_update', { defaultValue: 'Checking for updates...' });
    }
    if (status === 'has-update' && latestVersion) {
      return t('settings.about.new_version_available', {
        version: latestVersion,
        defaultValue: `New version v${latestVersion} available! Click to update.`,
      });
    }
    if (status === 'up-to-date') {
      return t('settings.about.latest_version', { defaultValue: "You're up to date" });
    }
    if (status === 'cooldown' || cooldownRemaining > 0) {
      return t('settings.about.check_cooldown', {
        seconds: cooldownRemaining,
        defaultValue: `Please wait ${cooldownRemaining}s before checking again.`,
      });
    }
    return t('settings.about.check_update', { defaultValue: 'Click to check for updates' });
  };

  return (
    <motion.button
      type="button"
      onClick={handleCheckUpdate}
      title={getTooltip()}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      animate={
        status === 'cooldown'
          ? { x: [-3, 3, -3, 3, 0], transition: { duration: 0.35 } }
          : undefined
      }
      className={`relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all duration-300 select-none cursor-pointer outline-none border shadow-xs overflow-hidden ${
        status === 'checking'
          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
          : status === 'has-update'
          ? 'bg-amber-500/20 text-amber-300 border-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.45)]'
          : status === 'up-to-date'
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
          : status === 'error'
          ? 'bg-rose-500/15 text-rose-400 border-rose-400/80 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
          : status === 'cooldown'
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/50'
          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/60 hover:text-cyan-500 dark:hover:text-cyan-300 hover:border-cyan-500/50 hover:shadow-[0_0_10px_rgba(6,182,212,0.25)]'
      }`}
    >
      {/* Animated Light Shimmer during checking */}
      {status === 'checking' && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent -skew-x-12 pointer-events-none"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
        />
      )}

      {/* Dynamic Content Transitions */}
      <AnimatePresence mode="wait">
        {status === 'checking' ? (
          <motion.div
            key="checking"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-2.5 h-2.5 animate-spin text-cyan-400" />
            <span>Checking...</span>
          </motion.div>
        ) : status === 'has-update' ? (
          <motion.div
            key="has-update"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
            <span>v{latestVersion || currentVersion}</span>
          </motion.div>
        ) : status === 'up-to-date' ? (
          <motion.div
            key="up-to-date"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <Check className="w-2.5 h-2.5 text-emerald-400" />
            <span>v{currentVersion}</span>
          </motion.div>
        ) : status === 'cooldown' ? (
          <motion.div
            key="cooldown"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <Clock className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
            <span>{cooldownRemaining}s</span>
          </motion.div>
        ) : status === 'error' ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
            <span>v{currentVersion}</span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1"
          >
            {cooldownRemaining > 0 && (
              <span className="w-1 h-1 rounded-full bg-slate-400/50" />
            )}
            <span>v{currentVersion}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
