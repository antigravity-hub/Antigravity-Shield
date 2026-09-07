import { createHashRouter, RouterProvider } from 'react-router-dom';

import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import ApiProxy from './pages/ApiProxy';
import Monitor from './pages/Monitor';
import TokenStats from './pages/TokenStats';
import Security from './pages/Security';
import ThemeManager from './components/common/ThemeManager';
import UserToken from './pages/UserToken';
import { UpdateNotification } from './components/UpdateNotification';
import DebugConsole from './components/debug/DebugConsole';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useEffect, useState } from 'react';
import { useConfigStore } from './stores/useConfigStore';
import { useAccountStore } from './stores/useAccountStore';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from './utils/env';
import { request as invoke } from './utils/request';
import { AdminAuthGuard } from './components/common/AdminAuthGuard';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
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
        path: 'monitor',
        element: <Monitor />,
      },
      {
        path: 'token-stats',
        element: <TokenStats />,
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
    ],
  },
]);

function App() {
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
      // Support RTL
      if (config.language === 'ar') {
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

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AdminAuthGuard>
        <ThemeManager />
        <DebugConsole />
        {showUpdateNotification && (
          <UpdateNotification onClose={() => setShowUpdateNotification(false)} />
        )}
        <RouterProvider router={router} />
      </AdminAuthGuard>
    </ErrorBoundary>
  );
}

export default App;