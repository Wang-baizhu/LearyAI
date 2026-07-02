import React from 'react';
import { DndContext } from '@dnd-kit/core';
import { Outlet, useParams } from 'react-router-dom';
import type { ResourceListItem, SidebarResource } from '../../../../kbdoc';
import type { ResourceCenterListState } from '../../../features/resource-center-list';
import useResourceCenterPageModel from '../model/useResourceCenterPageModel';
import ResourceCenterShell from '../../../widgets/resource-center-shell';
import { ResourceCenterDock } from '../../../widgets/resource-center-dock';
import { TourOverlay, TourProvider } from '@leary/tour-guide';
import { DETAIL_GROUP_DRAG_ID_PREFIX, DETAIL_MERGE_DROP_ZONE_PREFIX, ResourceScopeProvider, SIDEBAR_TAB_DROP_ZONE_ID, type ResourceCenterDetailOpenPayload, type ResourceCenterDetailTab, type ResourceCenterDetailTabKey, type ResourceCenterPanel, type ResourceCenterTab, type ResourceCenterTabItem } from '../../../entities/resource-center';

const RESOURCE_CENTER_GUIDE_TAG = 'guide:resource-center:v1';

export interface ResourceCenterOutletContext {
  activeTab: ResourceCenterTab;
  activePanel: ResourceCenterPanel;
  activeTopPanel: ResourceCenterPanel;
  setActiveTab: (tab: ResourceCenterTab) => void;
  topTabItems: ResourceCenterTabItem[];
  detailTabGroups: Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTab[]>>;
  onSelectTopTab: (tab: ResourceCenterPanel) => void;
  detailTabs: ResourceCenterDetailTab[];
  activeDetailTab: ResourceCenterDetailTab | null;
  lastDetailTab: ResourceCenterDetailTab | null;
  onOpenDetailTab: (payload: ResourceCenterDetailOpenPayload) => void;
  onCloseDetailTab: (key: ResourceCenterDetailTabKey) => void;
  onCloseSingleDetailTab: (key: ResourceCenterDetailTabKey) => void;
  onDetachDetailTab: (key: ResourceCenterDetailTabKey) => void;
  onMergeDetailTabs: (
    sourceKey: ResourceCenterDetailTabKey,
    targetKey: ResourceCenterDetailTabKey
  ) => void;
  onClearDetailJump: (key: ResourceCenterDetailTabKey) => void;
  sidebarDropZoneId: string;
  detailMergeDropZonePrefix: string;
  listState: ResourceCenterListState;
  onToggleListReference: (item: ResourceListItem) => void;
  onPageChange: (panel: ResourceCenterTab, nextPage: number) => void;
  referencedDocIds: string[];
  sidebarResources: SidebarResource[];
  sidebarReferencedResources: SidebarResource[];
  referencedDocRefs: { id: string; name?: string }[];
  fallbackDocRef: { id: string; name?: string } | null;
  onToggleSidebarReference: (resource: SidebarResource) => void;
  kbdocListItems: ResourceListItem[];
  kbdocListLoading: boolean;
  onResourceDeleted: (docId: string) => void;
  onClearReferences: () => void;
  disableTemplatePointerEvents: boolean;
  isMobileActionSheetOpen: boolean;
  openMobileActionSheet: () => void;
  closeMobileActionSheet: () => void;
}

const ResourceCenterLayout: React.FC = () => {
  const { kbId: kbIdParam, projectId } = useParams<{
    kbId: string;
    projectId: string;
  }>();
  const kbId = kbIdParam ?? undefined;
  const vm = useResourceCenterPageModel({
    projectId,
    kbId,
    sidebarDropZoneId: SIDEBAR_TAB_DROP_ZONE_ID,
    detailMergeDropZonePrefix: DETAIL_MERGE_DROP_ZONE_PREFIX,
    detailGroupDragIdPrefix: DETAIL_GROUP_DRAG_ID_PREFIX,
  });

  return (
    <ResourceScopeProvider value={{ projectId, kbId }}>
      <TourProvider tags={[RESOURCE_CENTER_GUIDE_TAG]}>
        <DndContext
          sensors={vm.dnd.dragSensors}
          collisionDetection={vm.dnd.collisionWithFallback}
          onDragStart={vm.dnd.handleTabDragStart}
          onDragEnd={vm.dnd.handleTabDragEnd}
          onDragCancel={vm.dnd.handleTabDragCancel}
        >
          <ResourceCenterShell
            dock={<ResourceCenterDock {...vm.dockProps} />}
            mobileActiveView={vm.mobileActiveView}
            onMobileViewChange={vm.onMobileViewChange}
            onMobileActionClick={vm.toggleMobileActionSheet}
            isMobileActionActive={vm.isMobileActionSheetOpen}
          >
            <Outlet context={vm.outletContext} />
          </ResourceCenterShell>
          <TourOverlay />
        </DndContext>
      </TourProvider>
    </ResourceScopeProvider>
  );
};

export default ResourceCenterLayout;
