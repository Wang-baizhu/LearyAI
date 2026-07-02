// useResourceCenterPageModel.test.ts 负责验证资源中心页面的跨特性编排。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useState: vi.fn((initialValue: unknown) => [initialValue, vi.fn()]),
  useMemo: vi.fn((factory: () => unknown) => factory()),
  useCallback: vi.fn((fn: (...args: never[]) => unknown) => fn),
  useEffect: vi.fn((effect: () => void | (() => void)) => effect()),
  useRef: vi.fn((initialValue: unknown) => ({ current: initialValue })),
  location: {
    key: 'resource-center',
    state: null,
  },
  dispatch: vi.fn(),
  appState: {
    resourceCenter: {
      search: 'needle',
      fileType: 'pdf',
      selectedTemplateTags: {
        mindmap: 'mindmap-tag',
        quiz: 'question-tag',
      },
      selectedTemplateSources: {
        mindmap: 'mindmap-source',
        quiz: 'question-source',
      },
      pageByTab: {
        all: 1,
        kbdoc: 2,
        mindmap: 3,
        quiz: 4,
        card: 5,
      },
      size: 20,
      referencedResources: [{ id: 'doc-1', docId: 'doc-1', name: '文档一', fileType: 'pdf', previewUrl: null }],
      referencedResourcesByContext: {
        'project-1::kb-1': [{ id: 'doc-1', docId: 'doc-1', name: '文档一', fileType: 'pdf', previewUrl: null }],
      },
      citationJump: null,
      aiPanelOpenToken: null,
      videoJumpRequest: null,
    },
  },
  setCurrentContext: vi.fn((payload) => ({ type: 'resource/setCurrentContext', payload })),
  clearCurrentContext: vi.fn(() => ({ type: 'resource/clearCurrentContext' })),
  setPage: vi.fn((payload) => ({ type: 'resource/setPage', payload })),
  selectReferencedResourcesByContext: vi.fn((state, context) => {
    if (!context?.projectId || !context?.kbId) return [];
    return state.resourceCenter.referencedResourcesByContext[`${context.projectId}::${context.kbId}`] ?? [];
  }),
  useTheme: vi.fn(() => ({ isDarkMode: true, toggleTheme: vi.fn() })),
  useDetailTabs: vi.fn(),
  useDetailTabsDnd: vi.fn(),
  useResourceCenterListState: vi.fn(),
  useKbdocList: vi.fn(),
  useReferenceController: vi.fn(),
  useResourceCenterOptions: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
  })),
  listArgs: null as null | Record<string, unknown>,
  referenceArgs: null as null | Record<string, unknown>,
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: mocks.useState,
    useMemo: mocks.useMemo,
    useCallback: mocks.useCallback,
    useEffect: mocks.useEffect,
    useRef: mocks.useRef,
  };
});

vi.mock('react-router-dom', () => ({
  useLocation: () => mocks.location,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: never) => unknown) => selector(mocks.appState as never),
}));

vi.mock('@/shared/contexts/useTheme', () => ({
  useTheme: mocks.useTheme,
}));

vi.mock('@/modules/resource/entities/resource-center', () => ({
  setCurrentContext: mocks.setCurrentContext,
  clearCurrentContext: mocks.clearCurrentContext,
  setPage: mocks.setPage,
  selectReferencedResourcesByContext: mocks.selectReferencedResourcesByContext,
}));

vi.mock('@/modules/resource/features/resource-center-tabs', () => ({
  useDetailTabs: mocks.useDetailTabs,
  useDetailTabsDnd: mocks.useDetailTabsDnd,
}));

vi.mock('@/modules/resource/features/resource-center-list', () => ({
  default: mocks.useResourceCenterListState,
}));

vi.mock('@/modules/kbdoc', () => ({
  useKbdocList: mocks.useKbdocList,
}));

vi.mock('@/modules/resource/features/resource-center-reference', () => ({
  useReferenceController: mocks.useReferenceController,
}));

