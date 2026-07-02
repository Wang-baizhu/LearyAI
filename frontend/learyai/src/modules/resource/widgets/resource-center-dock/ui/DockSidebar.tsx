// DockSidebar 负责资源中心左侧停靠栏壳层与不同面板内容装配。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DEFAULT_FLOW_CANVAS_BOARD } from '@/modules/flow-canvas';
import type { ResourceListItem, SidebarResource } from '../../../../kbdoc';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import {
  useResourceScope,
  type ResourceCenterDetailTab,
  type ResourceCenterStaticPanel,
  type ResourceCenterTab,
} from '../../../entities/resource-center';
import type { ResourceCenterListState } from '../../../features/resource-center-list';
import { ResourceCenterContent } from '../../resource-center-main';

interface DockSidebarProps {
  dockedPanel: ResourceCenterStaticPanel;
  layoutMode?: 'desktop' | 'mobile';
  tabDropZoneId: string;
  resources: SidebarResource[];
  referencedResources: SidebarResource[];
  referencedDocRefs: { id: string; name?: string }[];
  fallbackDocRef: { id: string; name?: string } | null;
  listState: ResourceCenterListState | null;
  onToggleReference: (resource: SidebarResource) => void;
  onToggleListReference: (item: ResourceListItem) => void;
  referencedDocIds: string[];
  onClearReferences: () => void;
  onPageChange: (panel: ResourceCenterTab, nextPage: number) => void;
  onResourceDeleted: (docId: string) => void;
  sidebarDetailTab?: ResourceCenterDetailTab | null;
  onClearSidebarDetail: () => void;
  forceExpandToken?: number | null;
  onResizeStateChange?: (isResizing: boolean) => void;
  disableTemplatePointerEvents?: boolean;
  onOpenVideoDetailTab?: (docId: string, label: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

type SidebarDetailOverride = {
  docId: string;
  detailKind: 'kbdoc' | 'video';
};

const DockSidebar: React.FC<DockSidebarProps> = ({
  dockedPanel,
  layoutMode = 'desktop',
  tabDropZoneId,
  resources,
  referencedResources,
  referencedDocRefs,
  fallbackDocRef,
  listState,
  onToggleReference,
  onToggleListReference,
  referencedDocIds,
  onClearReferences,
  onPageChange,
  onResourceDeleted,
  sidebarDetailTab,
  onClearSidebarDetail,
  forceExpandToken,
  onResizeStateChange,
  disableTemplatePointerEvents,
  onOpenVideoDetailTab,
  isDarkMode,
  toggleTheme,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarDocId, setSidebarDocId] = useState<string | null>(null);
  const [sidebarDetailOverride, setSidebarDetailOverride] = useState<SidebarDetailOverride | null>(null);
  const lastForceExpandTokenRef = useRef<number | null>(null);
  const resizeCleanupRef = useRef<null | (() => void)>(null);
  const { projectId, kbId } = useResourceScope();
  const isMobileLayout = layoutMode === 'mobile';
  const sidebarMinWidth = 320;
  const sidebarMaxWidth = 640;
  const collapseWidth = 56;
  const { setNodeRef: setSidebarDropZoneRef, isOver: isTabDropOver } = useDroppable({
    id: tabDropZoneId,
  });

  const handleToggleCollapsed = useCallback(() => {
    if (isMobileLayout) return;
    setIsCollapsed((prev) => !prev);
  }, [isMobileLayout]);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const handleOpenSidebarDetail = useCallback((payload: SidebarDetailOverride) => {
    if (sidebarDetailTab?.kind === 'whiteboard') {
      setSidebarDetailOverride(payload);
      return;
    }
    setSidebarDocId(payload.docId);
  }, [sidebarDetailTab?.kind]);

  const handleClearSidebarDetail = useCallback(() => {
    if (sidebarDetailOverride) {
      setSidebarDetailOverride(null);
      return;
    }
    onClearSidebarDetail();
  }, [onClearSidebarDetail, sidebarDetailOverride]);

  const buildSharedDetailActions = () => ({
    onOpenVideoDetailTab,
    onOpenResourceDetailTab: (docId: string) => {
      handleOpenSidebarDetail({
        docId,
        detailKind: 'kbdoc',
      });
    },
    onToggleCollapsed: isMobileLayout ? undefined : handleToggleCollapsed,
    showCollapseToggle: !isMobileLayout,
    disableTemplatePointerEvents,
    isDarkMode,
    toggleTheme,
  });

  const detailState = (() => {
    if (sidebarDetailOverride) {
      return {
        docId: sidebarDetailOverride.docId,
        kbId,
        projectId,
        detailKind: sidebarDetailOverride.detailKind,
        ...buildSharedDetailActions(),
      };
    }
    if (sidebarDetailTab) {
      if (sidebarDetailTab.kind === 'whiteboard') {
        return {
          docId: sidebarDetailTab.docId,
          detailTabKey: sidebarDetailTab.key,
          kbId,
          projectId,
          detailKind: sidebarDetailTab.kind,
          whiteboardConfig: {
            boardId: DEFAULT_FLOW_CANVAS_BOARD.boardId,
            title: sidebarDetailTab.label || DEFAULT_FLOW_CANVAS_BOARD.title,
          },
          ...buildSharedDetailActions(),
        };
      }
      return {
        docId: sidebarDetailTab.docId,
        detailTabKey: sidebarDetailTab.key,
        kbId,
        projectId,
        detailKind: sidebarDetailTab.kind,
        whiteboardConfig: undefined,
        ...buildSharedDetailActions(),
      };
    }
    if (!sidebarDocId || dockedPanel === 'ai') return null;
    return {
      docId: sidebarDocId,
      kbId,
      projectId,
      detailKind: 'kbdoc' as const,
      ...buildSharedDetailActions(),
    };
  })();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSidebarDocId(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [dockedPanel]);

  useEffect(() => {
    if (sidebarDetailTab) {
      const timeoutId = window.setTimeout(() => {
        setSidebarDocId(null);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [sidebarDetailTab]);

  useEffect(() => {
    if (dockedPanel === 'ai') {
      const timeoutId = window.setTimeout(() => {
        setIsCollapsed(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [dockedPanel]);

  useEffect(() => {
    if (!isMobileLayout) return undefined;
    const timeoutId = window.setTimeout(() => {
      setIsCollapsed(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isMobileLayout]);

  useEffect(() => {
    if (sidebarDetailTab?.kind === 'whiteboard') return undefined;
    const timeoutId = window.setTimeout(() => {
      setSidebarDetailOverride(null);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [sidebarDetailTab]);

  useEffect(() => {
    if (!forceExpandToken || forceExpandToken === lastForceExpandTokenRef.current) return;
    lastForceExpandTokenRef.current = forceExpandToken;
    const timeoutId = window.setTimeout(() => {
      expandSidebar();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [expandSidebar, forceExpandToken]);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      onResizeStateChange?.(false);
    };
  }, [onResizeStateChange]);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isCollapsed || isMobileLayout) return;
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;

    setIsResizing(true);
    onResizeStateChange?.(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.min(
        sidebarMaxWidth,
        Math.max(sidebarMinWidth, startWidth + deltaX)
      );
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      setIsResizing(false);
      onResizeStateChange?.(false);
      resizeCleanupRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    resizeCleanupRef.current = handlePointerUp;
  };

  const effectivePanel = sidebarDetailTab ? 'all' : dockedPanel;
  const clearButtonLabel = sidebarDetailOverride
    ? '返回白板'
    : '关闭详情并切换到 AI';

  return (
    <aside
      ref={setSidebarDropZoneRef}
      className={`relative flex h-full shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-black/5 ${
        isResizing ? '' : 'transition-all duration-300'
      } dark:border-[#2a2a2a] dark:bg-[#1a1a1a] ${
        isTabDropOver ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-transparent' : ''
      } ${isMobileLayout ? 'w-full rounded-none border-0 shadow-none lg:rounded-3xl lg:border lg:shadow-xl' : ''}`}
      style={{ width: isMobileLayout ? '100%' : isCollapsed ? collapseWidth : sidebarWidth }}
    >
      {!isCollapsed && !isMobileLayout && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整侧边栏宽度"
          className="absolute right-0 top-0 z-30 h-full w-2 cursor-col-resize bg-transparent"
          onPointerDown={handleResizePointerDown}
        />
      )}
      {sidebarDetailTab && !isCollapsed ? (
        <button
          type="button"
          onClick={handleClearSidebarDetail}
          className="absolute top-6 right-6 z-40 flex h-8 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm hover:border-rose-200 hover:text-rose-500 dark:border-[#2a2a2a] dark:bg-[#121212] dark:hover:border-rose-400"
          aria-label={clearButtonLabel}
        >
          <MaterialIcon name="close" className="text-[18px]" />
        </button>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <ResourceCenterContent
          panel={effectivePanel}
          variant="sidebar"
          isCollapsed={isCollapsed}
          onToggleCollapsed={isMobileLayout ? undefined : handleToggleCollapsed}
          listState={!sidebarDetailTab ? listState ?? undefined : undefined}
          listActions={
            !sidebarDetailTab && listState
              ? {
                  onOpenResource: (resourceDocId) => {
                    setSidebarDocId(resourceDocId);
                  },
                  onToggleReference: onToggleListReference,
                  referencedDocIds,
                  onPageChange,
                  onResourceDeleted,
                }
              : undefined
          }
          detailState={detailState ?? undefined}
          aiState={{
            referencedResources,
            referencedDocRefs,
            fallbackDocRef,
            onToggleReference,
            onClearReferences,
            resources,
            showCollapseToggle: !isMobileLayout,
            inputVariant: isMobileLayout ? 'mobile-floating' : 'default',
          }}
        />
      </div>
    </aside>
  );
};

export default DockSidebar;
