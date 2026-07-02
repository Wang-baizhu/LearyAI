// MobileActionSheet 负责渲染移动端底部动作弹窗并承载少量主操作入口。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

export interface MobileActionSheetAction {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  title: string;
  actions: MobileActionSheetAction[];
  onClose: () => void;
  actionsClassName?: string;
}

const MobileActionSheet: React.FC<MobileActionSheetProps> = ({
  isOpen,
  title,
  actions,
  onClose,
  actionsClassName = 'grid grid-cols-1 gap-3 sm:grid-cols-2',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[65] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={`关闭${title}`}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-slate-200/80 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-[0_-18px_48px_rgba(15,23,42,0.18)] dark:border-[#2a2a2a] dark:bg-[#121212]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-[#2a2a2a]" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:text-slate-700 dark:border-[#2a2a2a] dark:text-[#bdbdbd] dark:hover:text-white"
            aria-label={`关闭${title}`}
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>
        <div className={actionsClassName}>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return;
                action.onClick();
                onClose();
              }}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all ${
                action.disabled
                  ? 'cursor-not-allowed border-slate-200/70 bg-slate-50/70 text-slate-400 dark:border-[#232831] dark:bg-[#14181f] dark:text-slate-500'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/40 hover:text-primary dark:border-[#2a2a2a] dark:bg-[#171717] dark:text-[#e0e0e0]'
              }`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                  action.disabled
                    ? 'bg-slate-100 text-slate-400 dark:bg-[#1a1f27]'
                    : 'bg-primary/10 text-primary dark:bg-primary/15'
                }`}
              >
                <MaterialIcon name={action.icon} className="text-[18px]" />
              </span>
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileActionSheet;
