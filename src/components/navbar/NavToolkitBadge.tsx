import React, { useEffect } from 'react';
import { PlugZap, Wrench } from 'lucide-react';
import { useToolkitStore } from '../../stores/useToolkitStore';

export const NavToolkitBadge: React.FC = () => {
  const { status, fetchStatus, openModal } = useToolkitStore();

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(() => {
      fetchStatus();
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const isConnected = status.is_connected;

  return (
    <button
      onClick={openModal}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 select-none ${
        isConnected
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
          : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-base-200 dark:hover:bg-base-100 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-base-300 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
      title={
        isConnected
          ? `Antigravity Toolkit: Connected\nActive IDE: ${status.active_ide || 'IDE'}\nAccount: ${status.active_email || 'Synced'}\nClick to manage IDEs`
          : 'Antigravity Toolkit: Disconnected\nClick to inspect installed IDEs & install extension with 1-click'
      }
    >
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <PlugZap className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold hidden sm:inline">Toolkit Active</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></span>
          <Wrench className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="font-medium hidden sm:inline">Install Toolkit</span>
        </>
      )}
    </button>
  );
};
