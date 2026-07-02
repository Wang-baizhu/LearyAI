// LoadingSpinner 负责展示旋转加载指示与可选提示文案。
import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  label?: string;
  borderColor?: string;
  borderTopColor?: string;
  labelClassName?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 16,
  label = '加载中...',
  borderColor,
  borderTopColor,
  labelClassName,
}) => {
  const dimension = `${size}px`;
  const borderStyle =
    borderColor || borderTopColor ? { borderColor, borderTopColor } : undefined;

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-block animate-spin rounded-full border-2 border-slate-400 dark:border-white/40 border-t-slate-800 dark:border-t-white"
        style={{ width: dimension, height: dimension, ...borderStyle }}
      />
      {label ? (
        <span className={`text-sm font-semibold ${labelClassName ?? ''}`.trim()}>
          {label}
        </span>
      ) : null}
    </div>
  );
};

export default LoadingSpinner;
