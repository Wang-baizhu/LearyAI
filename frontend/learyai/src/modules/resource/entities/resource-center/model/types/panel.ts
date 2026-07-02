// panel 负责定义资源中心面板与详情标签的统一类型和常量。
export const RESOURCE_CENTER_SYSTEM_TAB_KEYS = ['all', 'kbdoc'] as const;
export const RESOURCE_CENTER_TAB_KEYS = RESOURCE_CENTER_SYSTEM_TAB_KEYS;

export type ResourceCenterSystemTab = (typeof RESOURCE_CENTER_SYSTEM_TAB_KEYS)[number];
export type ResourceCenterTab = string;
export type ResourceCenterStaticPanel = ResourceCenterTab | 'ai';
export type ResourceCenterDetailKind = 'kbdoc' | 'template' | 'video' | 'whiteboard';
export type ResourceCenterDetailTabKey =
  | `doc:${string}`
  | `template:${string}`
  | `video:${string}`
  | `whiteboard:${string}`;
export type ResourceCenterPanel = ResourceCenterStaticPanel | ResourceCenterDetailTabKey;

export interface ResourceCenterTabItem {
  key: ResourceCenterPanel;
  label: string;
  closable?: boolean;
  disabled?: boolean;
}

export interface ResourceCenterDetailTab {
  key: ResourceCenterDetailTabKey;
  label: string;
  kind: ResourceCenterDetailKind;
  docId: string;
  templateId?: string;
  jumpToPage?: number;
  jumpToken?: number;
}

export const SIDEBAR_TAB_DROP_ZONE_ID = 'resource-center-sidebar-drop-zone';
export const DETAIL_MERGE_DROP_ZONE_PREFIX = 'resource-center-merge-target:';
export const DETAIL_GROUP_DRAG_ID_PREFIX = 'resource-center-group-drag:';

export const isResourceCenterTab = (value: string): value is ResourceCenterTab =>
  Boolean(value) && value !== 'ai' && !isDetailTabKey(value);

export const isDetailTabKey = (value: string): value is ResourceCenterDetailTabKey =>
  value.startsWith('doc:')
  || value.startsWith('template:')
  || value.startsWith('video:')
  || value.startsWith('whiteboard:');
