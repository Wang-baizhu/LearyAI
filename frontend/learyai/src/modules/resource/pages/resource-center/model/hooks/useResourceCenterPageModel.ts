// useResourceCenterPageModel 负责资源中心页面的跨特性编排。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { useTheme } from '@/shared/contexts/useTheme';
import { useKbdocList, type ResourceListItem } from '@/modules/kbdoc';
import {
  clearCurrentContext,
  selectReferencedResourcesByContext,
  setCurrentContext,
  setPage,
} from '../../../../entities/resource-center';
import { useDetailTabs, useDetailTabsDnd } from '../../../../features/resource-center-tabs';
import useResourceCenterListState from '../../../../features/resource-center-list';
import { useReferenceController } from '../../../../features/resource-center-reference';
import { useResourceCenterOptions } from '../../../../adapter/catalog/model/hooks/useResourceCenterOptions';
import type { ResourceRouteState } from '../../../../route';
import type {
  ResourceCenterDetailTab,
  ResourceCenterStaticPanel,
  ResourceCenterTab,
} from '../../../../entities/resource-center';
import type { ResourceCenterOutletContext } from '../../ui/ResourceCenterLayout';
import type { ResourceCenterDockProps } from '../../../../widgets/resource-center-dock';

type ResourceCenterMobileView = 'ai' | 'resource';

const mergeDocItems = (...groups: Array<ResourceListItem[] | undefined>): ResourceListItem[] => {
  const merged = new Map<string, ResourceListItem>();
  groups.forEach((items) => {
    items?.forEach((item) => {
      merged.set(item.docId, item);
    });
  });
  return Array.from(merged.values());
};

interface UseResourceCenterPageModelParams {
  projectId?: string;
  kbId?: string;
  sidebarDropZoneId: string;
  detailMergeDropZonePrefix: string;
  detailGroupDragIdPrefix: string;
}

