// @vitest-environment jsdom
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useNavigate: vi.fn(),
  useLocation: vi.fn(),
  useOutletContext: vi.fn(),
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
  useResourceScope: vi.fn(),
  clearDocNames: vi.fn(() => ({ type: 'resourceCenter/clearDocNames' })),
  setSearch: vi.fn((value: string) => ({ type: 'resourceCenter/setSearch', payload: value })),
  upsertDocNames: vi.fn((payload: any) => ({ type: 'resourceCenter/upsertDocNames', payload })),
  ResourceActionMenu: vi.fn((props: any) => <div data-testid="resource-action-menu">{props.label}</div>),
  ResourceShareTokenModal: vi.fn((props: any) => <div data-testid="resource-share-token-modal">{props.projectId}|{props.kbId}</div>),
  ResourceGenerateTaskModal: vi.fn((props: any) => <div data-testid="generate-task-modal">{props.type}</div>),
  TaskListButton: vi.fn((props: any) => <div data-testid="task-list-button">{props.projectId}|{props.kbId}</div>),
  ResourceImportModal: vi.fn((props: any) => <div data-testid="resource-import-modal">{props.projectId}</div>),
  ResourceImportTextModal: vi.fn((props: any) => <div data-testid="resource-import-text-modal">{props.projectId}</div>),
  ResourceImportUrlModal: vi.fn((props: any) => <div data-testid="resource-import-url-modal">{props.projectId}</div>),
  ThemeToggle: vi.fn((props: any) => <button type="button">theme:{props.isDarkMode ? 'dark' : 'light'}</button>),
  UserMenu: vi.fn((props: any) => <div data-testid="user-menu">{props.user?.name ?? 'anonymous'}</div>),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  useCurrentUser: vi.fn(),
  useUserSession: vi.fn(),
  authApi: {
    logout: vi.fn(),
  },
  useKbdocOptions: vi.fn(),
  useTheme: vi.fn(),
  DEFAULT_FLOW_CANVAS_BOARD: {
    boardId: 'resource-global-view',
    title: '全局视图',
  },
  ResourceTopTabs: vi.fn((props: any) => (
    <div data-testid="resource-top-tabs">
      {props.activeTopPanel}|{props.activePanel}|{props.activeListTab}|{props.topTabItems.length}
    </div>
  )),
  TourStep: vi.fn(({ children, tag, order }: any) => (
    <div data-testid="tour-step">
      {tag}|{order}
      {children}
    </div>
  )),
  ResourceCenterContent: vi.fn((props: any) => (
    <div data-testid="resource-center-content">
      {props.panel}|{props.variant}|{props.detailState?.docId ?? 'none'}|{props.detailStates?.length ?? 0}|{props.detailFloatingAction ? 'floating' : 'plain'}
    </div>
  )),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: mocks.useNavigate,
  useLocation: mocks.useLocation,
  useOutletContext: mocks.useOutletContext,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: mocks.useAppDispatch,
  useAppSelector: mocks.useAppSelector,
}));

vi.mock('../../../../entities/resource-center', () => ({
  clearDocNames: mocks.clearDocNames,
  setSearch: mocks.setSearch,
  upsertDocNames: mocks.upsertDocNames,
  useResourceScope: mocks.useResourceScope,
  openResourceCenterDetail: vi.fn(),
  openResourceCenterResourceDetail: vi.fn(),
  openResourceCenterVideoDetail: vi.fn(),
  isResourceCenterTab: (value: string) => ['all', 'kbdoc'].includes(value),
}));

vi.mock('../../../../features/resource-action-menu', () => ({
  default: mocks.ResourceActionMenu,
}));

vi.mock('../../../../features/resource-share-token', () => ({
  ResourceShareTokenModal: mocks.ResourceShareTokenModal,
}));

vi.mock('../../../../../task', () => ({
  ResourceGenerateTaskModal: mocks.ResourceGenerateTaskModal,
  TaskListButton: mocks.TaskListButton,
}));

