// ToastHost 负责渲染通用右上角横条提示列表，并通过外部回调处理消失逻辑。
import { useEffect, type ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface ToastHostProps {
  toasts: ToastItem[];
  onDismiss: (toastId: string) => void;
  renderIcon: (variant: ToastVariant) => ReactNode;
}

const toastCardClass =
  'group relative inline-flex w-fit max-w-[min(460px,calc(100vw-16px))] items-start gap-3 overflow-hidden rounded-l-2xl border border-slate-200/90 bg-white/95 px-4 py-3 text-slate-800 shadow-[10px_18px_30px_-22px_rgba(15,23,42,0.6)] ring-1 ring-white/70 backdrop-blur-md dark:border-slate-700/80 dark:bg-[#131313]/95 dark:text-slate-100 dark:ring-slate-700/40';

const getBadgeClass = (variant: ToastVariant) => {
  if (variant === 'success') {
    return 'bg-emerald-100 text-emerald-600 ring-emerald-300/70 shadow-[0_0_0_3px_rgba(16,185,129,0.12)] dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30 dark:shadow-[0_0_0_3px_rgba(16,185,129,0.18)]';
  }
  if (variant === 'error') {
    return 'bg-rose-100 text-rose-600 ring-rose-300/70 shadow-[0_0_0_3px_rgba(244,63,94,0.12)] dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-500/30 dark:shadow-[0_0_0_3px_rgba(244,63,94,0.18)]';
  }
  return 'bg-sky-100 text-sky-600 ring-sky-300/70 shadow-[0_0_0_3px_rgba(14,165,233,0.12)] dark:bg-sky-500/20 dark:text-sky-300 dark:ring-sky-500/30 dark:shadow-[0_0_0_3px_rgba(14,165,233,0.18)]';
};

const getAccentClass = (variant: ToastVariant) => {
  if (variant === 'success') {
    return 'bg-emerald-500/85';
  }
  if (variant === 'error') {
    return 'bg-rose-500/85';
  }
  return 'bg-sky-500/85';
};

const getProgressClass = (variant: ToastVariant) => {
  if (variant === 'success') {
    return 'from-emerald-400 via-emerald-500 to-teal-500';
  }
  if (variant === 'error') {
    return 'from-rose-400 via-rose-500 to-orange-500';
  }
  return 'from-sky-400 via-sky-500 to-cyan-500';
};

export const ToastHost = ({
  toasts,
  onDismiss,
  renderIcon,
}: ToastHostProps) => {
  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((item) =>
      window.setTimeout(() => {
        onDismiss(item.id);
      }, item.durationMs)
    );

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [onDismiss, toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-0 top-10 z-[70] flex flex-col items-end gap-2 sm:top-16">
      {toasts.map((toast) => (
        <div key={toast.id} className={`${toastCardClass} animate-[toast-slide-in_320ms_cubic-bezier(0.22,1,0.36,1)]`}>
          <div className={`absolute inset-y-0 left-0 w-1 ${getAccentClass(toast.variant)}`} aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-white/80 via-white/30 to-transparent dark:from-white/25 dark:via-white/10" aria-hidden="true" />
          <div className={`relative mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${getBadgeClass(toast.variant)}`}>
            <svg className="toast-ring absolute inset-0" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
            {renderIcon(toast.variant)}
          </div>
          <div className="min-w-0 pr-2">
            <p className="break-words text-sm font-semibold leading-6 tracking-[0.01em]">{toast.message}</p>
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full bg-slate-900/[0.06] dark:bg-white/[0.08]" aria-hidden="true">
            <span
              className={`toast-progress block h-full bg-gradient-to-r ${getProgressClass(toast.variant)}`}
              style={{ animationDuration: `${toast.durationMs}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
