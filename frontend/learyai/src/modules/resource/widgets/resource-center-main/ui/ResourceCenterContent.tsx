// ResourceCenterContent 负责根据当前面板分发渲染列表、详情与 AI 视图。
import React from 'react';
import type { ResourceCenterPanel } from '../../../entities/resource-center';
import { isResourceCenterTab } from '../../../entities/resource-center';
import type {
  ResourceCenterAiState,
  ResourceCenterContentVariant,
  ResourceCenterListActions,
} from '../model/types';
import type { ResourceCenterListState } from '../../../features/resource-center-list';
import type { ResourceDetailPanelProps } from '../../../entities/resource-center';
import ResourceCenterAiView from './ResourceCenterAiView';
import ResourceCenterListView from './ResourceCenterListView';
import ResourceCenterDetailRegion from './ResourceCenterDetailRegion';

interface ResourceCenterContentProps {
  panel: ResourceCenterPanel;
  variant: ResourceCenterContentVariant;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  listState?: ResourceCenterListState;
  listActions?: ResourceCenterListActions;
  detailState?: ResourceDetailPanelProps;
  detailStates?: Array<{ key: string; state: ResourceDetailPanelProps }>;
  aiState?: ResourceCenterAiState;
  detailFloatingAction?: React.ReactNode;
}

const ResourceCenterContent: React.FC<ResourceCenterContentProps> = ({
  panel,
  variant,
  isCollapsed = false,
  onToggleCollapsed,
  listState,
  listActions,
  detailState,
  detailStates,
  aiState,
  detailFloatingAction,
}) => {
  if (panel === 'ai') {
    return (
      <ResourceCenterAiView
        variant={variant}
        isCollapsed={isCollapsed}
        onToggleCollapsed={onToggleCollapsed}
        aiState={aiState}
      />
    );
  }

  const listContent = isResourceCenterTab(panel)
    ? (
      <ResourceCenterListView
        panel={panel}
        variant={variant}
        listState={listState}
        listActions={listActions}
        onToggleCollapsed={onToggleCollapsed}
      />
      )
    : null;

  return (
    <ResourceCenterDetailRegion
      panel={panel}
      variant={variant}
      detailState={detailState}
      detailStates={detailStates}
      listContent={listContent}
      floatingAction={detailFloatingAction}
    />
  );
};

export default ResourceCenterContent;

export type {
  ResourceCenterAiState,
  ResourceCenterContentVariant,
  ResourceCenterListActions,
} from '../model/types';
export type { ResourceCenterListState } from '../../../features/resource-center-list/model/types';
