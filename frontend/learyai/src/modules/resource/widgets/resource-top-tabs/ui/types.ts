// resource-tabs/types 负责定义资源中心顶部标签组件共享类型。
import type { ResourceCenterDetailTab, ResourceCenterDetailTabKey, ResourceCenterPanel, ResourceCenterTab, ResourceCenterTabItem } from '../../../entities/resource-center';

export interface ResourceTopTabsProps {
  topTabItems: ResourceCenterTabItem[];
  detailTabGroups: Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTab[]>>;
  activeTopPanel: ResourceCenterPanel;
  activePanel: ResourceCenterPanel;
  activeListTab: ResourceCenterTab;
  detailMergeDropZonePrefix: string;
  onSelectTopTab: (tab: ResourceCenterPanel) => void;
  onCloseDetailTab: (key: ResourceCenterDetailTabKey) => void;
  onCloseSingleDetailTab: (key: ResourceCenterDetailTabKey) => void;
}
