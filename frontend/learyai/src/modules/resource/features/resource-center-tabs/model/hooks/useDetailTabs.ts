// useDetailTabs 负责资源中心详情标签的状态与行为编排。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  reduceCloseDetailTabGroup,
  reduceDetachDetailTab,
  reduceMergeDetailTabs,
  resolveDetailRootKey,
} from '../../lib/detailTabsReducer';
import type {
  ResourceCenterDetailKind,
  ResourceCenterDetailOpenPayload,
  ResourceCenterDetailTab,
  ResourceCenterDetailTabKey,
  ResourceCenterPanel,
  ResourceCenterStaticPanel,
  ResourceCenterTab,
  ResourceCenterTabItem,
} from '../../../../entities/resource-center';
import {
  isDetailTabKey,
  isResourceCenterTab,
} from '../../../../entities/resource-center';

const DEFAULT_FIXED_TAB_ITEMS: ResourceCenterTabItem[] = [
  { key: 'all', label: '全部资源' },
  { key: 'kbdoc', label: '参考文档' },
];
const EMPTY_DOC_NAME_MAP: Record<string, string> = {};

const isStaticPanel = (value: string): value is ResourceCenterStaticPanel =>
  value === 'ai' || isResourceCenterTab(value);
const isResourceCenterPanel = (value: string): value is ResourceCenterPanel =>
  isStaticPanel(value) || isDetailTabKey(value);
const resolveTabLabel = (
  tab: ResourceCenterDetailTab,
  docNameMap: Record<string, string>,
) => {
  const mappedName = docNameMap[tab.docId];
  if (!mappedName) {
    return tab.label;
  }
  if (tab.kind === 'kbdoc') {
    return mappedName;
  }
  if (tab.kind === 'video') {
    return `${mappedName} · 视频`;
  }
  return tab.label;
};
export const buildDetailTabKey = (
  kind: ResourceCenterDetailKind,
  docId: string
): ResourceCenterDetailTabKey => {
  if (kind === 'template') return `template:${docId}`;
  if (kind === 'video') return `video:${docId}`;
  if (kind === 'whiteboard') return `whiteboard:${docId}`;
  return `doc:${docId}`;
};

interface UseDetailTabsOptions {
  docNameMap?: Record<string, string>;
  fixedTabItems?: ResourceCenterTabItem[];
}