vi.mock('../../../../../kbdoc', () => ({
  ResourceImportModal: mocks.ResourceImportModal,
  ResourceImportTextModal: mocks.ResourceImportTextModal,
  ResourceImportUrlModal: mocks.ResourceImportUrlModal,
  useKbdocOptions: mocks.useKbdocOptions,
}));

vi.mock('@/shared/ui/ThemeToggle', () => ({
  default: mocks.ThemeToggle,
}));

vi.mock('@/shared/ui/UserMenu', () => ({
  default: mocks.UserMenu,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('../../../../../auth', () => ({
  authApi: mocks.authApi,
  useCurrentUser: mocks.useCurrentUser,
  useUserSession: mocks.useUserSession,
}));

vi.mock('@/shared/contexts/useTheme', () => ({
  useTheme: mocks.useTheme,
}));

vi.mock('@/modules/flow-canvas', () => ({
  DEFAULT_FLOW_CANVAS_BOARD: mocks.DEFAULT_FLOW_CANVAS_BOARD,
}));

vi.mock('../../../../widgets/resource-top-tabs', () => ({
  ResourceTopTabs: mocks.ResourceTopTabs,
}));

vi.mock('@leary/tour-guide', () => ({
  TourStep: mocks.TourStep,
}));

vi.mock('../../../../widgets/resource-center-main', () => ({
  ResourceCenterContent: mocks.ResourceCenterContent,
}));

import ResourceCenterPage from '../ResourceCenterPage';

const buildOutletContext = (overrides: Record<string, unknown> = {}) => ({
  activeTab: 'all',
  activePanel: 'all',
  activeTopPanel: 'all',
  topTabItems: [{ key: 'all', label: '全部资源' }],
  detailTabGroups: [],
  onSelectTopTab: vi.fn(),
  activeDetailTab: null,
  lastDetailTab: null,
  detailTabs: [],
  onOpenDetailTab: vi.fn(),
  onCloseDetailTab: vi.fn(),
  onCloseSingleDetailTab: vi.fn(),
  detailMergeDropZonePrefix: 'merge:',
  onClearDetailJump: vi.fn(),
  listState: {
    kind: 'mixed',
    gridItems: [],
    itemCount: 1,
    availableTemplateTags: [],
    availableTemplateSources: [],
    isGridLoading: false,
    isGridError: false,
    gridErrorMessage: '',
    totalPages: 1,
    isKnowledgeTab: false,
    aggregatedGroups: [],
    page: 1,
    showPagination: false,
    sections: undefined,
  },
  onToggleListReference: vi.fn(),
  onPageChange: vi.fn(),
  referencedDocIds: ['doc-1'],
  sidebarResources: [{ docId: 'doc-1', name: 'Doc 1' }],
  sidebarReferencedResources: [],
  referencedDocRefs: [{ id: 'doc-1', name: 'Doc 1' }],
  fallbackDocRef: null,
  onToggleSidebarReference: vi.fn(),
  onClearReferences: vi.fn(),
  kbdocListLoading: false,
  onResourceDeleted: vi.fn(),
  disableTemplatePointerEvents: false,
  isMobileActionSheetOpen: false,
  closeMobileActionSheet: vi.fn(),
  ...overrides,
});

describe('ResourceCenterPage', () => {
  beforeEach(() => {
    const dispatch = vi.fn();
    const navigate = vi.fn();

    vi.clearAllMocks();
    mocks.useNavigate.mockReturnValue(navigate);
    mocks.useLocation.mockReturnValue({
      pathname: '/resource-center/project-1/kb-1',
      search: '?from=test',
      state: {
        fromPath: '/project/project-1',
      },
    });
    mocks.useResourceScope.mockReturnValue({ projectId: 'project-1', kbId: 'kb-1' });
    mocks.useAppDispatch.mockReturnValue(dispatch);
    mocks.useAppSelector.mockImplementation((selector: (state: any) => unknown) =>
      selector({
        resourceCenter: {
          search: '搜索词',
        },
      })
    );
    mocks.useCurrentUser.mockReturnValue({ id: 'user-1', name: 'Test User' });
    mocks.useUserSession.mockReturnValue({ setSession: vi.fn() });
    mocks.useKbdocOptions.mockReturnValue({
      data: [{ docId: 'doc-1', name: 'Doc 1' }],
      isLoading: false,
    });
    mocks.useTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: vi.fn(),
    });
  });

  it('renders the default resource-center page shell and main content wiring', () => {
    mocks.useOutletContext.mockReturnValue(buildOutletContext());

    const html = renderToStaticMarkup(<ResourceCenterPage />);

    expect(html).toContain('task-list-button');
    expect(html).toContain('resource-top-tabs');
    expect(html).toContain('resource-center-content');
    expect(html).toContain('resource-action-menu');
    expect(html).toContain('resource-share-token-modal');
    expect(html).toContain('resource-import-modal');
    expect(html).toContain('resource-import-url-modal');
    expect(html).toContain('all|all|all|1');
    expect(html).toContain('all|main|none|0|plain');
    expect(mocks.ResourceActionMenu.mock.calls[0][0].generateActions).toBeUndefined();
    expect(mocks.ResourceCenterContent.mock.calls[0][0].listActions.onOpenGlobalView).toEqual(expect.any(Function));
  });

  it('maps detail tabs and fullscreen action for a resource detail panel', () => {
    mocks.useOutletContext.mockReturnValue(buildOutletContext({
      activeTab: 'kbdoc',
      activePanel: 'doc:resource-1',
      activeTopPanel: 'kbdoc',
      topTabItems: [{ key: 'kbdoc', label: '参考文档' }],
      activeDetailTab: {
        key: 'doc:resource-1',
        docId: 'resource-1',
        label: '资源一',
        kind: 'kbdoc',
        jumpToPage: 4,
        jumpToken: 9,
      },
      lastDetailTab: {
        key: 'doc:resource-1',
        docId: 'resource-1',
        label: '资源一',
        kind: 'kbdoc',
        jumpToPage: 4,
        jumpToken: 9,
      },
      detailTabs: [
        {
          key: 'doc:resource-1',
          docId: 'resource-1',
          label: '资源一',
          kind: 'kbdoc',
          jumpToPage: 4,
          jumpToken: 9,
        },
      ],
    }));

    const html = renderToStaticMarkup(<ResourceCenterPage />);

    expect(html).toContain('doc:resource-1|main|resource-1|1|floating');
    expect(mocks.ResourceCenterContent.mock.calls[0][0].detailState).toEqual(
      expect.objectContaining({
        docId: 'resource-1',
        detailTabKey: 'doc:resource-1',
        projectId: 'project-1',
        kbId: 'kb-1',
      })
    );
    mocks.ResourceCenterContent.mock.calls[0][0].detailFloatingAction.props.onClick();
    expect(mocks.useNavigate.mock.results[0].value).toHaveBeenCalledWith(
      '/resource-center/project-1/kb-1/fullscreen/kbdoc/resource-1?page=4&jump=9',
      {
        state: {
          fromPath: '/resource-center/project-1/kb-1?from=test',
        },
      }
    );
  });

  it('会仅返回资源中心允许的来源页面', () => {
    mocks.useOutletContext.mockReturnValue(buildOutletContext());

    renderToStaticMarkup(<ResourceCenterPage />);
    mocks.TourStep.mock.calls[0][0].children.props.onClick();
    expect(mocks.useNavigate.mock.results[0].value).toHaveBeenCalledWith('/project/project-1');
  });

  it('支持收起并重新展开顶部头部区域', () => {
    mocks.useOutletContext.mockReturnValue(buildOutletContext());

    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(<ResourceCenterPage />);
    });

    const toggleButton = container.querySelector('button[aria-label="收起顶部标签"]');
    expect(toggleButton).not.toBeNull();

    flushSync(() => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('button[aria-label="展开顶部标签"]')).not.toBeNull();
    expect(container.querySelector('[data-top-tabs-collapsed]')?.getAttribute('data-top-tabs-collapsed')).toBe('true');

    flushSync(() => {
      root.unmount();
    });
  });
});
