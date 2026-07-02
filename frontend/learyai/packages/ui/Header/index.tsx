// AppHeader 负责提供可复用的应用顶栏布局，承载品牌、页签与右侧操作区。
import { Fragment, type ReactNode } from 'react';

export interface AppHeaderTabItem<TTabKey extends string = string> {
  key: TTabKey;
  label: ReactNode;
  active?: boolean;
  onClick?: () => void;
  wrapper?: (node: ReactNode) => ReactNode;
}

interface AppHeaderProps<TTabKey extends string = string> {
  brandLogoSrc: string;
  brandLogoAlt: string;
  brandTitle: ReactNode;
  tabs: AppHeaderTabItem<TTabKey>[];
  centerContent?: ReactNode;
  themeToggle?: ReactNode;
  userMenu?: ReactNode;
}

export const AppHeader = <TTabKey extends string = string>({
  brandLogoSrc,
  brandLogoAlt,
  brandTitle,
  tabs,
  centerContent,
  themeToggle,
  userMenu,
}: AppHeaderProps<TTabKey>) => (
  <header className="relative h-16 flex items-center justify-between px-6 lg:px-12 border-b border-slate-200 dark:border-[#2a2a2a] sticky top-0 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-md z-30">
    <div className="flex items-center gap-8 min-w-0">
      <div className="flex items-center gap-3">
        <img src={brandLogoSrc} alt={brandLogoAlt} className="w-10 h-10 object-contain" />
        <h1 className="font-bold dark:text-white text-base tracking-tight hidden sm:block">{brandTitle}</h1>
      </div>
      <nav className="hidden md:flex items-center gap-6">
        {tabs.map((tab) => {
          const tabNode = (
            <button
              key={tab.key}
              type="button"
              onClick={tab.onClick}
              className={`text-sm py-5 transition-colors ${
                tab.active
                  ? 'font-semibold text-primary border-b-2 border-primary'
                  : 'font-medium text-slate-500 hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          );
          return (
            <Fragment key={tab.key}>
              {tab.wrapper ? tab.wrapper(tabNode) : tabNode}
            </Fragment>
          );
        })}
      </nav>
    </div>
    {centerContent ? (
      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[min(46vw,680px)] -translate-x-1/2 items-center justify-center px-4 lg:flex">
        <div className="pointer-events-auto min-w-0 w-full">
          {centerContent}
        </div>
      </div>
    ) : null}
    {themeToggle || userMenu ? (
      <div className="ml-auto flex items-center gap-4">
        {themeToggle}
        {userMenu}
      </div>
    ) : null}
  </header>
);

export default AppHeader;