vi.mock('@/modules/resource/adapter/catalog/model/hooks/useResourceCenterOptions', () => ({
  useResourceCenterOptions: mocks.useResourceCenterOptions,
}));

import useResourceCenterPageModel from '../../useResourceCenterPageModel';

describe('useResourceCenterPageModel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.useState.mockReset();
    mocks.useState.mockImplementation((initialValue: unknown) => [initialValue, vi.fn()]);
    mocks.useMemo.mockClear();
    mocks.useCallback.mockClear();
    mocks.useEffect.mockClear();
    mocks.useRef.mockClear();
    mocks.dispatch.mockClear();
    mocks.useTheme.mockClear();
    mocks.useDetailTabs.mockReset();
    mocks.useDetailTabsDnd.mockReset();
    mocks.useResourceCenterListState.mockReset();
    mocks.useKbdocList.mockReset();
    mocks.useReferenceController.mockReset();
    mocks.useResourceCenterOptions.mockReset();
    mocks.setCurrentContext.mockClear();
    mocks.clearCurrentContext.mockClear();
    mocks.setPage.mockClear();
    mocks.selectReferencedResourcesByContext.mockClear();
    mocks.useResourceCenterOptions.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });
    mocks.listArgs = null;
    mocks.referenceArgs = null;

    mocks.useDetailTabs.mockReturnValue({
      activeTab: 'mindmap',
      activePanel: 'doc:detail',
      activeTopPanel: 'doc:detail',
      setActivePanel: vi.fn(),
      topTabItems: [{ key: 'all', label: '全部' }],
      detailTabGroups: {},
      detailTabs: [{ key: 'doc:detail', label: 'Detail' }],
      detailTabsMap: new Map([['doc:detail', { key: 'doc:detail', label: 'Detail' }]]),
      activeDetailTab: { key: 'doc:detail', label: 'Detail' },
      lastDetailTab: null,
      handleSetActiveTab: vi.fn(),
      handleSelectTopTab: vi.fn(),
      handleOpenDetailTab: vi.fn(),
      handleCloseDetailTab: vi.fn(),
      handleCloseSingleDetailTab: vi.fn(),
      handleDetachDetailTab: vi.fn(),
      mergeDetailTabs: vi.fn(),
      handleClearDetailJump: vi.fn(),
      getDetailRootKey: vi.fn((key: string) => key),
    });

    mocks.useDetailTabsDnd.mockReturnValue({
      isTabDragging: true,
      dragSensors: [],
      collisionWithFallback: vi.fn(),
      handleTabDragStart: vi.fn(),
      handleTabDragEnd: vi.fn(),
      handleTabDragCancel: vi.fn(),
    });

    mocks.useResourceCenterListState.mockImplementation((args) => {
      mocks.listArgs = args as Record<string, unknown>;
      return {
        listState: {
          page: 3,
          isKnowledgeTab: false,
          gridItems: [],
          sections: [
            {
              key: 'docs',
              panel: 'kbdoc',
              items: [],
              total: 0,
              isLoading: false,
              isError: false,
              errorMessage: '',
            },
          ],
        },
        dockedListState: null,
        kbdocListQuery: {
          data: {
            items: [
              {
                docId: 'doc-1',
                name: '文档一',
                fileType: 'pdf',
                previewUrl: null,
                status: 'DONE',
                size: 1,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
          isLoading: false,
        },
      };
    });

    mocks.useKbdocList.mockReturnValue({
      data: {
        items: [
          {
            docId: 'doc-ref-1',
            name: '引用文档一',
            fileType: 'pdf',
            previewUrl: null,
            status: 'DONE',
            size: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      isLoading: false,
      isFetching: false,
    });

    mocks.useReferenceController.mockImplementation((args) => {
      mocks.referenceArgs = args as Record<string, unknown>;
      return {
        referenceSourceItems: args.referenceSourceItems,
        sidebarResources: [{ id: 'doc-1', title: '文档一' }],
        sidebarReferenced: [{ id: 'doc-1', title: '文档一' }],
        referencedDocRefs: [{ id: 'doc-1', name: '文档一' }],
        fallbackDocRef: { id: 'doc-1', name: '文档一' },
        handleToggleReference: vi.fn(),
        handleListToggleReference: vi.fn(),
        handleClearReferences: vi.fn(),
        handleResourceDeleted: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('会把派生状态传给列表、引用和 dock/outlet context', () => {
    const model = useResourceCenterPageModel({
      projectId: 'project-1',
      kbId: 'kb-1',
      sidebarDropZoneId: 'sidebar-zone',
      detailMergeDropZonePrefix: 'merge:',
      detailGroupDragIdPrefix: 'group:',
    });

    expect(mocks.setCurrentContext).toHaveBeenCalledWith({
      projectId: 'project-1',
      kbId: 'kb-1',
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'resource/setCurrentContext',
      payload: {
        projectId: 'project-1',
        kbId: 'kb-1',
      },
    });

    expect(mocks.useResourceCenterListState).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'needle',
        fileType: 'pdf',
        activeSelectedTemplateTag: 'mindmap-tag',
        activeSelectedTemplateSource: 'mindmap-source',
        dockedSelectedTemplateTag: null,
        dockedSelectedTemplateSource: null,
        activePage: 3,
        dockedPage: 1,
        size: 20,
        kbId: 'kb-1',
        projectId: 'project-1',
        activeTab: 'mindmap',
        dockedPanel: 'ai',
      })
    );
    expect(mocks.useDetailTabs).toHaveBeenCalledWith(expect.objectContaining({
      fixedTabItems: [
        { key: 'all', label: '全部资源' },
        { key: 'kbdoc', label: '参考文档' },
      ],
    }));
    expect(mocks.useKbdocList).toHaveBeenCalledWith({
      search: 'needle',
      fileType: 'pdf',
      page: 1,
      size: 20,
      kbId: 'kb-1',
      projectId: 'project-1',
    });
    expect(mocks.referenceArgs).toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        kbId: 'kb-1',
        citationJump: null,
        syncItems: [],
        referenceSourceItems: [
          expect.objectContaining({
            docId: 'doc-ref-1',
            name: '引用文档一',
          }),
        ],
      })
    );

    expect(model.dnd.isTabDragging).toBe(true);
    expect(model.dockProps.disableTemplatePointerEvents).toBe(true);
    expect(model.dockProps.referencedDocIds).toEqual(['doc-1']);
    expect(model.dockProps.fallbackDocRef).toEqual({ id: 'doc-1', name: '文档一' });
    expect(model.outletContext.activeTab).toBe('mindmap');
    expect(model.outletContext.activePanel).toBe('doc:detail');
    expect(model.outletContext.topTabItems).toEqual([{ key: 'all', label: '全部' }]);

    model.dockProps.onPageChange('quiz', 8);
    expect(mocks.setPage).toHaveBeenCalledWith({ tab: 'quiz', page: 8 });
    expect(mocks.dispatch).toHaveBeenLastCalledWith({
      type: 'resource/setPage',
      payload: { tab: 'quiz', page: 8 },
    });
  });

  it('资源中心模型不再向列表态透传模板插件集合', () => {
    useResourceCenterPageModel({
      projectId: 'project-1',
      kbId: 'kb-1',
      sidebarDropZoneId: 'sidebar-zone',
      detailMergeDropZonePrefix: 'merge:',
      detailGroupDragIdPrefix: 'group:',
    });

    expect(mocks.useResourceCenterListState).toHaveBeenCalledWith(
      expect.not.objectContaining({
        enabledTemplatePlugins: expect.anything(),
      })
    );
    expect(mocks.useDetailTabs).toHaveBeenCalledWith(expect.objectContaining({
      fixedTabItems: [
        { key: 'all', label: '全部资源' },
        { key: 'kbdoc', label: '参考文档' },
      ],
    }));
  });

  it('收到视频跳转请求时不会自动打开或切换视频详情 tab', () => {
    const handleOpenDetailTab = vi.fn();
    const setSidebarDetailTab = vi.fn();
    mocks.appState.resourceCenter.videoJumpRequest = {
      docId: 'doc-video-1',
      startSeconds: 7,
      token: 321,
    };
    mocks.useDetailTabs.mockReturnValue({
      activeTab: 'mindmap',
      activePanel: 'doc:detail',
      activeTopPanel: 'doc:detail',
      setActivePanel: vi.fn(),
      topTabItems: [{ key: 'all', label: '全部' }],
      detailTabGroups: {},
      detailTabs: [],
      detailTabsMap: new Map(),
      activeDetailTab: { key: 'doc:detail', label: 'Detail' },
      lastDetailTab: null,
      handleSetActiveTab: vi.fn(),
      handleSelectTopTab: vi.fn(),
      handleOpenDetailTab,
      handleCloseDetailTab: vi.fn(),
      handleCloseSingleDetailTab: vi.fn(),
      handleDetachDetailTab: vi.fn(),
      mergeDetailTabs: vi.fn(),
      handleClearDetailJump: vi.fn(),
      getDetailRootKey: vi.fn((key: string) => key),
    });

    mocks.useState.mockImplementationOnce((initialValue: unknown) => [initialValue, setSidebarDetailTab]);
    mocks.useState.mockImplementation((initialValue: unknown) => [initialValue, vi.fn()]);

    useResourceCenterPageModel({
      sidebarDropZoneId: 'sidebar-zone',
      detailMergeDropZonePrefix: 'merge:',
      detailGroupDragIdPrefix: 'group:',
    });

    vi.runAllTimers();

    expect(handleOpenDetailTab).not.toHaveBeenCalled();
    expect(setSidebarDetailTab).not.toHaveBeenCalled();
    mocks.appState.resourceCenter.videoJumpRequest = null;
  });

  it('在 kbdoc 分页页内会用当前可见文档恢复引用，同时保持引用源查询固定第一页', () => {
    mocks.useDetailTabs.mockReturnValue({
      activeTab: 'kbdoc',
      activePanel: 'kbdoc',
      activeTopPanel: 'kbdoc',
      setActivePanel: vi.fn(),
      topTabItems: [{ key: 'kbdoc', label: '文档' }],
      detailTabGroups: {},
      detailTabs: [],
      detailTabsMap: new Map(),
      activeDetailTab: null,
      lastDetailTab: null,
      handleSetActiveTab: vi.fn(),
      handleSelectTopTab: vi.fn(),
      handleOpenDetailTab: vi.fn(),
      handleCloseDetailTab: vi.fn(),
      handleCloseSingleDetailTab: vi.fn(),
      handleDetachDetailTab: vi.fn(),
      mergeDetailTabs: vi.fn(),
      handleClearDetailJump: vi.fn(),
      getDetailRootKey: vi.fn((key: string) => key),
    });
    mocks.useResourceCenterListState.mockReturnValue({
      listState: {
        page: 2,
        isKnowledgeTab: true,
        gridItems: [
          {
            docId: 'doc-page-2',
            name: '第二页文档',
            fileType: 'pdf',
            previewUrl: null,
            status: 'DONE',
            size: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      dockedListState: null,
      kbdocListQuery: { data: { items: [] }, isLoading: false },
    });

    useResourceCenterPageModel({
      projectId: 'project-1',
      kbId: 'kb-1',
      sidebarDropZoneId: 'sidebar-zone',
      detailMergeDropZonePrefix: 'merge:',
      detailGroupDragIdPrefix: 'group:',
    });

    expect(mocks.useKbdocList).toHaveBeenCalledWith({
      search: 'needle',
      fileType: 'pdf',
      page: 1,
      size: 20,
      kbId: 'kb-1',
      projectId: 'project-1',
    });
    expect(mocks.referenceArgs).toEqual(
      expect.objectContaining({
        syncItems: [
          expect.objectContaining({
            docId: 'doc-page-2',
            name: '第二页文档',
          }),
        ],
        referenceSourceItems: expect.arrayContaining([
          expect.objectContaining({
            docId: 'doc-ref-1',
          }),
        ]),
      })
    );
  });
});
