// ResourceDetailLayout 负责资源详情页的本地交互状态、文本编辑会话与整体布局装配。
import React from 'react';
import { EditableTextDialog, type EditableTextSession } from '@leary/text-editable';
import { useAppDispatch } from '@/app/store/hooks';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import { openDialog } from '@/app/store/ui/dialogSlice';
import { renameReferenceResource, requestCitationJump, requestVideoJump, upsertDocNames } from '@/modules/resource';
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import { useUpdateResourceDetail, type UpdateResourceDetailPayload } from '../../../entities/resource';
import { patchDocumentationTree, type ResourceTextEditAnchor } from '../lib/resourceTextEdit';
import DescriptionHero from './DescriptionHero';
import DocumentationPanel from './DocumentationPanel';
import ResourceDetailHeader from './ResourceDetailHeader';
import ResourceDetailViewer from './ResourceDetailViewer';
import { formatResourceMeta, normalizeDocumentationTree, resolvePageStart, TEXT_PREVIEWABLE_TYPES } from '../lib/resourceDetail';
import type { ResourceDetailProps } from './resourceDetailTypes';

const ResourceDetailLayout: React.FC<ResourceDetailProps> = ({
  resource,
  projectId,
  onJumpHandled,
  onRequestJump,
  previewPages,
  textPreviewChunks,
  isPreviewLoading,
  isPreviewLoadingMore,
  isPreviewLoadingPrevious,
  hasMorePreview,
  hasPreviousPreview,
  isPreviewJumpFailed,
  onLoadMorePreview,
  onLoadPreviousPreview,
  isTextPreviewLoading,
  isTextPreviewLoadingMore,
  isTextPreviewLoadingPrevious,
  hasMoreTextPreview,
  hasPreviousTextPreview,
  isTextJumpFailed,
  onLoadMoreTextPreview,
  onLoadPreviousTextPreview,
  jumpToPage,
  jumpToken,
  variant = 'main',
  onOpenVideoDetailTab,
  headerActions,
}) => {
  const dispatch = useAppDispatch();
  const updateMutation = useUpdateResourceDetail(projectId);
  const failureHandledKeyRef = React.useRef<string | null>(null);
  const contentScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const viewerSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [isDocumentationDrawerOpen, setIsDocumentationDrawerOpen] = React.useState(false);
  const [isDocumentationCollapsed, setIsDocumentationCollapsed] = React.useState(false);
  const [textEditSession, setTextEditSession] = React.useState<EditableTextSession<ResourceTextEditAnchor> | null>(null);
  const [textEditError, setTextEditError] = React.useState<string>();
  const isMainVariant = variant === 'main';
  const contentPaddingClass = isMainVariant ? 'px-4 py-6 sm:px-6 sm:py-8 lg:p-12' : 'px-4 py-5 sm:px-6 sm:py-6 lg:p-8';
  const isImagePreviewable = ['pdf', 'pptx', 'docx'].includes(resource.fileType);
  const isTextPreviewable = TEXT_PREVIEWABLE_TYPES.has(resource.fileType);
  const resolvedPreviewPages = previewPages ?? [];
  const resolvedTextChunks = textPreviewChunks ?? [];
  const activeJumpPage = jumpToPage;
  const activeJumpToken = jumpToken;
  const showImageJumpFailed = isImagePreviewable && Boolean(isPreviewJumpFailed) && Boolean(activeJumpPage);
  const showTextJumpFailed = isTextPreviewable && Boolean(isTextJumpFailed) && Boolean(activeJumpPage);
  const resolvedDescription = resource.metadata?.description?.trim() ?? '';
  const documentationState = (() => {
    if (resource.metadata?.documentation == null) {
      return { tree: null, errorMessage: null as string | null };
    }
    try {
      return {
        tree: normalizeDocumentationTree(resource.metadata.documentation),
        errorMessage: null as string | null,
      };
    } catch (error) {
      return {
        tree: null,
        errorMessage: resolveApiErrorMessage(error, 'documentation 必须是合法的 JSON 树结构'),
      };
    }
  })();
  const resolvedDocumentationTree = documentationState.tree;
  const hasDocumentation = resolvedDocumentationTree !== null;
  const resourceMeta = formatResourceMeta(resource);
  const canOpenVideoDetail = resource.fileType === 'url' && Boolean(resource.originUrl) && Boolean(onOpenVideoDetailTab);
  const normalizedDescription = resource.metadata?.description?.trim() ?? '';

  const openTextEdit = React.useCallback((payload: {
    title: string;
    value: string;
    anchor: ResourceTextEditAnchor;
    multiline?: boolean;
  }) => {
    setTextEditError(undefined);
    setTextEditSession({
      title: payload.title,
      value: payload.value,
      anchor: payload.anchor,
      multiline: payload.multiline,
    });
  }, []);

  const closeTextEdit = React.useCallback(() => {
    if (updateMutation.isPending) {
      return;
    }
    setTextEditError(undefined);
    setTextEditSession(null);
  }, [updateMutation.isPending]);

  const handleTimestampClick = React.useCallback((seconds: number) => {
    if (!canOpenVideoDetail) {
      return;
    }
    dispatch(
      requestVideoJump({
        docId: resource.docId,
        startSeconds: seconds,
      })
    );
  }, [canOpenVideoDetail, dispatch, resource.docId]);

  React.useEffect(() => {
    if (!activeJumpPage) {
      failureHandledKeyRef.current = null;
      return;
    }
    if (!showImageJumpFailed && !showTextJumpFailed) {
      return;
    }

    const failureKey = `${resource.docId}:${activeJumpPage}:${activeJumpToken ?? 'no-token'}`;
    if (failureHandledKeyRef.current === failureKey) {
      return;
    }
    failureHandledKeyRef.current = failureKey;
    dispatch(enqueueToast({ variant: 'error', message: '查询失败' }));

    onJumpHandled?.();
  }, [
    activeJumpPage,
    activeJumpToken,
    dispatch,
    onJumpHandled,
    resource.docId,
    showImageJumpFailed,
    showTextJumpFailed,
  ]);

  const handlePreviewJumpHandled = React.useCallback(() => {
    onJumpHandled?.();
  }, [onJumpHandled]);

  React.useEffect(() => {
    if (!activeJumpPage) {
      return;
    }
    const contentContainer = contentScrollContainerRef.current;
    const viewerSection = viewerSectionRef.current;
    if (!contentContainer || !viewerSection) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const containerRect = contentContainer.getBoundingClientRect();
      const viewerRect = viewerSection.getBoundingClientRect();
      const nextTop =
        contentContainer.scrollTop
        + viewerRect.top
        - containerRect.top;
      contentContainer.scrollTo({
        top: Math.max(0, nextTop),
        behavior: 'auto',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeJumpPage, activeJumpToken]);

  const handleSaveTextEdit = React.useCallback(async (
    nextValue: string,
    session: EditableTextSession<ResourceTextEditAnchor>,
  ) => {
    if (!projectId) {
      return;
    }

    const trimmedValue = nextValue.trim();
    if (session.anchor.kind === 'name' && !trimmedValue) {
      setTextEditError('资源名称不能为空');
      return;
    }

    const payload: UpdateResourceDetailPayload = {
      name: resource.name,
      description: normalizedDescription || null,
      ...(resolvedDocumentationTree ? { documentation: resolvedDocumentationTree } : {}),
    };

    if (session.anchor.kind === 'name') {
      if (trimmedValue === resource.name) {
        closeTextEdit();
        return;
      }
      payload.name = trimmedValue;
    }

    if (session.anchor.kind === 'description') {
      if (trimmedValue === normalizedDescription) {
        closeTextEdit();
        return;
      }
      payload.description = trimmedValue || null;
    }

    if (session.anchor.kind === 'directory') {
      if (!resolvedDocumentationTree) {
        throw new Error('documentation 缺失，无法编辑目录节点');
      }
      const nextDocumentation = patchDocumentationTree(
        resolvedDocumentationTree,
        session.anchor,
        nextValue,
      );
      if (JSON.stringify(nextDocumentation) === JSON.stringify(resolvedDocumentationTree)) {
        closeTextEdit();
        return;
      }
      payload.documentation = nextDocumentation;
    }

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
      dispatch(enqueueToast({ variant: 'success', message: '资源更新成功' }));
      setTextEditError(undefined);
      setTextEditSession(null);
    } catch (error) {
      setTextEditError(resolveApiErrorMessage(error, '更新失败，请稍后重试'));
    }
  }, [
    closeTextEdit,
    dispatch,
    normalizedDescription,
    resolvedDocumentationTree,
    resource.docId,
    resource.name,
    projectId,
    updateMutation,
  ]);

  const documentationPanel = hasDocumentation ? (
    <DocumentationPanel
      tree={resolvedDocumentationTree}
      docId={resource.docId}
      className="h-full"
      onRequestTextEdit={openTextEdit}
      onCitationClick={({ type, pageValue }) => {
        setIsDocumentationDrawerOpen(false);
        if (type === resource.docId) {
          const targetPage = resolvePageStart(pageValue);
          if (!targetPage) {
            return;
          }
          onRequestJump?.(targetPage, Date.now());
          return;
        }
        dispatch(requestCitationJump({ source: type, pageText: pageValue }));
      }}
    />
  ) : null;

  React.useEffect(() => {
    if (!documentationState.errorMessage) {
      return;
    }
    dispatch(openDialog({
      type: 'error',
      payload: {
        title: '目录数据无效',
        message: documentationState.errorMessage,
      },
    }));
  }, [dispatch, documentationState.errorMessage]);

  return (
    <div className="flex flex-1 overflow-hidden bg-[#edf0f5] dark:bg-[#121212]">
      <div className="relative flex flex-1 flex-col overflow-hidden bg-[#edf0f5] dark:bg-[#121212]">
        <div
          ref={contentScrollContainerRef}
          className={`flex-1 overflow-y-auto ${contentPaddingClass} custom-scrollbar transition-colors`}
        >
          <div className="mx-auto w-full lg:max-w-[1380px]">
            <ResourceDetailHeader
              canOpenVideoDetail={canOpenVideoDetail}
              headerActions={headerActions}
              onRequestTextEdit={openTextEdit}
              onOpenVideoDetailTab={onOpenVideoDetailTab}
              resource={resource}
              resourceMeta={resourceMeta}
            />
            {resolvedDescription || projectId ? (
              <DescriptionHero
                docId={resource.docId}
                content={resolvedDescription}
                onRequestTextEdit={openTextEdit}
              />
            ) : null}
            <div ref={viewerSectionRef} data-testid="resource-detail-viewer-section">
              <ResourceDetailViewer
                activeJumpPage={activeJumpPage}
                activeJumpToken={activeJumpToken}
                canOpenVideoDetail={canOpenVideoDetail}
                documentationPanel={documentationPanel}
                hasDocumentation={hasDocumentation}
                hasMorePreview={hasMorePreview}
                hasMoreTextPreview={hasMoreTextPreview}
                hasPreviousPreview={hasPreviousPreview}
                hasPreviousTextPreview={hasPreviousTextPreview}
                isDocumentationCollapsed={isDocumentationCollapsed}
                isDocumentationDrawerOpen={isDocumentationDrawerOpen}
                isImagePreviewable={isImagePreviewable}
                isPreviewJumpFailed={isPreviewJumpFailed}
                isPreviewLoading={isPreviewLoading}
                isPreviewLoadingMore={isPreviewLoadingMore}
                isPreviewLoadingPrevious={isPreviewLoadingPrevious}
                isTextJumpFailed={isTextJumpFailed}
                isTextPreviewLoading={isTextPreviewLoading}
                isTextPreviewLoadingMore={isTextPreviewLoadingMore}
                isTextPreviewLoadingPrevious={isTextPreviewLoadingPrevious}
                isTextPreviewable={isTextPreviewable}
                onJumpHandled={handlePreviewJumpHandled}
                onLoadMorePreview={onLoadMorePreview}
                onLoadMoreTextPreview={onLoadMoreTextPreview}
                onLoadPreviousPreview={onLoadPreviousPreview}
                onLoadPreviousTextPreview={onLoadPreviousTextPreview}
                onTimestampClick={handleTimestampClick}
                onToggleDocumentationCollapsed={() => setIsDocumentationCollapsed((current) => !current)}
                onToggleDocumentationDrawer={() => setIsDocumentationDrawerOpen((current) => !current)}
                previewPages={resolvedPreviewPages}
                resourceDocId={resource.docId}
                textPreviewChunks={resolvedTextChunks}
              />
            </div>
          </div>
        </div>
      </div>
      <EditableTextDialog
        session={textEditSession}
        errorMessage={textEditError}
        isSaving={updateMutation.isPending}
        onClose={closeTextEdit}
        onSave={handleSaveTextEdit}
      />
    </div>
  );
};

export default ResourceDetailLayout;
