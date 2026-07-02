// DialogHost 负责根据全局状态渲染提示/错误弹窗。
import React from 'react';
import { ErrorDialog, NoticeDialog } from '@leary/ui';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { closeDialog } from '@/app/store/ui/dialogSlice';

const DialogHost: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isOpen, type, payload } = useAppSelector((state) => state.dialog);

  if (!isOpen || !type) {
    return null;
  }

  const handleConfirm = () => {
    dispatch(closeDialog());
  };

  if (type === 'notice') {
    return (
      <NoticeDialog
        isOpen
        title={payload?.title ?? '提示'}
        message={payload?.message ?? '操作成功'}
        onConfirm={handleConfirm}
      />
    );
  }

  return (
    <ErrorDialog
      isOpen
      title={payload?.title ?? '出错了'}
      message={payload?.message ?? '操作失败，请稍后重试'}
      onConfirm={handleConfirm}
    />
  );
};

export default DialogHost;
