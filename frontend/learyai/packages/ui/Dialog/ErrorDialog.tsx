// ErrorDialog 负责渲染纯展示型错误提示弹窗。
import React from 'react';
import Modal from './Modal';

interface ErrorDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
}

const ErrorDialog: React.FC<ErrorDialogProps> = ({
  isOpen,
  title = '出错了',
  message,
  onConfirm,
}) => {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onConfirm}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          {message}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-red-500/20"
        >
          确认
        </button>
      </div>
    </Modal>
  );
};

export type { ErrorDialogProps };
export default ErrorDialog;
