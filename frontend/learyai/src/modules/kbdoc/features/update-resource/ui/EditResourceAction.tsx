// EditResourceAction 负责编辑资源的原始目录文档说明。
import React, { useMemo, useState } from 'react';
import { Modal } from '@leary/ui';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import { renameReferenceResource, upsertDocNames } from '@/modules/resource';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { parseDocumentationTree, useUpdateResourceDetail, type ResourceDetail, type UpdateResourceDetailPayload } from '../../../entities/resource';

interface EditResourceActionProps {
  resource: ResourceDetail;
  projectId?: string;
  className?: string;
}

const normalizeDocumentationInput = (documentation: ResourceDetail['metadata'] extends infer Metadata
  ? Metadata extends { documentation?: infer Value }
    ? Value | undefined
    : never
  : never): string => {
  if (typeof documentation === 'string') {
    return documentation;
  }
  if (documentation && typeof documentation === 'object') {
    return JSON.stringify(documentation, null, 2);
  }
  return '';
};

const EditResourceAction: React.FC<EditResourceActionProps> = ({
  resource,
  projectId,
  className,
}) => {
  const dispatch = useAppDispatch();
  const updateMutation = useUpdateResourceDetail(projectId);
  const [isOpen, setIsOpen] = useState(false);
  const [documentation, setDocumentation] = useState(() => normalizeDocumentationInput(resource.metadata?.documentation));
  const initialDocumentation = normalizeDocumentationInput(resource.metadata?.documentation);

  const changes = useMemo(() => {
    const normalizedDocumentation = documentation.trim();
    return {
      normalizedDocumentation,
      hasChanges: normalizedDocumentation !== initialDocumentation,
    };
  }, [documentation, initialDocumentation]);

  const handleOpen: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    setDocumentation(normalizeDocumentationInput(resource.metadata?.documentation));
    setIsOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId || updateMutation.isPending || !changes.hasChanges) {
      return;
    }
    let parsedDocumentation = null;
    try {
      parsedDocumentation = changes.normalizedDocumentation
        ? parseDocumentationTree(changes.normalizedDocumentation)
        : null;
    } catch (error) {
      const message = resolveApiErrorMessage(error, 'documentation 必须是合法的 JSON 树结构');
      dispatch(
        openDialog({
          type: 'error',
          payload: {
            title: '目录格式错误',
            message,
          },
        })
      );
      return;
    }
    const payload: UpdateResourceDetailPayload = {
      name: resource.name,
      documentation: parsedDocumentation,
    };
    try {
      const updated = await updateMutation.mutateAsync({
        docId: resource.docId,
        payload,
      });
      dispatch(upsertDocNames([{ docId: updated.docId, name: updated.name }]));
      dispatch(renameReferenceResource({
        projectId,
        docId: updated.docId,
        name: updated.name,
      }));
      dispatch(
        enqueueToast({
          variant: 'success',
          message: '资源更新成功',
        })
      );
      setIsOpen(false);
    } catch (error) {
      const message = resolveApiErrorMessage(error, '更新失败，请稍后重试');
      dispatch(
        openDialog({
          type: 'error',
          payload: {
            title: '出错了',
            message,
          },
        })
      );
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={className}
        aria-label="编辑目录"
        disabled={!projectId}
      >
        <MaterialIcon name="edit" className="text-[14px]" />
      </button>
      <Modal isOpen={isOpen} title="编辑目录" onClose={() => setIsOpen(false)}>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">Documentation</label>
            <textarea
              className="min-h-40 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={documentation}
              onChange={(event) => setDocumentation(event.target.value)}
              placeholder="补充可引用的文档说明"
            />
          </div>
          <button
            type="submit"
            disabled={updateMutation.isPending || !changes.hasChanges}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateMutation.isPending ? '保存中...' : '保存修改'}
          </button>
        </form>
      </Modal>
    </>
  );
};

export default EditResourceAction;
