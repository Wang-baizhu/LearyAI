// MobileClickableCard 负责承载移动端卡片的统一交互外壳与键盘可访问性。
import React from 'react';

interface MobileClickableCardProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const MobileClickableCard: React.FC<MobileClickableCardProps> = ({
  onClick,
  disabled = false,
  className = '',
  children,
}) => {
  const isInteractive = Boolean(onClick) && !disabled;

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!isInteractive) return;
        onClick?.();
      }}
      onKeyDown={(event) => {
        if (!isInteractive) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick?.();
      }}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-[#2a2a2a] dark:bg-[#1a1a1a] ${
        isInteractive ? 'cursor-pointer active:border-primary/60' : 'cursor-not-allowed opacity-80'
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export default MobileClickableCard;
