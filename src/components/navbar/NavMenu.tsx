import { Link, useLocation } from 'react-router-dom';
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

    const getItemClass = (active: boolean, isIconOnly = false) => {
        if (active) {
            return `
                ${isIconOnly ? 'p-2' : 'px-3.5 xl:px-5 py-1.5'}
                rounded-full
                text-xs xl:text-sm
                font-semibold
                transition-all
                duration-200
                whitespace-nowrap
                bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600
                text-white
                shadow-[0_0_12px_rgba(6,182,212,0.35)]
                border border-cyan-400/40
                cursor-pointer
            `;
        }
        return `
            ${isIconOnly ? 'p-2' : 'px-3.5 xl:px-5 py-1.5'}
            rounded-full
            text-xs xl:text-sm
            font-medium
            transition-all
            duration-200
            whitespace-nowrap
            text-slate-600 dark:text-slate-400
            hover:text-slate-900 dark:hover:text-slate-100
            hover:bg-slate-200/70 dark:hover:bg-slate-800/60
            cursor-pointer
        `;
    };

    return (
        <>
            {/* 文字胶囊 (≥ 1120px) */}
            <nav className="max-[1119px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        draggable="false"
                        className={getItemClass(isActive(location.pathname, item.path))}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>

            {/* 图标胶囊 (880px - 1120px) - Logo 显示文字 */}
            <nav className="max-[879px]:hidden min-[1120px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        draggable="false"
                        className={getItemClass(isActive(location.pathname, item.path), true)}
                        title={item.label}
                    >
                        <item.icon className="w-4 h-4" />
                    </Link>
                ))}
            </nav>

            {/* 图标胶囊 (640px - 880px) - Logo 隐藏文字 */}
            <nav className="max-[639px]:hidden min-[880px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        draggable="false"
                        className={getItemClass(isActive(location.pathname, item.path), true)}
                        title={item.label}
                    >
                        <item.icon className="w-4 h-4" />
                    </Link>
                ))}
            </nav>

            {/* 图标胶囊 (480px - 640px) */}
            <nav className="max-[479px]:hidden min-[640px]:hidden flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-full p-1 shadow-inner">
                {visibleNavItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        draggable="false"
                        className={getItemClass(isActive(location.pathname, item.path), true)}
                        title={item.label}
                    >
                        <item.icon className="w-4 h-4" />
                    </Link>
                ))}
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
