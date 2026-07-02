// ThemeToggle 负责渲染主题切换按钮并提供外部控制接口。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface ThemeToggleProps {
  onToggle: () => void;
  isDarkMode: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ onToggle, isDarkMode }) => {
  return (
    <button
      onClick={onToggle}
      className="size-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-[#2a3f41] bg-white dark:bg-[#1b1f21] text-slate-400 hover:text-primary hover:border-primary transition-all active:scale-95 shadow-sm"
      title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
    >
      <MaterialIcon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="text-xl" />
    </button>
  );
};

export default ThemeToggle;
