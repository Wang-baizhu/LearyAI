// SidebarHeader 负责展示侧栏标题与历史记录切换入口。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface SidebarHeaderProps {
  showHistory: boolean;
  onToggleHistory: () => void;
  isHistoryDisabled?: boolean;
  isCollapsed: boolean;
  onToggleCollapsed?: () => void;
  showCollapseToggle?: boolean;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  showHistory,
  onToggleHistory,
  isHistoryDisabled = false,
  isCollapsed,
  onToggleCollapsed,
  showCollapseToggle = true,
}) => (
  <div className="p-6 border-b border-slate-50 dark:border-[#2a2a2a]">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img
          src="/icon-animate.svg"
          alt="Leary AI"
          className="w-10 h-10 object-contain"
        />
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Leary AI</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleHistory}
          disabled={isHistoryDisabled}
          className={`size-9 flex items-center justify-center rounded-lg border transition-all active:scale-90 ${
            showHistory
              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
              : 'bg-slate-50 dark:bg-[#121212] border-slate-100 dark:border-[#2a2a2a] text-slate-400 hover:text-primary'
          } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-slate-400`}
        >
          <MaterialIcon name={showHistory ? 'chat' : 'history'} className="text-[20px]" />
        </button>
        {showCollapseToggle ? (
          <button
            onClick={onToggleCollapsed}
            className="size-9 flex items-center justify-center rounded-lg border transition-all active:scale-90 bg-slate-50 dark:bg-[#121212] border-slate-100 dark:border-[#2a2a2a] text-slate-400 hover:text-primary"
          >
            <MaterialIcon
              name={isCollapsed ? 'chevron_right' : 'chevron_left'}
              className="text-[20px]"
            />
          </button>
        ) : null}
      </div>
    </div>
  </div>
);

export default SidebarHeader;
