import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Network,
  Activity,
  BarChart3,
  Settings,
  Lock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';
import { useConfigStore } from '../../stores/useConfigStore';
import { NavVersionBadge } from '../navbar/NavVersionBadge';

interface NavSectionItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  isNew?: boolean;
}

interface NavSection {
  title?: string;
  items: NavSectionItem[];
}

export const Sidebar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { config, saveConfig, isMenuItemHidden } = useConfigStore();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('antigravity_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('antigravity_sidebar_collapsed', String(next));
  };

  const isRtl = i18n.language === 'fa' || i18n.language === 'ar' || i18n.language?.startsWith('fa-');

  const sections: NavSection[] = [
    {
      title: t('sidebar.sections.core', 'Core'),
      items: [
        { path: '/', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
        { path: '/accounts', label: t('nav.accounts', 'Accounts'), icon: Users },
        { path: '/api-proxy', label: t('nav.proxy', 'API Proxy'), icon: Network },
      ],
    },
    {
      title: t('sidebar.sections.ecosystem', 'Ecosystem'),
      items: [
        {
          path: '/ecosystem',
          label: t('nav.ecosystem', 'Skills & MCP Hub'),
          icon: Layers,
          badge: 'PRO',
          isNew: true,
        },
      ],
    },
    {
      title: t('sidebar.sections.monitoring', 'Telemetry'),
      items: [
        { path: '/monitor', label: t('nav.call_records', 'Live Monitor'), icon: Activity },
        { path: '/token-stats', label: t('nav.token_stats', 'Token Stats'), icon: BarChart3 },
        { path: '/user-token', label: t('nav.user_token', 'User Tokens'), icon: Users },
        { path: '/security', label: t('nav.security', 'Security'), icon: Lock },
      ],
    },
    {
      title: t('sidebar.sections.system', 'System'),
      items: [
        { path: '/settings', label: t('nav.settings', 'Settings'), icon: Settings },
      ],
    },
  ];

  const toggleTheme = () => {
    if (!config) return;
    const newTheme = config.theme === 'light' ? 'dark' : 'light';
    saveConfig({ ...config, theme: newTheme }, true);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={`h-screen flex flex-col shrink-0 select-none z-40 transition-colors
        border-e border-slate-200/70 dark:border-slate-800/80
        bg-white/75 dark:bg-[#060807]/90 backdrop-blur-2xl shadow-[4px_0_24px_rgba(0,0,0,0.02)]
        dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]`}
    >
      {/* Sidebar Header & Brand */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200/60 dark:border-slate-800/60 justify-between">
        <Link to="/" className="flex items-center gap-3 overflow-hidden min-w-0 group">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-emerald-600 via-seafoam-500 to-[#93e9be] text-white shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-200">
            <ShieldCheck className="w-5 h-5 text-slate-950" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#93e9be] ring-2 ring-white dark:ring-[#09100d]" />
          </div>

          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex flex-col min-w-0"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  Antigravity
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#93e9be]/15 text-emerald-700 dark:text-[#93e9be] border border-[#93e9be]/30">
                  SHIELD
                </span>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                Agentic Manager & Hub
              </span>
            </motion.div>
          )}
        </Link>

        {/* Collapse toggle button */}
        <button
          onClick={toggleCollapse}
          title={collapsed ? t('common.expand', 'Expand') : t('common.collapse', 'Collapse')}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all shrink-0 active:scale-95"
        >
          {collapsed ? (
            isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-4">
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) => !isMenuItemHidden(item.path));
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              {!collapsed && section.title && (
                <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  {section.title}
                </div>
              )}

              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="relative block"
                      title={collapsed ? item.label : undefined}
                    >
                      <motion.div
                        whileTap={{ scale: 0.96 }}
                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors select-none ${
                          isActive
                            ? 'text-emerald-700 dark:text-[#93e9be] font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeSidebarIndicator"
                            transition={{
                              type: 'spring',
                              damping: 28,
                              stiffness: 350,
                              mass: 0.8,
                            }}
                            className="absolute inset-0 bg-gradient-to-r from-emerald-500/15 via-[#93e9be]/15 to-teal-500/10 dark:from-[#93e9be]/20 dark:via-emerald-500/15 dark:to-teal-500/10 rounded-xl border border-[#93e9be]/40 shadow-xs"
                          />
                        )}

                        <div
                          className={`relative z-10 p-1 rounded-lg shrink-0 transition-colors ${
                            isActive
                              ? 'bg-gradient-to-br from-emerald-600 to-[#129a5f] text-white shadow-xs shadow-emerald-500/30'
                              : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        {!collapsed && (
                          <div className="relative z-10 flex items-center justify-between flex-1 min-w-0">
                            <span className="truncate">{item.label}</span>
                            {item.badge && (
                              <span className="ms-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-gradient-to-r from-emerald-600 to-[#129a5f] text-white shadow-xs">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer & Quick Actions */}
      <div className="p-2.5 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
          <button
            onClick={toggleTheme}
            title={config?.theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-all active:scale-95"
          >
            {config?.theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {!collapsed ? (
            <NavVersionBadge />
          ) : (
            <NavVersionBadge compact />
          )}
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
