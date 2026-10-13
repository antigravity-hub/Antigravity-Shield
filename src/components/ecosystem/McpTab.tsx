import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plug,
  Plus,
  Settings,
  Trash2,
  AlertCircle,
  X,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Activity,
  CheckCircle2,
  Layers,
  Info,
  Wrench,
  Check,
  Copy,
} from 'lucide-react';
import { useEcosystemStore } from '../../stores/useEcosystemStore';
import { McpServerItem, McpTransport } from '../../types/ecosystem';

type HealthFilter = 'all' | 'healthy' | 'needs_config' | 'disabled';

export const McpTab: React.FC = () => {
  const { t } = useTranslation();
  const {
    mcpServers,
    searchQuery,
    saveMcpServer,
    deleteMcpServer,
    toggleMcpServer,
    testMcpServer,
    testAllMcpServers,
    testingMcpId,
    isTestingAllMcp,
  } = useEcosystemStore();

  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [configuringServer, setConfiguringServer] = useState<McpServerItem | null>(null);
  const [inspectingServer, setInspectingServer] = useState<McpServerItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [lastTestFeedback, setLastTestFeedback] = useState<{ id: string; message: string; success: boolean } | null>(null);

  const [newServer, setNewServer] = useState<{
    id: string;
    title: string;
    description: string;
    command: string;
    args: string;
    transport: McpTransport;
    envKey: string;
    envVal: string;
  }>({
    id: '',
    title: '',
    description: '',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-...',
    transport: 'stdio',
    envKey: '',
    envVal: '',
  });

  // Calculate fleet health metrics
  const activeCount = mcpServers.filter((s) => s.isEnabled).length;
  const healthyCount = mcpServers.filter((s) => s.isEnabled && s.status === 'connected').length;
  const needsConfigCount = mcpServers.filter((s) => s.status === 'needs_config' || (s.isEnabled && s.status === 'error')).length;
  const disabledCount = mcpServers.filter((s) => !s.isEnabled).length;
  
  const connectedServersWithPing = mcpServers.filter((s) => s.isEnabled && s.status === 'connected' && s.lastPingMs);
  const avgLatency = connectedServersWithPing.length > 0
    ? Math.round(connectedServersWithPing.reduce((acc, s) => acc + (s.lastPingMs || 0), 0) / connectedServersWithPing.length)
    : 18;

  const filteredServers = mcpServers.filter((item) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.command.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (healthFilter === 'healthy') {
      return item.isEnabled && item.status === 'connected';
    }
    if (healthFilter === 'needs_config') {
      return item.status === 'needs_config' || (item.isEnabled && item.status === 'error');
    }
    if (healthFilter === 'disabled') {
      return !item.isEnabled;
    }
    return true;
  });

  const handleTestPing = async (serverId: string) => {
    const res = await testMcpServer(serverId);
    setLastTestFeedback({
      id: serverId,
      message: res.message,
      success: res.success,
    });
    setTimeout(() => {
      setLastTestFeedback((prev) => (prev?.id === serverId ? null : prev));
    }, 6000);
  };

  const handleCopyCommand = (cmdStr: string) => {
    navigator.clipboard.writeText(cmdStr);
    setCopiedCmd(cmdStr);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServer.id || !newServer.command) return;

    const envMap: Record<string, string> = {};
    if (newServer.envKey.trim()) {
      envMap[newServer.envKey.trim()] = newServer.envVal.trim();
    }

    const payload: McpServerItem = {
      id: newServer.id.toLowerCase().replace(/\s+/g, '-'),
      name: newServer.id.toLowerCase().replace(/\s+/g, '-'),
      title: newServer.title || newServer.id,
      description: newServer.description || 'Custom configured MCP tool provider.',
      category: 'Custom Tools',
      author: 'Local User',
      transport: newServer.transport,
      command: newServer.command,
      args: newServer.args.split(' ').filter(Boolean),
      env: envMap,
      isInstalled: true,
      isEnabled: true,
      status: 'connected',
      official: false,
    };

    await saveMcpServer(payload);
    setIsAddOpen(false);
    setNewServer({
      id: '',
      title: '',
      description: '',
      command: 'npx',
      args: '',
      transport: 'stdio',
      envKey: '',
      envVal: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Fleet Health Dashboard Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                <Activity className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('ecosystem.mcp.health_overview', 'MCP Servers Health & Capability Overview')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              پروتکل ارتباطی ابزارها جهت تجهیز هوش مصنوعی به قابلیت‌های فایل‌سیستم، وب، گیت‌هاب و دیتابیس
            </p>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {healthyCount} از {activeCount} {t('ecosystem.mcp.status_connected', 'آماده و متصل')}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono">
                ~{avgLatency}ms avg
              </span>
            </div>

            <button
              onClick={() => testAllMcpServers()}
              disabled={isTestingAllMcp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-all active:scale-95 disabled:opacity-50"
              title={t('ecosystem.mcp.test_all', 'Check All Servers Health')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingAllMcp ? 'animate-spin text-sky-500' : ''}`} />
              <span>{isTestingAllMcp ? t('ecosystem.mcp.testing_all', 'در حال تست...') : t('ecosystem.mcp.test_all', 'بررسی سلامت همه سرورها')}</span>
            </button>

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-sky-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('ecosystem.mcp.add_server', 'Add MCP Server')}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <button
            onClick={() => setHealthFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              healthFilter === 'all'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('ecosystem.mcp.filter_all', 'همه سرورها')} ({mcpServers.length})
          </button>

          <button
            onClick={() => setHealthFilter('healthy')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              healthFilter === 'healthy'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{t('ecosystem.mcp.filter_healthy', 'سالم و متصل')} ({healthyCount})</span>
          </button>

          <button
            onClick={() => setHealthFilter('needs_config')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              healthFilter === 'needs_config'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{t('ecosystem.mcp.filter_needs_config', 'نیازمند راه‌اندازی')} ({needsConfigCount})</span>
          </button>

          <button
            onClick={() => setHealthFilter('disabled')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              healthFilter === 'disabled'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{t('ecosystem.mcp.filter_disabled', 'غیرفعال')} ({disabledCount})</span>
          </button>
        </div>
      </div>

      {/* MCP Servers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredServers.map((server) => {
          const isTesting = testingMcpId === server.id;
          const isFeedbackVisible = lastTestFeedback?.id === server.id;

          // Determine health badge semantics
          let badgeColor = 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
          let dotColor = 'bg-slate-400';
          let badgeText = t('ecosystem.mcp.status_disabled', 'غیرفعال');

          if (!server.isEnabled) {
            badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
            dotColor = 'bg-slate-400';
            badgeText = t('ecosystem.mcp.status_disabled', 'غیرفعال');
          } else if (server.status === 'connected') {
            badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
            dotColor = 'bg-emerald-500 animate-pulse';
            badgeText = server.lastPingMs ? `${t('ecosystem.mcp.status_connected', 'متصل')} • ${server.lastPingMs}ms` : t('ecosystem.mcp.status_connected', 'متصل');
          } else if (server.status === 'needs_config') {
            badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
            dotColor = 'bg-amber-500';
            badgeText = t('ecosystem.mcp.status_needs_config', 'نیازمند تنظیمات');
          } else if (server.status === 'error') {
            badgeColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
            dotColor = 'bg-rose-500';
            badgeText = t('ecosystem.mcp.status_error', 'خطا در اتصال');
          }

          return (
            <div
              key={server.id}
              className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 backdrop-blur-xl ${
                !server.isEnabled
                  ? 'border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 opacity-75'
                  : server.status === 'connected'
                  ? 'border-emerald-500/20 hover:border-emerald-500/40 bg-white/80 dark:bg-slate-900/70 shadow-xs hover:shadow-md'
                  : 'border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                {/* Header & Status Indicator */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      server.isEnabled && server.status === 'connected'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                    }`}>
                      <Plug className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {server.title}
                        </h3>
                        {server.official && (
                          <span title="Official Verified MCP Server">
                            <ShieldCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono uppercase text-[10px]">{server.transport}</span>
                        {server.toolCount && (
                          <>
                            <span>•</span>
                            <button
                              onClick={() => setInspectingServer(server)}
                              className="text-sky-500 hover:text-sky-400 hover:underline flex items-center gap-1"
                              title="مشاهده لیست ابزارها"
                            >
                              <Layers className="w-3 h-3" />
                              <span>{server.toolCount} ابزار</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator Pill */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${badgeColor}`}>
                    <span className={`w-2 h-2 rounded-full ${isTesting ? 'bg-sky-500 animate-spin' : dotColor}`} />
                    <span>{isTesting ? t('ecosystem.mcp.status_testing', 'در حال تست...') : badgeText}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                  {server.description}
                </p>

                {/* Execution preview with copy button */}
                <div className="p-2 rounded-xl bg-slate-100/90 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 font-mono text-[11px] text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {server.command} {server.args.join(' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCommand(`${server.command} ${server.args.join(' ')}`)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="کپی دستور"
                  >
                    {copiedCmd === `${server.command} ${server.args.join(' ')}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Diagnostic helper badge / prerequisites */}
                {server.requirements?.description && (
                  <div className={`p-2 rounded-xl text-[11px] flex items-center gap-1.5 mb-2 ${
                    !server.isEnabled || server.status === 'needs_config'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                      : 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                  }`}>
                    <Info className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span className="truncate">{server.requirements.description}</span>
                  </div>
                )}

                {/* Live Diagnostic Feedback Banner */}
                {isFeedbackVisible && (
                  <div className={`p-2 rounded-xl text-[11px] flex items-center gap-1.5 mb-2 transition-all ${
                    lastTestFeedback?.success
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                  }`}>
                    {lastTestFeedback?.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    )}
                    <span className="truncate">{lastTestFeedback?.message}</span>
                  </div>
                )}

                {server.errorMessage && !isFeedbackVisible && (
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1.5 mb-2 border border-rose-500/20">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{server.errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Actions & Footer with Apple Switch */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleTestPing(server.id)}
                    disabled={isTesting}
                    title={t('ecosystem.mcp.test', 'Test Server Connection')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-sky-500' : ''}`} />
                    <span>{isTesting ? 'در حال تست...' : 'تست پینگ'}</span>
                  </button>

                  <button
                    onClick={() => setInspectingServer(server)}
                    title={t('ecosystem.mcp.diagnostics', 'عیب‌یابی و ابزارها')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setConfiguringServer(server)}
                    title={t('ecosystem.mcp.configure', 'Configure Env & Args')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {!server.official && (
                    <button
                      onClick={() => deleteMcpServer(server.id)}
                      title="حذف سرور"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Pixel-perfect Apple Switch Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 select-none">
                    {server.isEnabled ? t('ecosystem.mcp.active', 'فعال') : t('ecosystem.mcp.inactive', 'غیرفعال')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={server.isEnabled}
                    onClick={() => toggleMcpServer(server.id, !server.isEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
                      server.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span className="sr-only">Toggle {server.title}</span>
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        server.isEnabled ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagnostics & Exposed Tools Modal */}
      <AnimatePresence>
        {inspectingServer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-white dark:bg-[#0c1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-500 border border-sky-500/20">
                    <Plug className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {inspectingServer.title}
                      </h3>
                      {inspectingServer.official && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                          Official
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {inspectingServer.category} • پروتکل {inspectingServer.transport.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectingServer(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                {/* Status & Diagnostic Banner */}
                <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${
                      !inspectingServer.isEnabled
                        ? 'bg-slate-400'
                        : inspectingServer.status === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : inspectingServer.status === 'needs_config'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {!inspectingServer.isEnabled
                          ? 'سرور غیرفعال است (Disabled)'
                          : inspectingServer.status === 'connected'
                          ? `عملیاتی و آماده به کار (${inspectingServer.lastPingMs || 12}ms)`
                          : inspectingServer.status === 'needs_config'
                          ? 'نیازمند تکمیل تنظیمات یا اجرای سرویس پیش‌نیاز'
                          : 'خطا در برقراری ارتباط'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {inspectingServer.requirements?.description || 'سرور آماده پاسخگویی به درخواست‌های هوش مصنوعی است.'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTestPing(inspectingServer.id)}
                    className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingMcpId === inspectingServer.id ? 'animate-spin' : ''}`} />
                    <span>تست مجدد</span>
                  </button>
                </div>

                {/* Exposed Tools Section */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sky-500" />
                    <span>{t('ecosystem.mcp.exposed_tools', 'ابزارهای ارائه‌شده برای هوش مصنوعی')}</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      ({inspectingServer.tools?.length || inspectingServer.toolCount || 0} ابزار)
                    </span>
                  </h4>

                  {inspectingServer.tools && inspectingServer.tools.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {inspectingServer.tools.map((tool, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60"
                        >
                          <div className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400 mb-0.5">
                            {tool.name}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {tool.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                      این سرور به صورت پویا ابزارهای خود را هنگام فراخوانی اولیه هوش مصنوعی (Handshake) رجیستر می‌کند.
                    </div>
                  )}
                </div>

                {/* Command & Environment */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-indigo-500" />
                    <span>دستور اجرا و پارامترها</span>
                  </h4>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2">
                    <span className="truncate">
                      {inspectingServer.command} {inspectingServer.args.join(' ')}
                    </span>
                    <button
                      onClick={() => handleCopyCommand(`${inspectingServer.command} ${inspectingServer.args.join(' ')}`)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {copiedCmd === `${inspectingServer.command} ${inspectingServer.args.join(' ')}` ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setInspectingServer(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Configure Modal */}
      <AnimatePresence>
        {configuringServer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white dark:bg-[#0c1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('ecosystem.mcp.configure', 'Configure Env & Args')}: {configuringServer.title}
                </span>
                <button
                  onClick={() => setConfiguringServer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Command Arguments (Space-separated)
                  </label>
                  <input
                    type="text"
                    value={configuringServer.args.join(' ')}
                    onChange={(e) =>
                      setConfiguringServer({
                        ...configuringServer,
                        args: e.target.value.split(' ').filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Environment Variables (JSON)
                  </label>
                  <textarea
                    rows={4}
                    value={JSON.stringify(configuringServer.env, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setConfiguringServer({ ...configuringServer, env: parsed });
                      } catch {}
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  onClick={() => setConfiguringServer(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await saveMcpServer(configuringServer);
                    setConfiguringServer(null);
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Server Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-white dark:bg-[#0c1220] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('ecosystem.mcp.add_modal_title', 'Register New MCP Server')}
                </span>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Server Identifier
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="postgres-analytics"
                      value={newServer.id}
                      onChange={(e) => setNewServer({ ...newServer, id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Display Title
                    </label>
                    <input
                      type="text"
                      placeholder="PostgreSQL Analytics"
                      value={newServer.title}
                      onChange={(e) => setNewServer({ ...newServer, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Command
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="npx or node"
                      value={newServer.command}
                      onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Arguments
                    </label>
                    <input
                      type="text"
                      placeholder="-y @modelcontextprotocol/server-..."
                      value={newServer.args}
                      onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tools and capabilities provided by this MCP server..."
                    value={newServer.description}
                    onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-xs"
                  >
                    Register Server
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default McpTab;
