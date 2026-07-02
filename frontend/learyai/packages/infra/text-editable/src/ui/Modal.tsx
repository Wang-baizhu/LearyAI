// 职责: 为 text-editable 包提供自包含的最小弹窗容器。
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal = ({
  isOpen,
  title,
  onClose,
  children,
}: ModalProps) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
