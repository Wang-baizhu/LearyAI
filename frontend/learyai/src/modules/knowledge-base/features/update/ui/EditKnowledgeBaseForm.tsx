// EditKnowledgeBaseForm 负责编辑知识库表单的输入与提交。
import React, { useEffect } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { KnowledgeBase } from '../../../entities';
import type { KnowledgeBaseUpdatePayload } from '../api/knowledgeBaseUpdateApi';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import KnowledgeBaseForm, { type KnowledgeBaseFormPayload } from '../..';

interface EditKnowledgeBaseFormProps {
  knowledgeBase: KnowledgeBase;
  projectId?: string;
  mutation: UseMutationResult<
    { item: KnowledgeBase; message: string },
    Error,
    { kbId: string; projectId: string; payload: KnowledgeBaseUpdatePayload }
  >;
  onSubmit: (payload: KnowledgeBaseFormPayload) => void;
}

const EditKnowledgeBaseForm: React.FC<EditKnowledgeBaseFormProps> = ({
  knowledgeBase,
  projectId,
  mutation,
  onSubmit,
}) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (mutation.isSuccess) {
      dispatch(
        openDialog({
          type: 'notice',
          payload: {
            title: '提示',
            message: '更新成功',
          },
        })
      );
    } else if (mutation.isError) {
      const errorMessage = resolveApiErrorMessage(mutation.error, '更新失败，请稍后再试');
      dispatch(
        openDialog({
          type: 'error',
          payload: {
            title: '出错了',
            message: errorMessage,
          },
        })
      );
    }
  }, [dispatch, mutation.error, mutation.isError, mutation.isSuccess]);

  return (
    <KnowledgeBaseForm
      initialValues={{
        name: knowledgeBase.name,
        description: knowledgeBase.description ?? '',
        tags: knowledgeBase.tags ?? [],
        visibility: knowledgeBase.visibility,
      }}
      defaultProjectId={projectId}
      isSubmitting={mutation.isPending}
      submitLabel="保存修改"
      onSubmit={onSubmit}
    />
  );
};

export default EditKnowledgeBaseForm;
