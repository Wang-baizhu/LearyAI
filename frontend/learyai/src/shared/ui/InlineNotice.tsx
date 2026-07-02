// InlineNotice 负责渲染轻量级提示信息。
import React from 'react';

type NoticeVariant = 'info' | 'success' | 'error';

interface InlineNoticeProps {
  variant?: NoticeVariant;
  message: string;
}

const variantStyles: Record<NoticeVariant, string> = {
  info: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-200',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  error: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-200',
};

const InlineNotice: React.FC<InlineNoticeProps> = ({ variant = 'info', message }) => {
  return (
    <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${variantStyles[variant]}`}>
      {message}
    </div>
  );
};

export default InlineNotice;
