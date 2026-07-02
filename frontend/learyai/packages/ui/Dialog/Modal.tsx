// Modal 负责提供可复用的通用弹窗容器与遮罩层。
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  title?: string;
  headerActions?: React.ReactNode;
  onClose: () => void;
  autoCloseMs?: number;
  children: React.ReactNode;
}

const CloseIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  headerActions,
  onClose,
  autoCloseMs = -1,
  children,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      const resetTimer = window.setTimeout(() => {
        setSecondsLeft(null);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || autoCloseMs === -1) {
      return;
    }
    const initTimer = window.setTimeout(() => {
      setSecondsLeft((prev) => {
        const next = Math.ceil(autoCloseMs / 1000);
        return prev === next ? prev : next;
      });
    }, 0);
    const timer = window.setTimeout(() => {
      onCloseRef.current();
    }, autoCloseMs);
    return () => {
      window.clearTimeout(initTimer);
      window.clearTimeout(timer);
    };
  }, [autoCloseMs, isOpen]);

  useEffect(() => {
    if (!isOpen || autoCloseMs === -1) {
      return;
    }
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) {
          return prev;
        }
        return prev > 1 ? prev - 1 : 0;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [autoCloseMs, isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        role="presentation"
      />
      <div
        className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <div className="flex items-center gap-3">
            {headerActions}
            {secondsLeft !== null ? (
              <span className="text-xs text-slate-400">{secondsLeft}s后自动关闭</span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="关闭弹窗"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export type { ModalProps };
export default Modal;
