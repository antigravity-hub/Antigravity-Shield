import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import {
  X,
  RefreshCw,
  Download,
  ExternalLink,
  PlugZap,
  HelpCircle,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useToolkitStore, IdeInfo } from '../../stores/useToolkitStore';
import { showToast } from '../common/ToastContainer';

export const ToolkitIntegrationModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    status,
    ides,
    isLoadingIdes,
    installingIdes,
    isModalOpen,
    closeModal,
    fetchIdes,
    installToIde,
    fetchStatus,
  } = useToolkitStore();

  const [ideToConfirm, setIdeToConfirm] = React.useState<IdeInfo | null>(null);

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

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-white dark:bg-[#0b101b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800/90 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
              <PlugZap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {t('toolkit.modal.title', 'Antigravity Toolkit & IDE Hub')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t('toolkit.modal.subtitle', '1-Click live account switching, visual chat history & editor sync')}
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4">
          {/* Connection Status Banner */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              status.is_connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  {status.is_connected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  )}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider block">
                    {status.is_connected
                      ? t('toolkit.modal.connected_title', 'Toolkit Connected & Active')
                      : t('toolkit.modal.waiting_title', 'Toolkit Bridge Waiting')}
                  </span>
                  <div className="text-xs opacity-90 mt-0.5 truncate">
                    {status.is_connected ? (
                      <Trans
                        i18nKey="toolkit.modal.active_in"
                        defaults="Active in <1>{{ide}}</1>{{email}}"
                        values={{
                          ide: status.active_ide,
                          email: status.active_email ? ` • ${status.active_email}` : '',
                        }}
                        components={{
                          1: <strong className="font-semibold" />,
                        }}
                      />
                    ) : status.any_ide_installed ? (
                      t('toolkit.modal.installed_hint', 'Extension installed in your IDE! Launch IDE or switch window to start live telemetry.')
                    ) : (
                      t('toolkit.modal.not_installed_hint', 'Install the extension below for instant zero-restart account switching & live transcripts.')
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  fetchIdes();
                  fetchStatus();
                }}
                disabled={isLoadingIdes}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/80 dark:bg-black/30 hover:bg-white dark:hover:bg-black/50 border border-current/20 transition-all flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIdes ? 'animate-spin' : ''}`} />
                <span>{t('toolkit.modal.rescan', 'Rescan')}</span>
              </button>
            </div>
          </div>

          {/* IDE List Header */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('toolkit.modal.supported_ides', 'Supported Coding Environments')}
              </h3>
              <span className="text-xs text-slate-400">
                {t('toolkit.modal.installed_count', '{{count}} installed on your machine', {
                  count: ides.filter((i) => i.is_installed).length,
                })}
              </span>
            </div>

            {/* IDE Cards */}
            <div className="space-y-2.5">
              {ides.map((ide) => {
                const isInstalling = installingIdes[ide.id];
                const isAntigravity = ide.id === 'antigravity';

                return (
                  <div
                    key={ide.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isAntigravity
                        ? 'bg-gradient-to-r from-blue-500/[0.04] to-indigo-500/[0.04] dark:from-blue-500/10 dark:to-indigo-500/10 border-blue-500/30 dark:border-blue-500/30'
                        : ide.is_installed
                        ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xs'
                        : 'bg-slate-50/40 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800/70 opacity-65'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <span className="text-2xl select-none shrink-0">{getIdeIcon(ide.id)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {ide.name}
                            </span>
                            {isAntigravity && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 inline-flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                {t('toolkit.modal.official_ide', 'Official IDE')}
                              </span>
                            )}
                            {ide.is_installed ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {t('toolkit.modal.installed', 'Installed')}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {t('toolkit.modal.not_found', 'Not Found')}
                              </span>
                            )}
                            {ide.toolkit_installed && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                {isAntigravity
                                  ? t('toolkit.modal.auto_installed', 'Auto-Installed')
                                  : t('toolkit.modal.toolkit_ready', 'Toolkit Ready')}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full" title={ide.executable_path || undefined}>
                            {ide.executable_path
                              ? ide.executable_path
                              : isAntigravity && ide.is_installed
                              ? t('toolkit.modal.antigravity_path_desc', 'Google Antigravity IDE (Automated VSIX Sync)')
                              : ide.is_installed
                              ? t('toolkit.modal.detected', 'Detected in environment')
                              : t('toolkit.modal.not_installed', 'Not installed in standard locations')}
                          </div>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isAntigravity && ide.is_installed ? (
                          <button
                            onClick={() => setIdeToConfirm(ide)}
                            disabled={isInstalling}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-1.5 ${
                              ide.toolkit_installed
                                ? 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-200'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 shadow-blue-500/25'
                            } ${isInstalling ? 'opacity-75 cursor-not-allowed' : ''}`}
                          >
                            <Download className={`w-3.5 h-3.5 ${isInstalling ? 'animate-bounce' : ''}`} />
                            <span>
                              {isInstalling
                                ? t('toolkit.modal.auto_installing', 'Auto-Installing...')
                                : ide.toolkit_installed
                                ? t('toolkit.modal.reinstall', 'Reinstall')
                                : t('toolkit.modal.auto_install_btn', '⚡ Auto-Install Toolkit')}
                            </span>
                          </button>
                        ) : ide.id === 'vscode' && ide.is_installed ? (
                          <button
                            onClick={() => setIdeToConfirm(ide)}
                            disabled={isInstalling}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-1.5 ${
                              ide.toolkit_installed
                                ? 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-200'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                            } ${isInstalling ? 'opacity-75 cursor-not-allowed' : ''}`}
                          >
                            <Download className={`w-3.5 h-3.5 ${isInstalling ? 'animate-bounce' : ''}`} />
                            <span>
                              {isInstalling
                                ? t('toolkit.modal.installing', 'Installing...')
                                : ide.toolkit_installed
                                ? t('toolkit.modal.reinstall', 'Reinstall')
                                : t('toolkit.modal.one_click_install', '⚡ 1-Click Install')}
                            </span>
                          </button>
                        ) : ide.category === 'jetbrains' && ide.is_installed ? (
                          <a
                            href={ide.official_extension_url || 'https://plugins.jetbrains.com'}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all flex items-center gap-1.5"
                          >
                            <span>{t('toolkit.modal.jetbrains_plugin', 'JetBrains Plugin')}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : isAntigravity && !ide.is_installed ? (
                          <a
                            href="https://antigravity.google"
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 transition-all flex items-center gap-1.5"
                          >
                            <span>{t('toolkit.modal.download_ide', 'Download IDE')}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : ide.official_extension_url ? (
                          <a
                            href={ide.official_extension_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1"
                          >
                            <span>{t('toolkit.modal.marketplace', 'Marketplace')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : ide.guide_url ? (
                          <a
                            href={ide.guide_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all flex items-center gap-1"
                          >
                            <span>{t('toolkit.modal.setup_guide', 'Setup Guide')}</span>
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

          {/* Architecture Note */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                {t('toolkit.modal.arch_title', 'Multi-Editor Architecture (Antigravity IDE, VS Code, JetBrains, Zed & Apple Xcode):')}
              </span>
              <p className="mt-1 leading-relaxed text-[11px]">
                {t(
                  'toolkit.modal.arch_desc',
                  'Antigravity Shield provides a unified local proxy gateway (127.0.0.1:8765) that supports all official Antigravity extensions and plugins. Read Google\'s official announcement for setup details across all coding editors.'
                )}
              </p>
              <a
                href="https://antigravity.google/blog/antigravity-ide-extensions"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>{t('toolkit.modal.arch_blog', 'Read Google Antigravity IDE Extensions Blog')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 text-xs text-slate-500 shrink-0">
          <a
            href="https://github.com/antigravity-hub/antigravity-toolkit-extension"
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-500 transition-colors flex items-center gap-1 truncate max-w-[260px]"
          >
            <span className="truncate">antigravity-hub/antigravity-toolkit-extension</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
          <button
            onClick={closeModal}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shrink-0"
          >
            {t('common.close', 'Close')}
          </button>
        </div>

        {/* Safety Confirmation Prompt Before Installation */}
        {ideToConfirm && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-[#0d1322] rounded-2xl shadow-2xl border border-amber-500/30 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('toolkit.modal.close_ide_title', 'Please Close {{ide}} Window', { ide: ideToConfirm.name })}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t(
                      'toolkit.modal.close_ide_desc',
                      'To avoid sudden restarts or conflicts with open files in {{ide}}, please save your changes and close the editor window before continuing the installation.',
                      { ide: ideToConfirm.name }
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setIdeToConfirm(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    const target = ideToConfirm;
                    setIdeToConfirm(null);
                    handleInstall(target);
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 shadow-md shadow-blue-500/25 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('toolkit.modal.continue_install', 'Window Closed: Continue Install')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
