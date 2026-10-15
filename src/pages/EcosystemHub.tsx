import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  Layers,
  Plug,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useEcosystemStore } from '../stores/useEcosystemStore';
import SkillsTab from '../components/ecosystem/SkillsTab';
import McpTab from '../components/ecosystem/McpTab';
import RulesTab from '../components/ecosystem/RulesTab';
import { CONTAINER_MAX_WIDTH } from '../constants/layout';

export const EcosystemHub: React.FC = () => {
  const { t } = useTranslation();
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    skills,
    mcpServers,
    rules,
    loading,
    loadAll,
  } = useEcosystemStore();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const tabs = [
    {
      id: 'skills' as const,
      label: t('ecosystem.tabs.skills', 'Agent Skills'),
      icon: Sparkles,
      count: skills.length,
      activeCount: skills.filter((s) => s.isEnabled).length,
    },
    {
      id: 'mcp' as const,
      label: t('ecosystem.tabs.mcp', 'MCP Servers'),
      icon: Plug,
      count: mcpServers.length,
      activeCount: mcpServers.filter((m) => m.isEnabled).length,
    },
    {
      id: 'rules' as const,
      label: t('ecosystem.tabs.rules', 'Rules & Prompts'),
      icon: FileText,
      count: rules.length,
      activeCount: rules.filter((r) => r.isEnabled).length,
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-gradient-to-b from-[#FAFBFC] to-slate-100 dark:from-[#09100d] dark:to-[#0b1410] text-slate-900 dark:text-slate-100">
      <div className={`${CONTAINER_MAX_WIDTH} w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 flex flex-col`}>
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-600 via-seafoam-500 to-[#93e9be] text-slate-950 shadow-md shadow-emerald-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t('ecosystem.title', 'Agent Ecosystem Hub')}
              </h1>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t(
                'ecosystem.subtitle',
                'Curate, configure, and monitor agent skills, Model Context Protocol servers, and behavioral rules'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => loadAll()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium shadow-xs transition-colors active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('common.sync', 'Sync')}</span>
            </button>
          </div>
        </div>

        {/* Apple Segmented Control Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Segmented Control */}
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-900/90 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xl shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 select-none ${
                    isActive
                      ? 'text-emerald-700 dark:text-[#93e9be] shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="ecosystem-tab-pill"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {tab.activeCount}/{tab.count}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('ecosystem.search_placeholder', 'Search tools, triggers, servers...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area with 4-State UI */}
        <div className="flex-1 pb-10">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-800/40"
                />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.995 }}
                transition={{
                  type: 'spring',
                  damping: 30,
                  stiffness: 350,
                  mass: 0.75,
                }}
                className="w-full will-change-[transform,opacity]"
              >
                {activeTab === 'skills' && <SkillsTab />}
                {activeTab === 'mcp' && <McpTab />}
                {activeTab === 'rules' && <RulesTab />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default EcosystemHub;
