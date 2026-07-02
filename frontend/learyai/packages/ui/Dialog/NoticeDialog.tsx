// NoticeDialog 负责渲染纯展示型通用提示弹窗。
import React from 'react';
import Modal from './Modal';

interface NoticeDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
}

const NoticeDialog: React.FC<NoticeDialogProps> = ({
  isOpen,
  title = '提示',
  message,
  onConfirm,
}) => {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onConfirm} autoCloseMs={3000}>
      <div className="space-y-6">
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-primary/20"
        >
          确认
        </button>
      </div>
    </Modal>
  );
};

export type { NoticeDialogProps };
export default NoticeDialog;
