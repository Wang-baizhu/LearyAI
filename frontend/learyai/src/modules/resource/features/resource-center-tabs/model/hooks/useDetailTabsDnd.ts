// useDetailTabsDnd 负责资源中心详情标签的拖拽交互编排。
import { useCallback, useState } from 'react';
import {
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type {
  ResourceCenterDetailTab,
  ResourceCenterDetailTabKey,
  ResourceCenterPanel,
} from '../../../../entities/resource-center';
import { isDetailTabKey } from '../../../../entities/resource-center';

interface UseDetailTabsDndParams {
  sidebarDropZoneId: string;
  detailMergeDropZonePrefix: string;
  detailGroupDragIdPrefix: string;
  detailTabs: ResourceCenterDetailTab[];
  detailTabsMap: Map<ResourceCenterDetailTabKey, ResourceCenterDetailTab>;
  activePanel: ResourceCenterPanel;
  getDetailRootKey: (key: ResourceCenterDetailTabKey) => ResourceCenterDetailTabKey;
  handleDetachDetailTab: (key: ResourceCenterDetailTabKey) => void;
  mergeDetailTabs: (
    sourceKey: ResourceCenterDetailTabKey,
    targetKey: ResourceCenterDetailTabKey
  ) => void;
  setActivePanel: (panel: ResourceCenterPanel) => void;
  setSidebarDetailTab: (tab: ResourceCenterDetailTab | null) => void;
}

const useDetailTabsDnd = ({
  sidebarDropZoneId,
  detailMergeDropZonePrefix,
  detailGroupDragIdPrefix,
  detailTabs,
  detailTabsMap,
  activePanel,
  getDetailRootKey,
  handleDetachDetailTab,
  mergeDetailTabs,
  setActivePanel,
  setSidebarDetailTab,
}: UseDetailTabsDndParams) => {
  const [isTabDragging, setIsTabDragging] = useState(false);
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const collisionWithFallback: CollisionDetection = useCallback(
    (args) => {
      const pointerMatches = pointerWithin(args);
      const sidebarMatch = pointerMatches.find((item) => String(item.id) === sidebarDropZoneId);
      if (sidebarMatch) return [sidebarMatch];
      if (pointerMatches.length > 0) return pointerMatches;
      return rectIntersection(args);
    },
    [sidebarDropZoneId]
  );

  const parseDetailMergeDropZoneId = useCallback(
    (value: string): ResourceCenterDetailTabKey | null => {
      if (!value.startsWith(detailMergeDropZonePrefix)) return null;
      const key = value.slice(detailMergeDropZonePrefix.length);
      return isDetailTabKey(key) ? key : null;
    },
    [detailMergeDropZonePrefix]
  );

  const parseDetailGroupDragId = useCallback(
    (value: string): ResourceCenterDetailTabKey | null => {
      if (!value.startsWith(detailGroupDragIdPrefix)) return null;
      const key = value.slice(detailGroupDragIdPrefix.length);
      return isDetailTabKey(key) ? key : null;
    },
    [detailGroupDragIdPrefix]
  );

  const resolveDraggedDetailKey = useCallback(
    (value: string): ResourceCenterDetailTabKey | null => {
      if (isDetailTabKey(value)) return value;
      return parseDetailGroupDragId(value);
    },
    [parseDetailGroupDragId]
  );

  const handleTabDragStart = useCallback(
    (event: DragStartEvent) => {
      setIsTabDragging(true);
      const activeId = String(event.active.id);
      if (parseDetailGroupDragId(activeId)) return;
      const activeKey = resolveDraggedDetailKey(activeId);
      if (!activeKey) return;
      const activeRoot = getDetailRootKey(activeKey);
      const activeGroupSize = detailTabs.filter(
        (tab) => getDetailRootKey(tab.key) === activeRoot
      ).length;
      if (activeGroupSize <= 1) return;
      handleDetachDetailTab(activeKey);
    },
    [detailTabs, getDetailRootKey, handleDetachDetailTab, parseDetailGroupDragId, resolveDraggedDetailKey]
  );

  const handleTabDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsTabDragging(false);
      const { active, over } = event;
      const activeKey = resolveDraggedDetailKey(String(active.id));
      if (!activeKey) return;
      if (!over) {
        if (getDetailRootKey(activeKey) !== activeKey) {
          handleDetachDetailTab(activeKey);
        }
        return;
      }
      const overId = String(over.id);
      if (overId === sidebarDropZoneId) {
        setSidebarDetailTab(detailTabsMap.get(activeKey) ?? null);
        return;
      }
      const mergeTarget = parseDetailMergeDropZoneId(overId);
      if (!mergeTarget || mergeTarget === activeKey) {
        if (getDetailRootKey(activeKey) !== activeKey) {
          handleDetachDetailTab(activeKey);
        }
        return;
      }
      if (!detailTabsMap.has(mergeTarget)) return;
      mergeDetailTabs(activeKey, mergeTarget);
      if (activePanel === activeKey) {
        setActivePanel(activeKey);
      }
    },
    [
      activePanel,
      detailTabsMap,
      getDetailRootKey,
      handleDetachDetailTab,
      mergeDetailTabs,
      parseDetailMergeDropZoneId,
      resolveDraggedDetailKey,
      setActivePanel,
      setSidebarDetailTab,
      sidebarDropZoneId,
    ]
  );

  const handleTabDragCancel = useCallback(() => {
    setIsTabDragging(false);
  }, []);

  return {
    dragSensors,
    collisionWithFallback,
    isTabDragging,
    handleTabDragStart,
    handleTabDragEnd,
    handleTabDragCancel,
  };
};

export default useDetailTabsDnd;
