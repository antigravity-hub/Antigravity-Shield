/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { createHashRouter, RouterProvider, Navigate, useRouteError } from 'react-router-dom';

import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import ApiProxy from './pages/ApiProxy';
import Monitor from './pages/Monitor';
import TokenStats from './pages/TokenStats';
import Security from './pages/Security';
import EcosystemHub from './pages/EcosystemHub';
import ThemeManager from './components/common/ThemeManager';
import UserToken from './pages/UserToken';
import { UpdateNotification } from './components/UpdateNotification';
import DebugConsole from './components/debug/DebugConsole';
import { VerificationGuideModal } from './components/common/VerificationGuideModal';
import { VerificationQrModal } from './components/common/VerificationQrModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useEffect, useState } from 'react';
import { useConfigStore } from './stores/useConfigStore';
import { useAccountStore } from './stores/useAccountStore';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from './utils/env';
import { request as invoke } from './utils/request';
import { AdminAuthGuard } from './components/common/AdminAuthGuard';
import { useQuotaAlertWatcher } from './hooks/useQuotaAlertWatcher';
import NotificationOverlay from './components/overlay/NotificationOverlay';

function RouteErrorBoundary() {
  const error: any = useRouteError();
  console.error('Route error caught:', error);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        {error?.status === 404 ? 'Page Not Found' : 'Something went wrong'}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md">
        {error?.statusText || error?.message || 'An unexpected error occurred while loading this view.'}
      </p>
      <a
        href="#/"
        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors shadow-sm"
      >
        Return to Dashboard
      </a>
    </div>
  );
}

const router = createHashRouter([
  {
    path: '/overlay-notification',
    element: <NotificationOverlay />,
  },
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'accounts',
        element: <Accounts />,
      },
      {
        path: 'api-proxy',
        element: <ApiProxy />,
      },
      {
        path: 'ecosystem',
        element: <EcosystemHub />,
      },
      {
        path: 'monitor',
        element: <Monitor />,
      },
      {
        path: 'token-stats',
        element: <TokenStats />,
      },
      {
        path: 'tokens',
        element: <Navigate to="/token-stats" replace />,
      },
      {
        path: 'user-token',
        element: <UserToken />,
      },
      {
        path: 'security',
        element: <Security />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

function OverlayApp() {
  const { config, loadConfig } = useConfigStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config?.language) {
      i18n.changeLanguage(config.language);
      document.documentElement.lang = config.language;
      if (config.language === 'ar' || config.language === 'fa' || config.language.startsWith('fa-')) {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
    }
  }, [config?.language, i18n]);

  return (
    <ErrorBoundary>
      <ThemeManager />
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

function MainApp() {
  useQuotaAlertWatcher();
  const { config, loadConfig } = useConfigStore();
  const { fetchCurrentAccount, fetchAccounts } = useAccountStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Sync language from config
  useEffect(() => {
    if (config?.language) {
      i18n.changeLanguage(config.language);
      document.documentElement.lang = config.language;
      // Support RTL
      if (config.language === 'ar' || config.language === 'fa' || config.language.startsWith('fa-')) {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
    }
  }, [config?.language, i18n]);

  // Listen for tray events
  useEffect(() => {
    if (!isTauri()) return;
    const unlistenPromises: Promise<() => void>[] = [];

    // 监听托盘切换账号事件
    unlistenPromises.push(
      listen('tray://account-switched', () => {
        console.log('[App] Tray account switched, refreshing...');
        fetchCurrentAccount();
        fetchAccounts();
      })
    );

    // 监听托盘刷新事件
    unlistenPromises.push(
      listen('tray://refresh-current', () => {
        console.log('[App] Tray refresh triggered, refreshing...');
        fetchCurrentAccount();
        fetchAccounts();
      })
    );

    // 监听后端全量刷新事件 (Command / Scheduler)
    unlistenPromises.push(
      listen('accounts://refreshed', () => {
        console.log('[App] Backend triggered quota refresh, syncing UI...');
        fetchCurrentAccount();
        fetchAccounts();
      })
    );

    // Cleanup
    return () => {
      Promise.all(unlistenPromises).then(unlisteners => {
        unlisteners.forEach(unlisten => unlisten());
      });
    };
  }, [fetchCurrentAccount, fetchAccounts]);

  // Window Focus & Visibility Auto-Sync (Instantly updates UI when switching to Shield window)
  useEffect(() => {
    const handleSync = () => {
      fetchCurrentAccount();
      fetchAccounts();
    };

    window.addEventListener('focus', handleSync);
    const handleVisibility = () => {
      if (!document.hidden) {
        handleSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchCurrentAccount, fetchAccounts]);

  // Update notification state
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  // Check for updates on startup (always) and periodically every 1 hour
  useEffect(() => {
    const triggerUpdateCheck = async () => {
      try {
        console.log('[App] Triggering update check...');
        setShowUpdateNotification(true);
        await invoke('update_last_check_time');
      } catch (error) {
        console.error('Failed to trigger update check:', error);
      }
    };

    const periodicCheck = async () => {
      try {
        const shouldCheck = await invoke<boolean>('should_check_updates');
        if (shouldCheck) {
          triggerUpdateCheck();
        }
      } catch (error) {
        console.error('Failed to check update settings:', error);
      }
    };

    // Always check for updates on startup after 2 seconds
    const timer = setTimeout(triggerUpdateCheck, 2000);

    // Periodic check every 1 hour (3600000 ms)
    const interval = setInterval(periodicCheck, 3600000);

    const handleOpenUpdate = () => {
      setShowUpdateNotification(true);
    };
    window.addEventListener('open-update-notification', handleOpenUpdate);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('open-update-notification', handleOpenUpdate);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AdminAuthGuard>
        <ThemeManager />
        <DebugConsole />
        <VerificationGuideModal />
        <VerificationQrModal />
        {showUpdateNotification && (
          <UpdateNotification onClose={() => setShowUpdateNotification(false)} />
        )}
        <RouterProvider router={router} />
      </AdminAuthGuard>
    </ErrorBoundary>
  );
}

export default function App() {
  const isOverlay = typeof window !== 'undefined' && window.location.hash.includes('/overlay-notification');
  if (isOverlay) {
    return <OverlayApp />;
  }
  return <MainApp />;
}