const useDetailTabs = (options?: UseDetailTabsOptions) => {
  const docNameMap = options?.docNameMap ?? EMPTY_DOC_NAME_MAP;
  const fixedTabItems = options?.fixedTabItems ?? DEFAULT_FIXED_TAB_ITEMS;
  const [activeTab, setActiveTab] = useState<ResourceCenterTab>('all');
  const [activePanel, setActivePanel] = useState<ResourceCenterPanel>('all');
  const [detailTabs, setDetailTabs] = useState<ResourceCenterDetailTab[]>([]);
  const [mergedParentMap, setMergedParentMap] = useState<
    Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTabKey>>
  >({});
  const [groupActiveMemberMap, setGroupActiveMemberMap] = useState<
    Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTabKey>>
  >({});
  const [lastDetailTab, setLastDetailTab] = useState<ResourceCenterDetailTab | null>(null);
  const lastListPanelRef = useRef<ResourceCenterTab>(activeTab);
  const topPanelOrderRef = useRef<ResourceCenterPanel[]>([]);
  const resolvedDetailTabs = useMemo(
    () => detailTabs.map((tab) => ({ ...tab, label: resolveTabLabel(tab, docNameMap) })),
    [detailTabs, docNameMap]
  );

  const detailTabsMap = useMemo(
    () => new Map(resolvedDetailTabs.map((tab) => [tab.key, tab])),
    [resolvedDetailTabs]
  );
  const mergedDetailRootMap = useMemo(() => {
    const map: Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTabKey>> = {};
    resolvedDetailTabs.forEach((tab) => {
      map[tab.key] = resolveDetailRootKey(tab.key, mergedParentMap);
    });
    return map;
  }, [mergedParentMap, resolvedDetailTabs]);
  const visibleDetailTabs = useMemo(
    () => resolvedDetailTabs.filter((tab) => mergedDetailRootMap[tab.key] === tab.key),
    [mergedDetailRootMap, resolvedDetailTabs]
  );
  const topTabItems = useMemo(() => {
    const items: ResourceCenterTabItem[] = [...fixedTabItems];
    visibleDetailTabs.forEach((tab) => {
      items.push({
        key: tab.key,
        label: tab.label,
        closable: true,
      });
    });
    return items;
  }, [fixedTabItems, visibleDetailTabs]);
  const detailTabGroups = useMemo(() => {
    const groups: Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTab[]>> = {};
    resolvedDetailTabs.forEach((tab) => {
      const root = mergedDetailRootMap[tab.key] ?? tab.key;
      if (!groups[root]) {
        groups[root] = [];
      }
      groups[root]?.push(tab);
    });
    return groups;
  }, [mergedDetailRootMap, resolvedDetailTabs]);
  const activeTopPanel = useMemo<ResourceCenterPanel>(() => {
    if (!isDetailTabKey(String(activePanel))) return activePanel;
    const detailKey = activePanel as ResourceCenterDetailTabKey;
    return mergedDetailRootMap[detailKey] ?? detailKey;
  }, [activePanel, mergedDetailRootMap]);
  const activeDetailTab = useMemo(
    () =>
      isDetailTabKey(String(activePanel))
        ? detailTabsMap.get(activePanel as ResourceCenterDetailTabKey) ?? null
        : null,
    [activePanel, detailTabsMap]
  );

  useEffect(() => {
    lastListPanelRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!isResourceCenterTab(String(activePanel))) return;
    if (activeTab === activePanel) return;
    const timer = window.setTimeout(() => {
      setActiveTab(activePanel as ResourceCenterTab);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activePanel, activeTab]);

  useEffect(() => {
    if (!isDetailTabKey(String(activePanel))) return;
    const detailKey = activePanel as ResourceCenterDetailTabKey;
    const root = mergedDetailRootMap[detailKey];
    if (!root) return;
    const timer = window.setTimeout(() => {
      setGroupActiveMemberMap((prev) => {
        if (prev[root] === detailKey) return prev;
        return { ...prev, [root]: detailKey };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activePanel, mergedDetailRootMap]);

  useEffect(() => {
    const activeFixedTab = fixedTabItems.find((item) => item.key === activeTab);
    if (activeFixedTab && !activeFixedTab.disabled) return;
    const fallback = fixedTabItems.find((item) => !item.disabled)?.key ?? fixedTabItems[0]?.key ?? 'all';
    const timer = window.setTimeout(() => {
      setActiveTab(fallback);
      setActivePanel((current) => (isResourceCenterTab(String(current)) ? fallback : current));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, fixedTabItems]);

  useEffect(() => {
    const existingKeys = new Set(resolvedDetailTabs.map((tab) => tab.key));
    const timer = window.setTimeout(() => {
      setMergedParentMap((prev) => {
        let changed = false;
        const next: Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTabKey>> = {};
        Object.entries(prev).forEach(([child, parent]) => {
          const childKey = child as ResourceCenterDetailTabKey;
          if (!existingKeys.has(childKey)) {
            changed = true;
            return;
          }
          if (!parent || !existingKeys.has(parent)) {
            changed = true;
            return;
          }
          next[childKey] = parent;
        });
        return changed ? next : prev;
      });
      setGroupActiveMemberMap((prev) => {
        let changed = false;
        const next: Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTabKey>> = {};
        Object.entries(prev).forEach(([root, activeMember]) => {
          const rootKey = root as ResourceCenterDetailTabKey;
          if (!existingKeys.has(rootKey)) {
            changed = true;
            return;
          }
          if (!activeMember || !existingKeys.has(activeMember)) {
            changed = true;
            return;
          }
          next[rootKey] = activeMember;
        });
        return changed ? next : prev;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedDetailTabs]);

  useEffect(() => {
    topPanelOrderRef.current = [
      ...fixedTabItems.map((item) => item.key),
      ...visibleDetailTabs.map((tab) => tab.key),
    ];
  }, [fixedTabItems, visibleDetailTabs]);

  const getDetailRootKey = useCallback(
    (key: ResourceCenterDetailTabKey) => resolveDetailRootKey(key, mergedParentMap),
    [mergedParentMap]
  );

  const mergeDetailTabs = useCallback(
    (sourceKey: ResourceCenterDetailTabKey, targetKey: ResourceCenterDetailTabKey) => {
      const reduced = reduceMergeDetailTabs({
        detailTabs: resolvedDetailTabs,
        mergedParentMap,
        groupActiveMemberMap,
        sourceKey,
        targetKey,
        activeDetailKey: isDetailTabKey(String(activePanel))
          ? (activePanel as ResourceCenterDetailTabKey)
          : null,
      });
      if (!reduced.changed) return;
      setMergedParentMap(reduced.mergedParentMap);
      setGroupActiveMemberMap(reduced.groupActiveMemberMap);
      if (reduced.nextActiveDetailKey) {
        setActivePanel(reduced.nextActiveDetailKey);
      }
    },
    [activePanel, groupActiveMemberMap, mergedParentMap, resolvedDetailTabs]
  );

  const handleOpenDetailTab = useCallback(
    (payload: ResourceCenterDetailOpenPayload) => {
      const {
        docId,
        kind,
        label,
        templateId,
        jumpToPage,
        jumpToken,
        autoMergeToActiveGroup,
        mergeTargetKey,
      } = payload;
      const key = buildDetailTabKey(kind, docId);
      setDetailTabs((prev) => {
        const exists = prev.find((item) => item.key === key);
        if (!exists) {
          return [
            ...prev,
            {
              key,
              label: label || docId,
              kind,
              docId,
              templateId,
              jumpToPage,
              jumpToken,
            },
          ];
        }
        return prev.map((item) =>
          item.key === key
            ? {
                ...item,
                label: label || item.label,
                templateId: templateId ?? item.templateId,
                jumpToPage: jumpToPage ?? item.jumpToPage,
                jumpToken: jumpToken ?? item.jumpToken,
              }
            : item
        );
      });
      if (autoMergeToActiveGroup) {
        const preferredMergeTarget =
          mergeTargetKey &&
          mergeTargetKey !== key &&
          detailTabsMap.has(mergeTargetKey)
            ? mergeTargetKey
            : null;
        const activeMergeTarget =
          isDetailTabKey(String(activePanel)) && activePanel !== key
            ? (activePanel as ResourceCenterDetailTabKey)
            : null;
        const mergeTarget = preferredMergeTarget ?? activeMergeTarget;
        if (mergeTarget) {
          mergeDetailTabs(key, mergeTarget);
        }
      }
      setActivePanel(key);
    },
    [activePanel, detailTabsMap, mergeDetailTabs]
  );

  const handleSetActiveTab = useCallback((tab: ResourceCenterTab) => {
    setActiveTab(tab);
    setActivePanel(tab);
  }, []);

  const handleCloseDetailTab = useCallback((key: ResourceCenterDetailTabKey) => {
    const reduced = reduceCloseDetailTabGroup({
      key,
      detailTabs: resolvedDetailTabs,
      mergedParentMap,
      groupActiveMemberMap,
    });
    const { closeRoot, membersToClose } = reduced;

    setDetailTabs(reduced.detailTabs);
    setMergedParentMap(reduced.mergedParentMap);
    setGroupActiveMemberMap(reduced.groupActiveMemberMap);
    setLastDetailTab((prev) => (prev && membersToClose.has(prev.key) ? null : prev));
    setActivePanel((current) => {
      if (
        !isDetailTabKey(String(current)) ||
        !membersToClose.has(current as ResourceCenterDetailTabKey)
      ) {
        return current;
      }
      const currentOrder = topPanelOrderRef.current;
      const currentIndex = currentOrder.findIndex((item) => item === closeRoot);
      const fallback =
        lastListPanelRef.current ??
        currentOrder[currentIndex - 1] ??
        currentOrder[currentIndex + 1] ??
        'all';
      return isResourceCenterPanel(fallback) ? fallback : 'all';
    });
  }, [groupActiveMemberMap, mergedParentMap, resolvedDetailTabs]);

  const handleDetachDetailTab = useCallback((key: ResourceCenterDetailTabKey) => {
    const reduced = reduceDetachDetailTab({
      key,
      detailTabs: resolvedDetailTabs,
      mergedParentMap,
      groupActiveMemberMap,
    });
    if (reduced.changed) {
      setMergedParentMap(reduced.mergedParentMap);
      setGroupActiveMemberMap(reduced.groupActiveMemberMap);
    }
    setActivePanel(reduced.nextActiveDetailKey);
  }, [groupActiveMemberMap, mergedParentMap, resolvedDetailTabs]);

  const handleCloseSingleDetailTab = useCallback((key: ResourceCenterDetailTabKey) => {
    const root = getDetailRootKey(key);
    const groupMembers = resolvedDetailTabs
      .map((item) => item.key)
      .filter((itemKey) => getDetailRootKey(itemKey) === root);
    if (groupMembers.length <= 1) {
      handleCloseDetailTab(root);
      return;
    }
    const nextRoot = key === root
      ? (groupMembers.find((itemKey) => itemKey !== key) ?? root)
      : root;
    setDetailTabs((prev) => prev.filter((item) => item.key !== key));
    setMergedParentMap((prev) => {
      const next: Partial<Record<ResourceCenterDetailTabKey, ResourceCenterDetailTabKey>> = {};
      Object.entries(prev).forEach(([child, parent]) => {
        const childKey = child as ResourceCenterDetailTabKey;
        if (childKey === key) return;
        if (!parent) return;
        if (parent === key || (key === root && parent === root)) {
          if (childKey !== nextRoot) {
            next[childKey] = nextRoot;
          }
          return;
        }
        next[childKey] = parent;
      });
      return next;
    });
    setGroupActiveMemberMap((prev) => {
      const next = { ...prev };
      if (key === root) {
        const rootActive = next[root];
        delete next[root];
        next[nextRoot] =
          rootActive && rootActive !== key
            ? rootActive
            : nextRoot;
      } else if (next[root] === key) {
        next[root] = root;
      }
      delete next[key];
      return next;
    });
    setLastDetailTab((prev) => (prev?.key === key ? null : prev));
    setActivePanel((current) => (current === key ? nextRoot : current));
  }, [getDetailRootKey, handleCloseDetailTab, resolvedDetailTabs]);

  const handleClearDetailJump = useCallback((key: ResourceCenterDetailTabKey) => {
    setDetailTabs((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, jumpToPage: undefined, jumpToken: undefined }
          : item
      )
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeDetailTab) {
        setLastDetailTab(activeDetailTab);
        return;
      }
      setLastDetailTab((prev) => {
        if (!prev) return prev;
        if (detailTabsMap.has(prev.key)) return prev;
        return null;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeDetailTab, detailTabsMap]);

  const handleSelectTopTab = useCallback(
    (panel: ResourceCenterPanel) => {
      if (panel === 'ai') {
        setActivePanel('ai');
        return;
      }
      if (isResourceCenterTab(panel)) {
        handleSetActiveTab(panel);
        return;
      }
      if (detailTabsMap.has(panel)) {
        setActivePanel(panel);
        return;
      }
      const root = getDetailRootKey(panel);
      const preferredPanel = groupActiveMemberMap[root];
      const fallbackPanel = detailTabsMap.has(root) ? root : panel;
      const nextPanel = preferredPanel && detailTabsMap.has(preferredPanel) ? preferredPanel : fallbackPanel;
      setActivePanel(nextPanel);
    },
    [detailTabsMap, getDetailRootKey, groupActiveMemberMap, handleSetActiveTab]
  );

  return {
    activeTab,
    activePanel,
    setActivePanel,
    activeTopPanel,
    topTabItems,
    detailTabGroups,
    detailTabs: resolvedDetailTabs,
    detailTabsMap,
    activeDetailTab,
    lastDetailTab: lastDetailTab ? { ...lastDetailTab, label: resolveTabLabel(lastDetailTab, docNameMap) } : null,
    mergedParentMap,
    getDetailRootKey,
    handleSetActiveTab,
    handleSelectTopTab,
    handleOpenDetailTab,
    handleCloseDetailTab,
    handleCloseSingleDetailTab,
    handleDetachDetailTab,
    mergeDetailTabs,
    handleClearDetailJump,
  };
};

export default useDetailTabs;
