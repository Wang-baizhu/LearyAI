// Layout 负责登录相关页面的双栏盒子布局与背景装饰，保持视觉统一。
import React from 'react';
import type { AuthView } from '../../types';
import SidebarContent from '../sidebar-content';

interface LayoutProps {
  children: React.ReactNode;
  view: AuthView;
}

const Layout: React.FC<LayoutProps> = ({ children, view }) => {
  return (
    <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-[45%_1fr] bg-panel-light dark:bg-[#121212] rounded-[2rem] shadow-2xl overflow-hidden min-h-[600px] border border-slate-100 dark:border-[#2a2a2a]">
      <div className="hidden lg:flex flex-col bg-slate-50 dark:bg-[#121212] border-r border-slate-200 dark:border-[#2a2a2a] p-10 relative overflow-hidden transition-all duration-500">
        <SidebarContent view={view} />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary opacity-5 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="mt-auto pt-8">
          <p className="text-xs text-slate-400 dark:text-[#a0a0a0]">© 2026 AI 工作区公司。保留所有权利。</p>
        </div>
      </div>
      <div className="p-8 md:p-12 flex flex-col justify-center transition-opacity duration-300">{children}</div>
    </div>
  );
};

export default Layout;
