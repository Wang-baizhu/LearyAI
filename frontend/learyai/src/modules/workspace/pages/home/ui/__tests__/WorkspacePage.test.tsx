// @vitest-environment jsdom
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspacePage from '../WorkspacePage';

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSession: vi.fn(),
  dispatch: vi.fn(),
  currentUser: { id: 9, name: '工作区用户' },
  locationSearch: '',
  workspaceProjectsState: {
    projects: [{ projectId: 'project-1', name: 'Alpha 空间' }],
    defaultProjectId: 'project-1',
    isLoading: false,
    isError: false,
    error: null,
  },
  createMutation: {
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isPending: false,
    data: null,
  },
  recentVisitsQuery: {
    data: {
      pages: [
        {
          items: [
            {
              resourceType: 'KB',
              resourceId: 'kb-1',
              title: '雅思',
              projectId: 'project-1',
              kbId: 'kb-1',
              available: true,
            },
            {
              resourceType: 'PROJECT',
              resourceId: 'project-2',
              title: '个人',
              projectId: 'project-2',
              available: true,
            },
          ],
          hasMore: false,
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    },
    isLoading: false,
    isPending: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isError: false,
    isSuccess: true,
    error: null,
  },
  createProjectMutation: {
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isPending: false,
  },
  errorMessage: '项目加载失败：mock',
  GlobalMobileBottomNav: ({
    leftItem,
    rightItem,
    activeKey,
    centerAction,
  }: {
    leftItem?: { key: string };
    rightItem?: { key: string };
    activeKey?: string | null;
    centerAction?: { ariaLabel?: string };
  }) => <div>{`global-mobile-nav:${leftItem?.key ?? 'none'}|${rightItem?.key ?? 'none'}:${activeKey ?? 'none'}:${centerAction?.ariaLabel ?? 'none'}`}</div>,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => mockState.navigate,
    useLocation: () => ({ pathname: '/workspace', search: mockState.locationSearch, state: null, hash: '', key: 'mock-location' }),
  };
});

vi.mock('../../../../widgets', () => ({
  Header: ({ activeTab }: { activeTab: string }) => <div>{`header:${activeTab}`}</div>,
  Hero: () => <div>hero</div>,
  QuickActions: ({
    onPlaceholderAction,
  }: {
    onPlaceholderAction: () => void;
  }) => <button onClick={onPlaceholderAction}>quick-actions</button>,
  KnowledgeBaseOverview: ({
    statusText,
    query,
  }: {
    statusText?: string | null;
    query: { data?: { pages?: Array<{ items?: Array<{ resourceId: string }> }> } };
  }) => <div>{`kb-overview:${statusText ?? 'none'}:${query.data?.pages?.[0]?.items?.length ?? 0}`}</div>,
  GettingStarted: () => <div>getting-started</div>,
  ProjectManagement: ({ projectsState }: { projectsState: { projects: Array<unknown> } }) => (
    <div>{`project-management:${projectsState.projects.length}`}</div>
  ),
  ProjectEntryModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>project-entry-modal</div> : null),
}));

vi.mock('@/modules/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    authApi: { logout: vi.fn() },
    useCurrentUser: () => mockState.currentUser,
    useUserSession: () => ({ setSession: mockState.setSession }),
  };
});

vi.mock('../../../../../knowledge-base', () => ({
  CreateKnowledgeBaseForm: () => <div>create-kb-form</div>,
  useCreateKnowledgeBase: () => mockState.createMutation,
}));

vi.mock('../../../../../visit', () => ({
  useRecentVisits: () => mockState.recentVisitsQuery,
}));

vi.mock('../../../../../project', () => ({
  useCreateProject: () => mockState.createProjectMutation,
}));

vi.mock('../../../../adapter', () => ({
  useWorkspaceProjects: () => mockState.workspaceProjectsState,
}));

vi.mock('@leary/ui', () => ({
  Modal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children?: React.ReactNode;
  }) => (isOpen ? <section>{title}{children}</section> : null),
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mockState.dispatch,
}));

vi.mock('@/app/store/ui/dialogSlice', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    openDialog: (payload: unknown) => ({ type: 'dialog/open', payload }),
  };
});

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: () => mockState.errorMessage,
}));

vi.mock('@/shared/ui/InlineNotice', () => ({
  default: ({ variant, message }: { variant: string; message: string }) => (
    <div>{`inline-notice:${variant}:${message}`}</div>
  ),
}));

vi.mock('@/shared/ui/GlobalMobileBottomNav', () => ({
  default: mockState.GlobalMobileBottomNav,
}));

vi.mock('@/shared/ui/MobileActionSheet', () => ({
  default: ({
    title,
    actions,
  }: {
    title: string;
    actions: Array<{ label: string }>;
  }) => <div>{`mobile-action-sheet:${title}:${actions.map((action) => action.label).join('|')}`}</div>,
}));

vi.mock('@leary/intro-animation', () => ({
  IntroAnimation: () => <div>intro-animation</div>,
}));