const useResourceCenterPageModel = ({
  projectId,
  kbId,
  sidebarDropZoneId,
  detailMergeDropZonePrefix,
  detailGroupDragIdPrefix,
}: UseResourceCenterPageModelParams) => {
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const dispatch = useAppDispatch();
  const referencedResources = useAppSelector((state) =>
    selectReferencedResourcesByContext(state, { projectId, kbId })
  );
  const {
    search,
    fileType,
    selectedTemplateTags,
    selectedTemplateSources,
    pageByTab,
    size,
    citationJump,
    aiPanelOpenToken,
    docNameMap,
  } =
    useAppSelector((state) => state.resourceCenter);
  const resourceCenterOptionsQuery = useResourceCenterOptions({ projectId, kbId });
  const fixedTabItems = useMemo(
    () => [
      { key: 'all', label: '全部资源' },
      { key: 'kbdoc', label: '参考文档' },
    ],
    []
  );
  const tabs = useDetailTabs({ docNameMap, fixedTabItems });
  const [sidebarDetailTab, setSidebarDetailTab] = useState<ResourceCenterDetailTab | null>(null);
  const [dockedPanel, setDockedPanel] = useState<ResourceCenterStaticPanel>('ai');
  const [mobileActiveView, setMobileActiveView] = useState<ResourceCenterMobileView>('resource');
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 1023px)').matches
      : false
  ));
  const [isMobileActionSheetOpen, setIsMobileActionSheetOpen] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const lastAiPanelOpenTokenRef = useRef<number | null>(null);
  const activeSelectedTemplateTag =
    tabs.activeTab !== 'all' && tabs.activeTab !== 'kbdoc'
      ? selectedTemplateTags[tabs.activeTab] ?? null
      : null;
  const activeSelectedTemplateSource =
    tabs.activeTab !== 'all' && tabs.activeTab !== 'kbdoc'
      ? selectedTemplateSources[tabs.activeTab] ?? null
      : null;
  const dockedSelectedTemplateTag =
    dockedPanel !== 'ai' && dockedPanel !== 'all' && dockedPanel !== 'kbdoc'
      ? selectedTemplateTags[dockedPanel] ?? null
      : null;
  const dockedSelectedTemplateSource =
    dockedPanel !== 'ai' && dockedPanel !== 'all' && dockedPanel !== 'kbdoc'
      ? selectedTemplateSources[dockedPanel] ?? null
      : null;
  const activePage = pageByTab[tabs.activeTab] ?? 1;
  const dockedPage = dockedPanel === 'ai' ? 1 : (pageByTab[dockedPanel] ?? 1);

  const list = useResourceCenterListState({
    search,
    fileType,
    activeSelectedTemplateTag,
    activeSelectedTemplateSource,
    dockedSelectedTemplateTag,
    dockedSelectedTemplateSource,
    activePage,
    dockedPage,
    size,
    kbId,
    projectId,
    activeTab: tabs.activeTab,
    dockedPanel,
  });
  const visibleKbdocItems = useMemo(
    () => mergeDocItems(
      list.listState.isKnowledgeTab
        ? list.listState.gridItems as ResourceListItem[]
        : (list.listState.sections?.find((section) => section.panel === 'kbdoc')?.items as ResourceListItem[] | undefined),
      list.dockedListState?.isKnowledgeTab
        ? list.dockedListState.gridItems as ResourceListItem[]
        : (list.dockedListState?.sections?.find((section) => section.panel === 'kbdoc')?.items as ResourceListItem[] | undefined),
    ),
    [list.dockedListState, list.listState]
  );
  const referenceKbdocQuery = useKbdocList({
    search: search || undefined,
    fileType: fileType === 'all' ? undefined : fileType,
    page: 1,
    size,
    kbId,
    projectId,
  });
  const referenceSourceItems = useMemo(
    () => mergeDocItems(referenceKbdocQuery.data?.items ?? [], visibleKbdocItems),
    [referenceKbdocQuery.data?.items, visibleKbdocItems]
  );
  const handleOpenDetailTab = useCallback<ResourceCenterOutletContext['onOpenDetailTab']>(
    (payload) => {
      setMobileActiveView('resource');
      tabs.handleOpenDetailTab(payload);
    },
    [tabs]
  );

  const reference = useReferenceController({
    dispatch,
    projectId,
    kbId,
    referencedResources,
    syncItems: visibleKbdocItems,
    referenceSourceItems,
    docOptions: resourceCenterOptionsQuery.data ?? [],
    isReferenceSourceReady:
      !referenceKbdocQuery.isLoading
      && !referenceKbdocQuery.isFetching
      && !resourceCenterOptionsQuery.isLoading
      && !resourceCenterOptionsQuery.isFetching,
    citationJump,
    onOpenDetailTab: handleOpenDetailTab,
  });

  useEffect(() => {
    dispatch(
      setCurrentContext({
        projectId,
        kbId,
      })
    );
  }, [dispatch, kbId, projectId]);

  useEffect(
    () => () => {
      dispatch(clearCurrentContext());
    },
    [dispatch]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!aiPanelOpenToken || aiPanelOpenToken === lastAiPanelOpenTokenRef.current) return;
    lastAiPanelOpenTokenRef.current = aiPanelOpenToken;
    const timer = window.setTimeout(() => {
      setDockedPanel('ai');
      setSidebarDetailTab(null);
      setMobileActiveView('ai');
      setIsMobileActionSheetOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [aiPanelOpenToken]);

  useEffect(() => {
    const routeState = location.state as ResourceRouteState | null;
    if (routeState?.initialMobileView !== 'ai') {
      return;
    }
    const timer = window.setTimeout(() => {
      setDockedPanel('ai');
      setSidebarDetailTab(null);
      setMobileActiveView('ai');
      setIsMobileActionSheetOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.key, location.state]);

  useEffect(() => {
    if (!sidebarDetailTab) return;
    if (!tabs.detailTabsMap.has(sidebarDetailTab.key)) {
      const timer = window.setTimeout(() => setSidebarDetailTab(null), 0);
      return () => window.clearTimeout(timer);
    }
  }, [sidebarDetailTab, tabs.detailTabsMap]);

  const handleSelectTopTab = useCallback<ResourceCenterOutletContext['onSelectTopTab']>(
    (panel) => {
      setMobileActiveView('resource');
      setIsMobileActionSheetOpen(false);
      tabs.handleSelectTopTab(panel);
    },
    [tabs]
  );

  const handleMobileViewChange = useCallback((view: ResourceCenterMobileView) => {
    setMobileActiveView(view);
    setIsMobileActionSheetOpen(false);
    if (view === 'ai') {
      setDockedPanel('ai');
      setSidebarDetailTab(null);
    }
  }, []);

  const openMobileActionSheet = useCallback(() => {
    setMobileActiveView('resource');
    setIsMobileActionSheetOpen(true);
  }, []);

  const closeMobileActionSheet = useCallback(() => {
    setIsMobileActionSheetOpen(false);
  }, []);

  const toggleMobileActionSheet = useCallback(() => {
    setMobileActiveView('resource');
    setIsMobileActionSheetOpen((prev) => !prev);
  }, []);

  const handlePageChange = useCallback(
    (panel: ResourceCenterTab, nextPage: number) => {
      dispatch(setPage({ tab: panel, page: nextPage }));
    },
    [dispatch]
  );

  const handleOpenVideoDetailTab = useCallback(
    (docId: string, label: string) => {
      handleOpenDetailTab({
        docId,
        label,
        kind: 'video',
      });
    },
    [handleOpenDetailTab]
  );

  const dnd = useDetailTabsDnd({
    sidebarDropZoneId,
    detailMergeDropZonePrefix,
    detailGroupDragIdPrefix,
    detailTabs: tabs.detailTabs,
    detailTabsMap: tabs.detailTabsMap,
    activePanel: tabs.activePanel,
    getDetailRootKey: tabs.getDetailRootKey,
    handleDetachDetailTab: tabs.handleDetachDetailTab,
    mergeDetailTabs: tabs.mergeDetailTabs,
    setActivePanel: tabs.setActivePanel,
    setSidebarDetailTab,
  });

  const disableTemplatePointerEvents = dnd.isTabDragging || isSidebarResizing;

  const dockProps: ResourceCenterDockProps = useMemo(
    () => ({
      dockedPanel,
      layoutMode: isMobileViewport ? 'mobile' : 'desktop',
      tabDropZoneId: sidebarDropZoneId,
      resources: reference.sidebarResources,
      referencedResources: reference.sidebarReferenced,
      referencedDocRefs: reference.referencedDocRefs,
      fallbackDocRef: reference.fallbackDocRef,
      onToggleReference: reference.handleToggleReference,
      onToggleListReference: reference.handleListToggleReference,
      referencedDocIds: reference.referencedDocRefs.map((item) => item.id),
      onClearReferences: reference.handleClearReferences,
      onResourceDeleted: reference.handleResourceDeleted,
      listState: list.dockedListState,
      sidebarDetailTab,
      onClearSidebarDetail: () => {
        setSidebarDetailTab(null);
        setDockedPanel('ai');
        setMobileActiveView('ai');
        setIsMobileActionSheetOpen(false);
      },
      onPageChange: handlePageChange,
      forceExpandToken: aiPanelOpenToken,
      onResizeStateChange: setIsSidebarResizing,
      disableTemplatePointerEvents,
      onOpenVideoDetailTab: handleOpenVideoDetailTab,
      isDarkMode,
      toggleTheme,
    }),
    [
      aiPanelOpenToken,
      disableTemplatePointerEvents,
      dockedPanel,
      handlePageChange,
      isMobileViewport,
      isDarkMode,
      list.dockedListState,
      reference.fallbackDocRef,
      reference.handleClearReferences,
      reference.handleListToggleReference,
      reference.handleResourceDeleted,
      reference.handleToggleReference,
      reference.referencedDocRefs,
      reference.sidebarReferenced,
      reference.sidebarResources,
      sidebarDetailTab,
      sidebarDropZoneId,
      handleOpenVideoDetailTab,
      toggleTheme,
    ]
  );

  const outletContext: ResourceCenterOutletContext = useMemo(
    () => ({
      activeTab: tabs.activeTab,
      activePanel: tabs.activePanel,
      activeTopPanel: tabs.activeTopPanel,
      setActiveTab: tabs.handleSetActiveTab,
      topTabItems: tabs.topTabItems,
      detailTabGroups: tabs.detailTabGroups,
      onSelectTopTab: handleSelectTopTab,
      detailTabs: tabs.detailTabs,
      activeDetailTab: tabs.activeDetailTab,
      lastDetailTab: tabs.lastDetailTab,
      onOpenDetailTab: handleOpenDetailTab,
      onCloseDetailTab: tabs.handleCloseDetailTab,
      onCloseSingleDetailTab: tabs.handleCloseSingleDetailTab,
      onDetachDetailTab: tabs.handleDetachDetailTab,
      onMergeDetailTabs: tabs.mergeDetailTabs,
      onClearDetailJump: tabs.handleClearDetailJump,
      sidebarDropZoneId,
      detailMergeDropZonePrefix,
      listState: list.listState,
      onToggleListReference: reference.handleListToggleReference,
      onPageChange: handlePageChange,
      referencedDocIds: reference.referencedDocRefs.map((item) => item.id),
      sidebarResources: reference.sidebarResources,
      sidebarReferencedResources: reference.sidebarReferenced,
      referencedDocRefs: reference.referencedDocRefs,
      fallbackDocRef: reference.fallbackDocRef,
      onToggleSidebarReference: reference.handleToggleReference,
      kbdocListItems: list.kbdocListQuery.data?.items ?? [],
      kbdocListLoading: list.kbdocListQuery.isLoading,
      onResourceDeleted: reference.handleResourceDeleted,
      onClearReferences: reference.handleClearReferences,
      disableTemplatePointerEvents,
      isMobileActionSheetOpen,
      openMobileActionSheet,
      closeMobileActionSheet,
    }),
    [
      closeMobileActionSheet,
      detailMergeDropZonePrefix,
      disableTemplatePointerEvents,
      handleOpenDetailTab,
      handlePageChange,
      handleSelectTopTab,
      isMobileActionSheetOpen,
      list.kbdocListQuery.data?.items,
      list.kbdocListQuery.isLoading,
      list.listState,
      openMobileActionSheet,
      reference.fallbackDocRef,
      reference.handleClearReferences,
      reference.handleListToggleReference,
      reference.handleResourceDeleted,
      reference.handleToggleReference,
      reference.referencedDocRefs,
      reference.sidebarReferenced,
      reference.sidebarResources,
      sidebarDropZoneId,
      tabs.activeDetailTab,
      tabs.activePanel,
      tabs.activeTab,
      tabs.activeTopPanel,
      tabs.detailTabGroups,
      tabs.detailTabs,
      tabs.handleClearDetailJump,
      tabs.handleCloseDetailTab,
      tabs.handleCloseSingleDetailTab,
      tabs.handleDetachDetailTab,
      tabs.handleSetActiveTab,
      tabs.lastDetailTab,
      tabs.mergeDetailTabs,
      tabs.topTabItems,
    ]
  );

  return {
    dnd,
    dockProps,
    isMobileActionSheetOpen,
    mobileActiveView,
    toggleMobileActionSheet,
    onMobileViewChange: handleMobileViewChange,
    outletContext,
  };
};

export default useResourceCenterPageModel;
