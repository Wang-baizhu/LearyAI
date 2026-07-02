// ResourceDetailPreviewContent 负责根据资源类型切换具体预览组件。
import React from 'react';
import { useAppDispatch } from '@/app/store/hooks';
import { requestCitationJump } from '@/modules/resource';
import ImagePreview from './ImagePreview';
import TextPreview from './TextPreview';

const EmptyFileState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-slate-400 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
    <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">文件未就绪</div>
    <p className="text-sm">{message ?? '暂无可预览的图片。'}</p>
  </div>
);

const LoadingState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-slate-400 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
    <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-[#a0a0a0]">预览准备中</div>
    <div className="flex items-center justify-center gap-2 text-sm">
      <span className="inline-flex size-2 animate-pulse rounded-full bg-primary/60"></span>
      <span>{message}</span>
    </div>
  </div>
);

interface ResourceDetailPreviewContentProps {
  activeJumpPage?: number;
  activeJumpToken?: number;
  canOpenVideoDetail: boolean;
  hasMorePreview?: boolean;
  hasMoreTextPreview?: boolean;
  hasPreviousPreview?: boolean;
  hasPreviousTextPreview?: boolean;
  isImagePreviewable: boolean;
  isPreviewJumpFailed?: boolean;
  isPreviewLoading?: boolean;
  isPreviewLoadingMore?: boolean;
  isPreviewLoadingPrevious?: boolean;
  isTextJumpFailed?: boolean;
  isTextPreviewLoading?: boolean;
  isTextPreviewLoadingMore?: boolean;
  isTextPreviewLoadingPrevious?: boolean;
  isTextPreviewable: boolean;
  onJumpHandled?: () => void;
  onLoadMorePreview?: () => void;
  onLoadMoreTextPreview?: () => void;
  onLoadPreviousPreview?: () => void;
  onLoadPreviousTextPreview?: () => void;
  onTimestampClick?: (seconds: number) => void;
  previewPages: Array<{ pageNumber: number; url: string }>;
  resourceDocId: string;
  textPreviewChunks: Array<{ chunkSec: number; text: string }>;
}

const ResourceDetailPreviewContent: React.FC<ResourceDetailPreviewContentProps> = ({
  activeJumpPage,
  activeJumpToken,
  canOpenVideoDetail,
  hasMorePreview,
  hasMoreTextPreview,
  hasPreviousPreview,
  hasPreviousTextPreview,
  isImagePreviewable,
  isPreviewJumpFailed,
  isPreviewLoading,
  isPreviewLoadingMore,
  isPreviewLoadingPrevious,
  isTextJumpFailed,
  isTextPreviewLoading,
  isTextPreviewLoadingMore,
  isTextPreviewLoadingPrevious,
  isTextPreviewable,
  onJumpHandled,
  onLoadMorePreview,
  onLoadMoreTextPreview,
  onLoadPreviousPreview,
  onLoadPreviousTextPreview,
  onTimestampClick,
  previewPages,
  resourceDocId,
  textPreviewChunks,
}) => {
  const dispatch = useAppDispatch();
  const imageJumpReady = !activeJumpPage || previewPages.some((item) => item.pageNumber === activeJumpPage);
  const textJumpReady = !activeJumpPage || textPreviewChunks.some((item) => item.chunkSec === activeJumpPage);
  const showImageLoading = isImagePreviewable && !isPreviewJumpFailed && (!!isPreviewLoading || (!imageJumpReady && !!activeJumpPage));
  const showTextLoading = isTextPreviewable && !isTextJumpFailed && (!!isTextPreviewLoading || (!textJumpReady && !!activeJumpPage));
  const showImageEmpty = isImagePreviewable && !showImageLoading && previewPages.length === 0;
  const showTextEmpty = isTextPreviewable && !showTextLoading && textPreviewChunks.length === 0;
  const showUnsupported = !isImagePreviewable && !isTextPreviewable;

  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-[#dfe3eb] p-3 dark:bg-[#141414] sm:p-5 lg:p-7">
      {showImageLoading ? (
        <LoadingState
          message={
            activeJumpPage && !imageJumpReady
              ? `正在定位到第 ${activeJumpPage} 页，请稍候...`
              : '预览生成中，请稍候...'
          }
        />
      ) : null}
      {showTextLoading ? (
        <LoadingState
          message={
            activeJumpPage && !textJumpReady
              ? `正在定位到第 ${activeJumpPage} 段，请稍候...`
              : '文本加载中，请稍候...'
          }
        />
      ) : null}
      {!showImageLoading && isImagePreviewable && previewPages.length > 0 ? (
        <ImagePreview
          pages={previewPages}
          jumpToPage={activeJumpPage}
          jumpToken={activeJumpToken}
          onJumpHandled={onJumpHandled}
          hasMore={hasMorePreview}
          hasPrevious={hasPreviousPreview}
          isLoadingMore={isPreviewLoadingMore}
          isLoadingPrevious={isPreviewLoadingPrevious}
          onLoadMore={onLoadMorePreview}
          onLoadPrevious={onLoadPreviousPreview}
          viewportClassName="h-full"
        />
      ) : null}
      {!showTextLoading && isTextPreviewable && textPreviewChunks.length > 0 ? (
        <TextPreview
          chunks={textPreviewChunks}
          pageMarkerDocId={resourceDocId}
          jumpToChunk={activeJumpPage}
          jumpToken={activeJumpToken}
          onJumpHandled={onJumpHandled}
          hasMore={hasMoreTextPreview}
          hasPrevious={hasPreviousTextPreview}
          isLoadingMore={isTextPreviewLoadingMore}
          isLoadingPrevious={isTextPreviewLoadingPrevious}
          onLoadMore={onLoadMoreTextPreview}
          onLoadPrevious={onLoadPreviousTextPreview}
          activeTimestampSeconds={null}
          onTimestampClick={canOpenVideoDetail ? onTimestampClick : undefined}
          maxHeightClassName="h-full"
          onCitationClick={({ type, pageValue }) => {
            dispatch(requestCitationJump({ source: type, pageText: pageValue }));
          }}
        />
      ) : null}
      {showImageEmpty ? <EmptyFileState message="暂无可预览的资源，请稍后再试" /> : null}
      {showTextEmpty ? <EmptyFileState message="暂无可预览的文本，请稍后再试" /> : null}
      {showUnsupported ? <EmptyFileState message="当前格式暂不支持预览" /> : null}
    </div>
  );
};

export default ResourceDetailPreviewContent;
