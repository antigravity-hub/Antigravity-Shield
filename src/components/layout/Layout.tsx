import { Outlet, useLocation } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../navbar/Navbar';
import BackgroundTaskRunner from '../common/BackgroundTaskRunner';
import ToastContainer from '../common/ToastContainer';
import SupportModal from '../common/SupportModal';
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
    const location = useLocation();
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
        <div className="h-screen flex bg-[#FAFBFC] dark:bg-[#09100d] text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* 全局窗口拖拽区域 - 使用 JS 手动触发拖拽，解决 HTML 属性失效问题 */}
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

            {isSidebarLayout ? (
                <div className="flex w-full h-full">
                    <Sidebar />
                    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
                        <main className="flex-1 overflow-hidden flex flex-col relative pt-9">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={location.pathname}
                                    initial={{ opacity: 0, y: 8, scale: 0.996 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.996 }}
                                    transition={{
                                        type: 'spring',
                                        damping: 30,
                                        stiffness: 360,
                                        mass: 0.75,
                                    }}
                                    className="flex-1 flex flex-col h-full min-w-0 overflow-hidden will-change-[transform,opacity]"
                                >
                                    <Outlet />
                                </motion.div>
                            </AnimatePresence>
                        </main>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col w-full h-full">
                    <Navbar />
                    <main className="flex-1 overflow-hidden flex flex-col relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 8, scale: 0.996 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.996 }}
                                transition={{
                                    type: 'spring',
                                    damping: 30,
                                    stiffness: 360,
                                    mass: 0.75,
                                }}
                                className="flex-1 flex flex-col h-full min-w-0 overflow-hidden will-change-[transform,opacity]"
                            >
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
            )}
        </div>
    );
}

export default Layout;
