import React from 'react';
import {
  X,
  RefreshCw,
  Download,
  ExternalLink,
  PlugZap,
  HelpCircle,
} from 'lucide-react';
import { useToolkitStore, IdeInfo } from '../../stores/useToolkitStore';
import { showToast } from '../common/ToastContainer';

export const ToolkitIntegrationModal: React.FC = () => {
  const {
    status,
    ides,
    isLoadingIdes,
    installingIdes,
    isModalOpen,
    closeModal,
    fetchIdes,
    installToIde,
  } = useToolkitStore();

  if (!isModalOpen) return null;

  const handleInstall = async (ide: IdeInfo) => {
    const result = await installToIde(ide.id);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const getIdeIcon = (id: string) => {
    switch (id) {
      case 'antigravity':
        return '🚀';
      case 'vscode':
        return '💻';
      case 'cursor':
        return '⚡';
      case 'jetbrains':
        return '🧠';
      case 'zed':
        return '✏️';
      case 'xcode':
        return '🍎';
      default:
        return '📦';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <PlugZap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Antigravity Toolkit & IDE Hub
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1-Click live account switching, visual chat history, and IDE integration
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Connection Status Banner */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              status.is_connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  {status.is_connected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  )}
                </span>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {status.is_connected ? 'Toolkit Connected & Synced' : 'Toolkit Not Detected'}
                  </span>
                  <div className="text-xs opacity-90 mt-0.5">
                    {status.is_connected ? (
                      <>
                        Active in <strong className="font-semibold">{status.active_ide}</strong>
                        {status.active_email && ` • Account: ${status.active_email}`}
                      </>
                    ) : (
                      'Install the Antigravity Toolkit extension below to enable zero-restart account switching & visual transcripts inside your editor.'
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={fetchIdes}
                disabled={isLoadingIdes}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-black/30 hover:bg-white dark:hover:bg-black/50 border border-current/20 transition-all flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIdes ? 'animate-spin' : ''}`} />
                <span>Rescan IDEs</span>
              </button>
            </div>
          </div>

          {/* Installed IDEs List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Detected Development Environments
              </h3>
              <span className="text-xs text-slate-400">
                {ides.filter((i) => i.is_installed).length} installed on your machine
              </span>
            </div>

            <div className="grid gap-3">
              {ides.map((ide) => {
                const isInstalling = installingIdes[ide.id];

                return (
                  <div
                    key={ide.id}
                    className={`p-4 rounded-xl border transition-all ${
                      ide.is_installed
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                        : 'bg-slate-50/50 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800/80 opacity-70'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <span className="text-2xl select-none">{getIdeIcon(ide.id)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white">
                              {ide.name}
                            </span>
                            {ide.is_installed ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Installed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                Not Found
                              </span>
                            )}
                            {ide.toolkit_installed && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Toolkit Ready
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md">
                            {ide.executable_path ? ide.executable_path : ide.is_installed ? 'Detected in environment' : 'Not installed in standard locations'}
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {ide.supports_auto_install && ide.is_installed ? (
                          <button
                            onClick={() => handleInstall(ide)}
                            disabled={isInstalling}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-1.5 ${
                              ide.toolkit_installed
                                ? 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                            } ${isInstalling ? 'opacity-75 cursor-not-allowed' : ''}`}
                          >
                            <Download className={`w-3.5 h-3.5 ${isInstalling ? 'animate-bounce' : ''}`} />
                            <span>
                              {isInstalling
                                ? 'Installing...'
                                : ide.toolkit_installed
                                ? 'Reinstall Toolkit'
                                : '⚡ 1-Click Install'}
                            </span>
                          </button>
                        ) : ide.category === 'jetbrains' && ide.is_installed ? (
                          <a
                            href={ide.official_extension_url || 'https://plugins.jetbrains.com'}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all flex items-center gap-1.5"
                          >
                            <span>JetBrains Plugin</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : ide.official_extension_url ? (
                          <a
                            href={ide.official_extension_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1"
                          >
                            <span>Marketplace</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Official Google Extensions Note */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Multi-Editor Architecture (VS Code, JetBrains, Zed & Xcode):
              </span>
              <p className="mt-1 leading-relaxed">
                Antigravity Shield provides a unified local proxy gateway (<code>127.0.0.1:8765</code>) that supports all official Antigravity plugins. Read Google's official announcement for setup details across all coding editors.
              </p>
              <a
                href="https://antigravity.google/blog/antigravity-ide-extensions"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Read Google Antigravity IDE Extensions Blog</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500">
          <a
            href="https://github.com/antigravity-hub/antigravity-toolkit-extension"
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-500 transition-colors flex items-center gap-1"
          >
            <span>antigravity-hub/antigravity-toolkit-extension</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={closeModal}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
