// GlobalMobileBottomNav 负责渲染登录后主流程页面统一的移动端底部导航。
import React from 'react';
import MaterialIcon from './icons/MaterialIcon';

export type GlobalMobileBottomNavKey = 'home' | 'ai' | 'project' | 'resource';

interface GlobalMobileBottomNavItem {
  key: GlobalMobileBottomNavKey;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  icon?: string;
}

interface GlobalMobileBottomNavProps {
  leftItem: GlobalMobileBottomNavItem;
  rightItem: GlobalMobileBottomNavItem;
  activeKey?: GlobalMobileBottomNavKey | null;
  centerAction?: {
    onClick: () => void;
    active?: boolean;
    ariaLabel: string;
  };
}

const NAV_ITEMS: Array<{
  key: GlobalMobileBottomNavKey;
  label: string;
  icon: string;
}> = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'ai', label: 'AI', icon: 'auto_awesome' },
  { key: 'project', label: '空间', icon: 'dashboard' },
  { key: 'resource', label: 'Resource', icon: 'folder' },
];

const NAV_ITEM_META = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.key, item])
) as Record<GlobalMobileBottomNavKey, (typeof NAV_ITEMS)[number]>;

const GlobalMobileBottomNav: React.FC<GlobalMobileBottomNavProps> = ({
  leftItem,
  rightItem,
  activeKey = null,
  centerAction,
}) => {
  const navItems = [leftItem, rightItem];
  const hasAction = Boolean(centerAction);
  const resolvedCenterAction = centerAction ?? null;
  const containerClassName = hasAction
    ? 'grid grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-2 rounded-t-[28px] border border-b-0 border-slate-200/80 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#2a2a2a] dark:bg-[#121212]/95'
    : 'flex items-end justify-center gap-3 overflow-visible rounded-t-[28px] border border-b-0 border-slate-200/80 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#2a2a2a] dark:bg-[#121212]/95';
  const buttonClassName = (isActive: boolean, isDisabled: boolean) =>
    `relative z-10 flex min-w-0 w-full items-center justify-center gap-2 rounded-[20px] px-3 py-3 text-[13px] font-semibold transition-all ${
      isActive
        ? 'bg-primary text-white shadow-lg shadow-primary/25'
        : 'text-slate-500 hover:bg-slate-100 dark:text-[#bdbdbd] dark:hover:bg-[#1a1a1a]'
    } ${isDisabled ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : ''}`;

  return (
    <nav className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label="全局移动端底部导航">
      <div className={containerClassName}>
        {hasAction && resolvedCenterAction ? (
          <>
            {navItems.slice(0, 1).map((item) => {
              const meta = NAV_ITEM_META[item.key];
              const label = item.label ?? meta.label;
              const icon = item.icon ?? meta.icon;
              const isActive = item.key === activeKey;
              const isDisabled = item.disabled ?? false;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  className={buttonClassName(isActive, isDisabled)}
                >
                  <MaterialIcon name={icon} className="text-[18px]" />
                  <span>{label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={resolvedCenterAction.onClick}
              className={`relative z-20 mx-auto flex h-12 w-12 items-center justify-center self-center rounded-[18px] border border-slate-200 text-sm font-semibold transition-all dark:border-[#2a2a2a] ${
                resolvedCenterAction.active
                  ? 'border-accent bg-accent text-white shadow-lg shadow-accent/25'
                  : 'bg-slate-50 text-slate-600 shadow-sm dark:bg-[#171717] dark:text-[#d0d0d0]'
              }`}
              aria-pressed={resolvedCenterAction.active ?? false}
              aria-label={resolvedCenterAction.ariaLabel}
            >
              <MaterialIcon name={resolvedCenterAction.active ? 'close' : 'add'} className="text-[22px]" />
            </button>
            {navItems.slice(1, 2).map((item) => {
              const meta = NAV_ITEM_META[item.key];
              const label = item.label ?? meta.label;
              const icon = item.icon ?? meta.icon;
              const isActive = item.key === activeKey;
              const isDisabled = item.disabled ?? false;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  className={buttonClassName(isActive, isDisabled)}
                >
                  <MaterialIcon name={icon} className="text-[18px]" />
                  <span>{label}</span>
                </button>
              );
            })}
          </>
        ) : navItems.map((item) => {
          const meta = NAV_ITEM_META[item.key];
          const label = item.label ?? meta.label;
          const icon = item.icon ?? meta.icon;
          const isActive = item.key === activeKey;
          const isDisabled = item.disabled ?? false;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              disabled={isDisabled}
              aria-pressed={isActive}
              className={`${buttonClassName(isActive, isDisabled)} max-w-[9rem] flex-1`}
            >
              <MaterialIcon name={icon} className="text-[18px]" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default GlobalMobileBottomNav;
