// DeleteResourceAction 负责删除资源并触发列表刷新。
import React, { useState } from 'react';
import { useDeleteResource } from '../../../entities/resource';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { ConfirmDialog } from '@leary/ui';
import { useAppDispatch } from '@/app/store/hooks';
import { removeReferenceByDocId } from '../../../../resource';
import { clearPreviewImageCacheForDoc } from '../../../entities/resource';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';

interface DeleteResourceActionProps {
  docId: string;
  projectId?: string;
  onDeleted?: () => void;
  className?: string;
  label?: string;
}

const DeleteResourceAction: React.FC<DeleteResourceActionProps> = ({
  docId,
  projectId,
  onDeleted,
  className,
  label,
}) => {
  const deleteMutation = useDeleteResource(projectId);
  const dispatch = useAppDispatch();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleDelete: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    if (deleteMutation.isPending) return;
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync({ docId });
      setIsConfirmOpen(false);
      await clearPreviewImageCacheForDoc(docId, projectId);
      dispatch(removeReferenceByDocId(docId));
      dispatch(
        enqueueToast({
          variant: 'success',
          message: '删除成功',
        })
      );
      onDeleted?.();
    } catch (error) {
      const message = resolveApiErrorMessage(error, '删除失败，请稍后重试');
      dispatch(
        openDialog({
          type: 'error',
          payload: {
            title: '出错了',
            message,
          },
        })
      );
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        className={className}
        disabled={deleteMutation.isPending}
      >
        {label ?? (
          <MaterialIcon name="delete" className="text-[14px]" />
        )}
      </button>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="删除资源"
        message="确认删除该资源？此操作无法撤销。"
        confirmText="删除"
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
};

export default DeleteResourceAction;
