// ResourceFlowCanvasDetail 负责把资源中心数据源适配给纯 flow-canvas 详情视图。
import React from 'react';
import { FlowCanvasDetailView } from '@/modules/flow-canvas';
import type { ResourceCenterDetailOpenHandler } from '../../../entities/resource-center';
import { useResourceFlowCanvasBoard } from '../model/hooks/useResourceFlowCanvasBoard';

interface ResourceFlowCanvasDetailProps {
  title?: string;
  projectId?: string;
  kbId?: string;
  onOpenDetailTab?: ResourceCenterDetailOpenHandler;
}

export const ResourceFlowCanvasDetail: React.FC<ResourceFlowCanvasDetailProps> = ({
  title,
  projectId,
  kbId,
  onOpenDetailTab,
}) => {
  const {
    snapshot,
    resourceCatalog,
    state,
    handleEvent,
  } = useResourceFlowCanvasBoard(projectId, kbId, onOpenDetailTab);

  if (!projectId || !kbId) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#f8fafc] text-sm text-slate-500 dark:bg-[#0f172a] dark:text-slate-400">
        缺少项目或知识库上下文，无法加载全局视图。
      </div>
    );
  }

  return (
    <FlowCanvasDetailView
      title={title}
      snapshot={snapshot}
      resourceCatalog={resourceCatalog}
      state={state}
      onEvent={handleEvent}
    />
  );
};
