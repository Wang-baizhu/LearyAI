// ConfirmDialog 负责渲染带确认与取消操作的通用弹窗。
import React from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel}>
      <div className="space-y-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-primary/20"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export type { ConfirmDialogProps };
export default ConfirmDialog;
