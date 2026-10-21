/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import { Outlet } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Navbar from '../navbar/Navbar';
import BackgroundTaskRunner from '../common/BackgroundTaskRunner';
import ToastContainer from '../common/ToastContainer';
import SupportModal from '../common/SupportModal';
import ToolkitIntegrationModal from '../navbar/ToolkitIntegrationModal';
import { useViewStore } from '../../stores/useViewStore';
import MiniView from './MiniView';
import { useEffect } from 'react';
import { isTauri } from '../../utils/env';
import { ensureFullViewState } from '../../utils/windowManager';

import WindowControls from './WindowControls';

import Sidebar from './Sidebar';
import { useConfigStore } from '../../stores/useConfigStore';

function Layout() {
    const { isMiniView } = useViewStore();
    const { config } = useConfigStore();
    const localLayout = typeof window !== 'undefined' ? localStorage.getItem('antigravity_navigation_layout') : null;
    const isSidebarLayout = (config?.navigation_layout ?? localLayout ?? 'sidebar') === 'sidebar';

    // Ensure correct window state when in Full View (not Mini View)
    // This handles the case where the app was closed in Mini View (small size, no decorations)
    // and restarted (defaults to Full View state but keeps last window properties)
    useEffect(() => {
        if (!isMiniView && isTauri()) {
            ensureFullViewState();
        }
    }, [isMiniView]);

    if (isMiniView) {
        return (
            <>
                <BackgroundTaskRunner />
                <ToastContainer />
                <MiniView />
            </>
        );
    }

    return (
        <div className="h-screen flex bg-[#FAFBFC] dark:bg-[#060807] text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Global window drag region - uses JS drag trigger to prevent HTML attribute dropping */}
            <div
                className="fixed top-0 left-0 right-36 h-9"
                style={{
                    zIndex: 9999,
                    backgroundColor: 'rgba(0,0,0,0.001)',
                    cursor: 'default',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                }}
                data-tauri-drag-region
                onMouseDown={() => {
                    if (isTauri()) {
                        try {
                            getCurrentWindow().startDragging();
                        } catch {}
                    }
                }}
                onDoubleClick={async () => {
                    if (isTauri()) {
                        try {
                            await getCurrentWindow().toggleMaximize();
                        } catch {}
                    }
                }}
            />
            <WindowControls />
            <BackgroundTaskRunner />
            <ToastContainer />
            <SupportModal />
            <ToolkitIntegrationModal />

            {isSidebarLayout ? (
                <div className="flex w-full h-full">
                    <Sidebar />
                    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
                        <main className="flex-1 overflow-hidden flex flex-col relative pt-9">
                            <Outlet />
                        </main>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col w-full h-full">
                    <Navbar />
                    <main className="flex-1 overflow-hidden flex flex-col relative">
                        <Outlet />
                    </main>
                </div>
            )}
        </div>
    );
}

export default Layout;
