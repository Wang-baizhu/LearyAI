// SharedLinkCard 负责提供统一的跳转卡片样式与动效。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface SharedLinkCardProps {
  onClick?: () => void;
  disabled?: boolean;
  headerLeft?: React.ReactNode;
  headerActions?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  viewLabel?: string;
  disabledLabel?: string;
  className?: string;
}

const SharedLinkCard: React.FC<SharedLinkCardProps> = ({
  onClick,
  disabled = false,
  headerLeft,
  headerActions,
  title,
  children,
  footerLeft,
  footerRight,
  viewLabel = '查看详情',
  disabledLabel = '不可访问',
  className = '',
}) => {
  const cardClickable = Boolean(onClick) && !disabled;
  const resolvedFooterRight = footerRight ?? (
    cardClickable ? (
      <div className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-3 group-hover:translate-x-0">
        <span className="text-[10px] font-black uppercase tracking-widest">{viewLabel}</span>
        <MaterialIcon name="arrow_forward" className="text-sm" />
      </div>
    ) : (
      <div className="flex items-center gap-1 text-slate-400">
        <span className="text-[10px] font-black uppercase tracking-widest">{disabledLabel}</span>
      </div>
    )
  );
  const footerRightClassName = footerLeft ? '' : 'ml-auto';

  return (
    <div
      onClick={() => {
        if (!cardClickable) return;
        onClick?.();
      }}
      tabIndex={0}
      className={`group bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl p-6 transition-all flex flex-col justify-between min-h-[190px] shadow-sm relative overflow-hidden ${
        cardClickable
          ? 'hover:border-primary hover:shadow-2xl hover:shadow-primary/5 cursor-pointer'
          : 'cursor-not-allowed opacity-80'
      } ${className}`}
    >
      <div className="relative z-10">
        {(headerLeft || headerActions) && (
          <div className="flex justify-between items-start mb-4">
            <div>{headerLeft}</div>
            <div className="flex items-center gap-2">{headerActions}</div>
          </div>
        )}
        {title ? (
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        ) : null}
        {children}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-[#2a2a2a] pt-4 relative z-10">
        {footerLeft}
        <div className={footerRightClassName}>{resolvedFooterRight}</div>
      </div>

      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-700"></div>
    </div>
  );
};

export default SharedLinkCard;