vi.mock('@leary/tour-guide', () => ({
  TourOverlay: () => <div>tour-overlay</div>,
  TourProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/lib/safeLocalStorage', () => ({
  safeLocalStorageGet: vi.fn(),
  safeLocalStorageSet: vi.fn(),
}));

describe('WorkspacePage', () => {
  beforeEach(() => {
    mockState.navigate.mockReset();
    mockState.setSession.mockReset();
    mockState.dispatch.mockReset();
    mockState.currentUser = { id: 9, name: '工作区用户' };
    mockState.locationSearch = '';
    mockState.createMutation = {
      reset: vi.fn(),
      mutate: vi.fn(),
      isSuccess: false,
      isPending: false,
      data: null,
    };
    mockState.workspaceProjectsState = {
      projects: [{ projectId: 'project-1', name: 'Alpha 空间' }],
      defaultProjectId: 'project-1',
      isLoading: false,
      isError: false,
      error: null,
    };
    mockState.recentVisitsQuery = {
      data: {
        pages: [
        {
          items: [
            {
              resourceType: 'KB',
              resourceId: 'kb-1',
              title: '雅思',
              projectId: 'project-1',
              kbId: 'kb-1',
              available: true,
            },
            {
              resourceType: 'PROJECT',
              resourceId: 'project-2',
              title: '个人',
              projectId: 'project-2',
              available: true,
            },
          ],
          hasMore: false,
          nextCursor: null,
        },
        ],
        pageParams: [undefined],
      },
      isLoading: false,
      isPending: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isError: false,
      isSuccess: true,
      error: null,
    };
    mockState.createProjectMutation = {
      reset: vi.fn(),
      mutate: vi.fn(),
      isSuccess: false,
      isPending: false,
    };
    mockState.templateDevPackageDownloadMutation = {
      mutateAsync: vi.fn(),
      isPending: false,
    };
    mockState.errorMessage = '项目加载失败：mock';
  });

  it('renders the quick-start composition safely', () => {
    const markup = renderToStaticMarkup(<WorkspacePage />);

    expect(markup).toContain('header:quick-start');
    expect(markup).toContain('hero');
    expect(markup).toContain('quick-actions');
    expect(markup).toContain('kb-overview:none:2');
    expect(markup).toContain('getting-started');
    expect(markup).toContain('tour-overlay');
    expect(markup).toContain('mobile-action-sheet:快捷创建:新建知识库|新建空间|开发模板|进入雅思知识库|进入个人空间');
    expect(markup).toContain('global-mobile-nav:home|project:home:打开快捷创建');
  });

  it('点击占位快捷入口会弹出预留提示', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(<WorkspacePage />);
    });

    const marketButton = container.querySelector('button');
    expect(marketButton?.textContent).toBe('quick-actions');

    flushSync(() => {
      marketButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(mockState.dispatch).toHaveBeenCalledWith({
      type: 'dialog/open',
      payload: {
        type: 'error',
        payload: {
          title: '功能预留中',
          message: '这里暂时保留为占位入口，后续按需接入新能力。',
        },
      },
    });

    flushSync(() => {
      root.unmount();
    });
  });

  it('renders the recent-project error notice safely', () => {
    mockState.workspaceProjectsState = {
      projects: [],
      defaultProjectId: null,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    };
    mockState.recentVisitsQuery = {
      data: {
        pages: [{ items: [], hasMore: false, nextCursor: null }],
        pageParams: [undefined],
      },
      isLoading: false,
      isPending: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isError: false,
      isSuccess: true,
      error: null,
    };

    const markup = renderToStaticMarkup(<WorkspacePage />);

    expect(markup).toContain('header:quick-start');
    expect(markup).toContain('inline-notice:error:项目加载失败：mock');
    expect(markup).toContain('kb-overview:none:0');
    expect(markup).toContain('mobile-action-sheet:快捷创建:新建知识库|新建空间');
    expect(markup).toContain('global-mobile-nav:home|project:home:打开快捷创建');
  });

  it('uses the first project from list state as the quick-start default project', () => {
    mockState.workspaceProjectsState = {
      projects: [
        { projectId: 'project-1', name: 'Alpha 空间' },
        { projectId: 'project-2', name: 'Beta 空间' },
      ],
      defaultProjectId: 'project-1',
      isLoading: false,
      isError: false,
      error: null,
    };

    const markup = renderToStaticMarkup(<WorkspacePage />);

    expect(markup).toContain('kb-overview:none:2');
    expect(markup).not.toContain('inline-notice:error:项目加载失败：mock');
    expect(markup).toContain('mobile-action-sheet:快捷创建:新建知识库|新建空间|开发模板|进入雅思知识库|进入个人空间');
    expect(markup).toContain('global-mobile-nav:home|project:home:打开快捷创建');
  });

  it('renders project-management tab when workspace query requests it', () => {
    mockState.locationSearch = '?tab=project-management';

    const markup = renderToStaticMarkup(<WorkspacePage />);

    expect(markup).toContain('header:project-management');
    expect(markup).toContain('project-management:1');
    expect(markup).toContain('global-mobile-nav:home|project:project:打开快捷创建');
  });
});
