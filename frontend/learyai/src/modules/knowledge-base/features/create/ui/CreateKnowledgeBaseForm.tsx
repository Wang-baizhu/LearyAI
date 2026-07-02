// CreateKnowledgeBaseForm 负责新建知识库表单的输入与提交。
import React, { useEffect } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { KnowledgeBaseCreatePayload } from '../api/knowledgeBaseCreateApi';
import type { KnowledgeBase } from '../../../entities';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { useAppDispatch } from '@/app/store/hooks';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import KnowledgeBaseForm from '../..';
import type { KnowledgeBaseFormPayload } from '../..';
import type { Project } from '../../../../project';
import { TourOverlay, TourProvider } from '@leary/tour-guide';

const CREATE_KNOWLEDGE_BASE_GUIDE_TAG = 'guide:create-knowledge-base:v1';

interface CreateKnowledgeBaseFormProps {
  mutation: UseMutationResult<{ item: KnowledgeBase; message: string }, Error, KnowledgeBaseCreatePayload>;
  onSubmit: (payload: KnowledgeBaseCreatePayload) => void;
  defaultProjectId?: string | null;
  projects?: Project[];
  projectsLoading?: boolean;
  projectsErrorMessage?: string | null;
  createKnowledgeBaseGuideTag?: string;
  projectFieldGuideOrder?: number;
  projectFieldGuideTitle?: string;
  projectFieldGuideContent?: React.ReactNode;
  projectFieldGuideActionLabel?: string;
}

const CreateKnowledgeBaseForm: React.FC<CreateKnowledgeBaseFormProps> = ({
  mutation,
  onSubmit,
  defaultProjectId,
  projects = [],
  projectsLoading = false,
  projectsErrorMessage = null,
  createKnowledgeBaseGuideTag,
  projectFieldGuideOrder,
  projectFieldGuideTitle,
  projectFieldGuideContent,
  projectFieldGuideActionLabel,
}) => {
  const dispatch = useAppDispatch();

  const isLoading = mutation.isPending;

  useEffect(() => {
    if (mutation.isSuccess) {
      dispatch(
        enqueueToast({
          variant: 'success',
          message: '创建成功',
        })
      );
    } else if (mutation.isError) {
      const errorMessage = resolveApiErrorMessage(mutation.error, '创建失败，请稍后再试');
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
  }, [dispatch, mutation.data?.message, mutation.error, mutation.isError, mutation.isSuccess]);

  const handleSubmit = (payload: KnowledgeBaseFormPayload) => {
    if (!payload.projectId) {
      dispatch(
        enqueueToast({
          variant: 'info',
          message: '请先选择项目',
        })
      );
      return;
    }
    onSubmit({
      name: payload.name,
      description: payload.description ?? null,
      tags: payload.tags ?? [],
      projectId: payload.projectId,
      visibility: payload.visibility ?? 'PRIVATE',
    });
  };

  const resolvedGuideTag = createKnowledgeBaseGuideTag ?? CREATE_KNOWLEDGE_BASE_GUIDE_TAG;
  const resolvedProjectFieldGuideOrder = projectFieldGuideOrder ?? 1;

  return (
    <TourProvider tags={[resolvedGuideTag]}>
      <KnowledgeBaseForm
        isSubmitting={isLoading}
        submitLabel="创建知识库"
        projects={projects}
        projectsLoading={projectsLoading}
        projectsErrorMessage={projectsErrorMessage}
        defaultProjectId={defaultProjectId}
        requireProject
        createKnowledgeBaseGuideTag={resolvedGuideTag}
        projectFieldGuideOrder={resolvedProjectFieldGuideOrder}
        projectFieldGuideTitle={projectFieldGuideTitle}
        projectFieldGuideContent={projectFieldGuideContent}
        projectFieldGuideActionLabel={projectFieldGuideActionLabel}
        onSubmit={handleSubmit}
      />
      <TourOverlay />
    </TourProvider>
  );
};

export default CreateKnowledgeBaseForm;
