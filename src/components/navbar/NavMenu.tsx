import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NavigationDropdown } from './NavDropdowns';
import { isActive, getCurrentNavItem, type NavItem } from './constants';
import { useConfigStore } from '../../stores/useConfigStore';

interface NavMenuProps {
    navItems: NavItem[];
}

/**
 * 导航菜单组件 - 独立处理响应式
 * 
 * 响应式策略:
 * - ≥ 768px (md): 文字胶囊
 * - 640px - 768px: 图标胶囊 (Logo 显示文字)
 * - 480px - 640px: 图标胶囊 (Logo 隐藏文字)
 * - 375px - 480px: 图标+文字下拉
 * - < 375px: 图标下拉
 */
export function NavMenu({ navItems }: NavMenuProps) {
    const location = useLocation();
    const { isMenuItemHidden } = useConfigStore();

    // 过滤隐藏的菜单项
    const visibleNavItems = navItems.filter(item => !isMenuItemHidden(item.path));

    return (
        <>
            {/* 文字胶囊 (≥ 1120px) */}
            <nav className="max-[1119px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => {
                    const active = isActive(location.pathname, item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            draggable="false"
                            className="relative block"
                        >
                            <motion.div
                                whileTap={{ scale: 0.96 }}
                                className={`relative px-3.5 xl:px-5 py-1.5 rounded-full text-xs xl:text-sm font-semibold transition-colors duration-150 whitespace-nowrap select-none ${
                                    active
                                        ? 'text-slate-950 font-bold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                                }`}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="activeNavMenuPill"
                                        transition={{
                                            type: 'spring',
                                            damping: 28,
                                            stiffness: 350,
                                            mass: 0.8,
                                        }}
                                        className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-seafoam-500 to-[#93e9be] rounded-full shadow-[0_0_14px_rgba(147,233,190,0.35)] border border-[#93e9be]/50"
                                    />
                                )}
                                <span className="relative z-10">{item.label}</span>
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* 图标胶囊 (880px - 1120px) - Logo 显示文字 */}
            <nav className="max-[879px]:hidden min-[1120px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => {
                    const active = isActive(location.pathname, item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            draggable="false"
                            className="relative block"
                            title={item.label}
                        >
                            <motion.div
                                whileTap={{ scale: 0.94 }}
                                className={`relative p-2 rounded-full transition-colors duration-150 select-none ${
                                    active
                                        ? 'text-slate-950 font-bold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                                }`}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="activeNavMenuIconPill"
                                        transition={{
                                            type: 'spring',
                                            damping: 28,
                                            stiffness: 350,
                                            mass: 0.8,
                                        }}
                                        className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-seafoam-500 to-[#93e9be] rounded-full shadow-[0_0_14px_rgba(147,233,190,0.35)] border border-[#93e9be]/50"
                                    />
                                )}
                                <div className="relative z-10">
                                    <item.icon className="w-4 h-4" />
                                </div>
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* 图标胶囊 (640px - 880px) - Logo 隐藏文字 */}
            <nav className="max-[639px]:hidden min-[880px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => {
                    const active = isActive(location.pathname, item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            draggable="false"
                            className="relative block"
                            title={item.label}
                        >
                            <motion.div
                                whileTap={{ scale: 0.94 }}
                                className={`relative p-2 rounded-full transition-colors duration-150 select-none ${
                                    active
                                        ? 'text-slate-950 font-bold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                                }`}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="activeNavMenuIconPillMid"
                                        transition={{
                                            type: 'spring',
                                            damping: 28,
                                            stiffness: 350,
                                            mass: 0.8,
                                        }}
                                        className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-seafoam-500 to-[#93e9be] rounded-full shadow-[0_0_14px_rgba(147,233,190,0.35)] border border-[#93e9be]/50"
                                    />
                                )}
                                <div className="relative z-10">
                                    <item.icon className="w-4 h-4" />
                                </div>
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* 图标胶囊 (480px - 640px) */}
            <nav className="max-[479px]:hidden min-[640px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => {
                    const active = isActive(location.pathname, item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            draggable="false"
                            className="relative block"
                            title={item.label}
                        >
                            <motion.div
                                whileTap={{ scale: 0.94 }}
                                className={`relative p-2 rounded-full transition-colors duration-150 select-none ${
                                    active
                                        ? 'text-white'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
                                }`}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="activeNavMenuIconPillSmall"
                                        transition={{
                                            type: 'spring',
                                            damping: 28,
                                            stiffness: 350,
                                            mass: 0.8,
                                        }}
                                        className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.35)] border border-cyan-400/40"
                                    />
                                )}
                                <div className="relative z-10">
                                    <item.icon className="w-4 h-4" />
                                </div>
                            </motion.div>
                        </Link>
                    );
                })}
            </nav>

            {/* 图标+文字下拉 (375px - 480px) */}
            <div className="max-[374px]:hidden min-[480px]:hidden block">
                <NavigationDropdown
                    navItems={visibleNavItems}
                    isActive={(path) => isActive(location.pathname, path)}
                    getCurrentNavItem={() => getCurrentNavItem(location.pathname, visibleNavItems)}
                    onNavigate={() => { }}
                    showLabel={true}
                />
            </div>

            {/* 图标下拉 (< 375px) */}
            <div className="min-[375px]:hidden">
                <NavigationDropdown
                    navItems={visibleNavItems}
                    isActive={(path) => isActive(location.pathname, path)}
                    getCurrentNavItem={() => getCurrentNavItem(location.pathname, visibleNavItems)}
                    onNavigate={() => { }}
                    showLabel={false}
                />
            </div>
        </>
    );
}
