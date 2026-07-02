// ResourceDetailPanel 负责在列表与侧边栏中复用资源详情加载逻辑。
import React from 'react';
import { ResourceFlowCanvasDetail } from '@/modules/resource/adapter/flow-canvas';
import { useResourceCenterDetailState } from '@/modules/resource/adapter/detail/model/hooks/useResourceCenterDetailState';
import { ResourceDetail, ResourceVideoDetail } from '../../../../kbdoc';
import type { ResourceDetailPanelProps } from '../../../entities/resource-center';

const WhiteboardDetailPanel: React.FC<
  Pick<
    ResourceDetailPanelProps,
    'whiteboardConfig' | 'projectId' | 'kbId' | 'onOpenResourceDetailTab'
  >
> = ({
  whiteboardConfig,
  projectId,
  kbId,
  onOpenResourceDetailTab,
}) => (
  <ResourceFlowCanvasDetail
    title={whiteboardConfig?.title}
    projectId={projectId}
    kbId={kbId}
    onOpenDetailTab={(payload) => {
      if (payload.kind === 'kbdoc') {
        onOpenResourceDetailTab?.(payload.docId, payload.label);
      }
    }}
  />
);

const ResourceLoadedDetailPanel: React.FC<ResourceDetailPanelProps> = ({
  docId,
  kbId,
  projectId,
  variant = 'main',
  enableJump = variant === 'main',
  detailKind = 'kbdoc',
  jumpToPage,
  jumpToken,
  onJumpHandled,
  onOpenVideoDetailTab,
  isDarkMode,
  toggleTheme,
  user,
  onLogout,
  onToggleCollapsed,
  showCollapseToggle,
}) => {
  const [internalJump, setInternalJump] = React.useState<{ docId: string; page: number; token: number } | null>(null);
  const {
    isVideoDetail,
    detailQuery,
    resolvedJump,
    previewPagination,
    textPagination,
  } = useResourceCenterDetailState({
    docId,
    kbId,
    projectId,
    enableJump,
    detailKind,
    jumpToPage,
    jumpToken,
    onJumpHandled,
    localJump: internalJump,
  });

  const handleJumpHandled = React.useCallback(() => {
    if (
      internalJump
      && internalJump.docId === docId
      && resolvedJump.jumpToPage === internalJump.page
      && (resolvedJump.jumpToken ?? 0) === internalJump.token
    ) {
      setInternalJump(null);
      return;
    }
    resolvedJump.onJumpHandled?.();
  }, [docId, internalJump, resolvedJump]);

  if (detailQuery.isError) {
    console.error('资源详情加载失败', detailQuery.error);
  }
  if (previewPagination.error) {
    console.error('预览图片获取失败', previewPagination.error);
  }
  if (textPagination.error) {
    console.error('文本预览获取失败', textPagination.error);
  }

  const containerClass =
    variant === 'main'
      ? 'flex-1 p-8 text-sm text-slate-400 dark:text-[#a0a0a0]'
      : 'flex-1 p-6 text-sm text-slate-400 dark:text-[#a0a0a0]';

  if (detailQuery.isLoading) {
    return <div className={containerClass}>加载资源详情...</div>;
  }

  if (!detailQuery.data) {
    return (
      <div className={containerClass}>
        未找到资源，请返回列表。
      </div>
    );
  }

  if (isVideoDetail) {
    return (
      <ResourceVideoDetail
        resource={detailQuery.data}
        // TODO: 当前详情区会把非激活 tab 保持挂载，视频 iframe 也会随之驻留后台；
        // 后续若要优化资源占用，需要结合时间点恢复能力一起设计卸载策略。
        variant={variant}
      />
    );
  }

  return (
    <ResourceDetail
      resource={detailQuery.data}
      projectId={projectId}
      previewPages={previewPagination.previewPages}
      isPreviewLoading={previewPagination.isLoading}
      isPreviewLoadingMore={previewPagination.isLoadingMore}
      isPreviewLoadingPrevious={previewPagination.isLoadingPrevious}
      hasMorePreview={previewPagination.hasMore}
      hasPreviousPreview={previewPagination.hasPrevious}
      isPreviewJumpFailed={previewPagination.isJumpFailed}
      onLoadMorePreview={previewPagination.loadMore}
      onLoadPreviousPreview={previewPagination.loadPrevious}
      textPreviewChunks={textPagination.textChunks}
      isTextPreviewLoading={textPagination.isLoading}
      isTextPreviewLoadingMore={textPagination.isLoadingMore}
      isTextPreviewLoadingPrevious={textPagination.isLoadingPrevious}
      hasMoreTextPreview={textPagination.hasMore}
      hasPreviousTextPreview={textPagination.hasPrevious}
      isTextJumpFailed={textPagination.isJumpFailed}
      onLoadMoreTextPreview={textPagination.loadMore}
      onLoadPreviousTextPreview={textPagination.loadPrevious}
      jumpToPage={resolvedJump.jumpToPage}
      jumpToken={resolvedJump.jumpToken}
      onJumpHandled={handleJumpHandled}
      onRequestJump={(page, token) => {
        if (!detailQuery.data?.docId) {
          return;
        }
        setInternalJump({ docId: detailQuery.data.docId, page, token });
      }}
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
      user={user}
      onLogout={onLogout}
      variant={variant}
      onOpenVideoDetailTab={onOpenVideoDetailTab}
      onToggleCollapsed={onToggleCollapsed}
      showCollapseToggle={showCollapseToggle}
    />
  );
};

const ResourceDetailPanel: React.FC<ResourceDetailPanelProps> = (props) => {
  if (props.detailKind === 'whiteboard') {
    return (
      <WhiteboardDetailPanel
        whiteboardConfig={props.whiteboardConfig}
        projectId={props.projectId}
        kbId={props.kbId}
        onOpenResourceDetailTab={props.onOpenResourceDetailTab}
      />
    );
  }

  return <ResourceLoadedDetailPanel {...props} />;
};

export default ResourceDetailPanel;
