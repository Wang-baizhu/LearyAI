// types 负责定义资源中心主内容区 widgets 的共享类型。
import type React from 'react';
import type { DocReference } from '../../../../ai-chat';
import type { ResourceListItem, SidebarResource } from '../../../../kbdoc';
import type { ResourceCenterPanel, ResourceCenterTab } from '../../../entities/resource-center';
import type { ResourceDetailPanelProps } from '../../../entities/resource-center';
import type { ResourceCenterListState } from '../../../features/resource-center-list';

export type ResourceCenterContentVariant = 'main' | 'sidebar';

export interface ResourceCenterListActions {
  onOpenResource: (docId: string) => void;
  onOpenGlobalView?: () => void;
  panelMetaByTab?: Record<string, { label: string; icon: string }>;
  onToggleReference?: (item: ResourceListItem) => void;
  referencedDocIds: string[];
  onResourceDeleted?: (docId: string) => void;
  onPageChange: (panel: ResourceCenterTab, nextPage: number) => void;
}

export interface ResourceCenterAiState {
  resources: SidebarResource[];
  referencedResources: SidebarResource[];
  referencedDocRefs: DocReference[];
  onToggleReference: (resource: SidebarResource) => void;
  onClearReferences: () => void;
  fallbackDocRef?: DocReference | null;
  showCollapseToggle?: boolean;
  inputVariant?: 'default' | 'mobile-floating';
}

export interface ResourceCenterListViewProps {
  panel: ResourceCenterTab;
  variant: ResourceCenterContentVariant;
  listState?: ResourceCenterListState;
  listActions?: ResourceCenterListActions;
  onToggleCollapsed?: () => void;
}

export interface ResourceCenterAiViewProps {
  variant: ResourceCenterContentVariant;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  aiState?: ResourceCenterAiState;
}

export interface ResourceCenterDetailRegionProps {
  panel: ResourceCenterPanel;
  variant: ResourceCenterContentVariant;
  detailState?: ResourceDetailPanelProps;
  detailStates?: Array<{ key: string; state: ResourceDetailPanelProps }>;
  listContent: React.ReactNode;
  floatingAction?: React.ReactNode;
}
