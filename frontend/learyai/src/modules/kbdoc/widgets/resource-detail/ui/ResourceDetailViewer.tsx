// ResourceDetailViewer 负责渲染目录抽屉、目录侧栏与预览主区域。
import React from 'react';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import ResourceDetailPreviewContent from './ResourceDetailPreviewContent';
import { VIEWER_PAGE_HEIGHT_CLASS } from '../lib/resourceDetail';

interface ResourceDetailViewerProps {
  activeJumpPage?: number;
  activeJumpToken?: number;
  canOpenVideoDetail: boolean;
  documentationPanel: React.ReactNode;
  hasDocumentation: boolean;
  hasMorePreview?: boolean;
  hasMoreTextPreview?: boolean;
  hasPreviousPreview?: boolean;
  hasPreviousTextPreview?: boolean;
  isDocumentationCollapsed: boolean;
  isDocumentationDrawerOpen: boolean;
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
  onToggleDocumentationCollapsed: () => void;
  onToggleDocumentationDrawer: () => void;
  previewPages: Array<{ pageNumber: number; url: string }>;
  resourceDocId: string;
  textPreviewChunks: Array<{ chunkSec: number; text: string }>;
}

const ResourceDetailViewer: React.FC<ResourceDetailViewerProps> = ({
  activeJumpPage,
  activeJumpToken,
  canOpenVideoDetail,
  documentationPanel,
  hasDocumentation,
  hasMorePreview,
  hasMoreTextPreview,
  hasPreviousPreview,
  hasPreviousTextPreview,
  isDocumentationCollapsed,
  isDocumentationDrawerOpen,
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
  onToggleDocumentationCollapsed,
  onToggleDocumentationDrawer,
  previewPages,
  resourceDocId,
  textPreviewChunks,
}) => (
  <div className="relative">
    {hasDocumentation && isDocumentationDrawerOpen ? (
      <div className="absolute inset-0 z-10 lg:hidden">
        <div
          className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
          onClick={onToggleDocumentationDrawer}
          role="presentation"
        />
        <div className="absolute inset-y-0 left-0 w-[min(22rem,calc(100%-1.25rem))] overflow-y-auto">
          {documentationPanel}
        </div>
      </div>
    ) : null}
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-300 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-[#2a2a2a] dark:bg-[#171717]">
      <div className={`flex min-h-0 flex-col ${VIEWER_PAGE_HEIGHT_CLASS}`}>
        <div className="border-b border-slate-200 bg-[#eef0f5] px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#1b1b1b]">
          <div className="flex items-center gap-2">
            {hasDocumentation ? (
              <button
                type="button"
                aria-label={isDocumentationDrawerOpen ? '收起目录抽屉' : '展开目录抽屉'}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-800 dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-slate-400 dark:hover:text-white lg:hidden"
                onClick={onToggleDocumentationDrawer}
              >
                <MaterialIcon name={isDocumentationDrawerOpen ? 'left_panel_close' : 'left_panel_open'} className="text-[18px]" />
              </button>
            ) : null}
            {hasDocumentation ? (
              <button
                type="button"
                aria-label={isDocumentationCollapsed ? '展开左侧目录' : '收起左侧目录'}
                className="hidden size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:text-slate-800 dark:border-[#2a2a2a] dark:bg-[#121212] dark:text-slate-400 dark:hover:text-white lg:inline-flex"
                onClick={onToggleDocumentationCollapsed}
              >
                <MaterialIcon
                  name={isDocumentationCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
                  className="text-[18px]"
                />
              </button>
            ) : null}
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:text-[#a0a0a0]">
              Document Viewer
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          {hasDocumentation ? (
            <aside
              className={`hidden border-r border-slate-300 bg-[#f5f6fa] transition-[width] duration-200 dark:border-[#2a2a2a] dark:bg-[#171717] lg:block ${isDocumentationCollapsed ? 'w-0 overflow-hidden' : 'w-[318px]'}`}
              data-testid="documentation-sidebar"
            >
              {!isDocumentationCollapsed ? documentationPanel : null}
            </aside>
          ) : null}
          <ResourceDetailPreviewContent
            activeJumpPage={activeJumpPage}
            activeJumpToken={activeJumpToken}
            canOpenVideoDetail={canOpenVideoDetail}
            hasMorePreview={hasMorePreview}
            hasMoreTextPreview={hasMoreTextPreview}
            hasPreviousPreview={hasPreviousPreview}
            hasPreviousTextPreview={hasPreviousTextPreview}
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
            onJumpHandled={onJumpHandled}
            onLoadMorePreview={onLoadMorePreview}
            onLoadMoreTextPreview={onLoadMoreTextPreview}
            onLoadPreviousPreview={onLoadPreviousPreview}
            onLoadPreviousTextPreview={onLoadPreviousTextPreview}
            onTimestampClick={onTimestampClick}
            previewPages={previewPages}
            resourceDocId={resourceDocId}
            textPreviewChunks={textPreviewChunks}
          />
        </div>
      </div>
    </div>
  </div>
);

export default ResourceDetailViewer;
