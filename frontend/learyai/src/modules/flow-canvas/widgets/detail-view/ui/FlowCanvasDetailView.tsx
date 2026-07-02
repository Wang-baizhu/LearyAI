// FlowCanvasDetailView 负责把白板以 detail-page 可复用的方式嵌入页面。
import React, { useCallback, useMemo } from 'react';
import {
  DEFAULT_FLOW_CANVAS_BOARD,
  mergeCanvasWithResourceCatalog,
} from '../../../entities/board';
import type {
  FlowCanvasEvent,
  FlowCanvasResourceCatalog,
  FlowCanvasSnapshot,
  FlowCanvasViewState,
} from '../../../entities/board';
import { Whiteboard } from '../../whiteboard';

interface FlowCanvasDetailViewProps {
  title?: string;
  snapshot?: FlowCanvasSnapshot;
  resourceCatalog?: FlowCanvasResourceCatalog;
  state?: FlowCanvasViewState;
  onEvent?: (event: FlowCanvasEvent) => void;
}

const FlowCanvasDetailView: React.FC<FlowCanvasDetailViewProps> = ({
  title = DEFAULT_FLOW_CANVAS_BOARD.title,
  snapshot,
  resourceCatalog,
  state,
  onEvent,
}) => {
  const mergedSnapshot = useMemo(() => {
    if (!snapshot || !resourceCatalog) {
      return null;
    }
    return mergeCanvasWithResourceCatalog(snapshot, resourceCatalog);
  }, [resourceCatalog, snapshot]);

  const handleSnapshotChange = useCallback((snapshot: FlowCanvasSnapshot) => {
    onEvent?.({
      type: 'snapshotChanged',
      snapshot,
    });
  }, [onEvent]);
  const handleOpenNode = useCallback((payload: { nodeId: string; label: string; refId?: string; refKind?: 'kbdoc' | 'template' }) => {
    onEvent?.({
      type: 'nodeOpened',
      nodeId: payload.nodeId,
      label: payload.label,
      refId: payload.refId,
      refKind: payload.refKind,
    });
  }, [onEvent]);

  const isLoading = state?.isLoading ?? false;
  const isError = state?.isError ?? false;
  const isSaving = state?.isSaving ?? false;
  const saveError = state?.saveError ?? false;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8fafc] dark:bg-[#0f172a]">
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/70">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            展示当前知识库文档与模板的全局编排视图。
          </p>
        </div>
        {isSaving && (
          <span className="text-xs text-slate-500 dark:text-slate-400">正在保存...</span>
        )}
        {saveError && (
          <span className="text-xs text-red-500">保存失败，请稍后重试。</span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            正在加载全局视图...
          </div>
        )}
        {isError && (
          <div className="flex h-full items-center justify-center text-sm text-red-500">
            全局视图加载失败，请稍后重试。
          </div>
        )}
        {!isLoading && !isError && mergedSnapshot && (
          <Whiteboard
            initialNodes={mergedSnapshot.nodes}
            initialEdges={mergedSnapshot.edges}
            className="h-full w-full"
            onSnapshotChange={handleSnapshotChange}
            onOpenNode={handleOpenNode}
          />
        )}
      </div>
    </div>
  );
};

export default FlowCanvasDetailView;
