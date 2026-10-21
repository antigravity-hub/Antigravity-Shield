/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React, { useEffect } from 'react';
import { PlugZap, Wrench, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToolkitStore } from '../../stores/useToolkitStore';

interface SidebarToolkitBadgeProps {
  collapsed?: boolean;
}

export const SidebarToolkitBadge: React.FC<SidebarToolkitBadgeProps> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  const { status, fetchStatus, openModal } = useToolkitStore();

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(() => {
      fetchStatus();
    }, 3500);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const isConnected = status.is_connected;
  const isInstalled = !!status.any_ide_installed;

  const getTitle = () => {
    if (isConnected) {
      return `Antigravity Toolkit: Connected\nIDE: ${status.active_ide || 'Antigravity IDE'}\nAccount: ${status.active_email || 'Synced'}\nClick to manage IDEs`;
    }
    if (isInstalled) {
      return 'Antigravity Toolkit: Detected in IDE (Waiting for Heartbeat)\nClick to inspect connection & auto-heal bridge';
    }
    return 'Antigravity Toolkit: Not Detected\nClick to inspect installed IDEs & install extension with 1-click';
  };

  if (collapsed) {
    return (
      <button
        onClick={openModal}
        title={getTitle()}
        className={`w-10 h-10 mx-auto flex items-center justify-center rounded-xl relative transition-all duration-200 cursor-pointer group ${
          isConnected
            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
            : isInstalled
            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs'
            : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
        }`}
      >
        {isConnected ? (
          <>
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <PlugZap className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </>
        ) : isInstalled ? (
          <>
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <PlugZap className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </>
        ) : (
          <Wrench className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:rotate-45 transition-transform" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={openModal}
      title={getTitle()}
      className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all duration-200 text-left cursor-pointer group select-none ${
        isConnected
          ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/30 shadow-xs'
          : isInstalled
          ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 shadow-xs'
          : 'bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative flex h-2.5 w-2.5 shrink-0">
          {isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </>
          ) : isInstalled ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400 dark:bg-slate-600"></span>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-bold truncate ${
                isConnected
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : isInstalled
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {t('nav.toolkit_brand_title', 'IDE Extension')}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                  : isInstalled
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
              }`}
            >
              {isConnected
                ? t('common.connected', 'Connected')
                : isInstalled
                ? t('common.waiting', 'Waiting')
                : t('common.offline', 'Offline')}
            </span>
          </div>

          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {isConnected
              ? `${status.active_ide || 'Antigravity IDE'}${status.active_email ? ` • ${status.active_email}` : ''}`
              : isInstalled
              ? t('nav.toolkit_waiting', 'Waiting for Heartbeat...')
              : t('nav.toolkit_install', 'Click to Connect IDE')}
          </span>
        </div>
      </div>

      <div className="shrink-0 ms-1 flex items-center">
        {isConnected ? (
          <PlugZap className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
        ) : isInstalled ? (
          <PlugZap className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        )}
      </div>
    </button>
  );
};
