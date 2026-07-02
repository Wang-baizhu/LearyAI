import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectDetailPage from '../ProjectDetailPage';

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSession: vi.fn(),
  dispatch: vi.fn(),
  params: { projectId: 'project-1' } as { projectId?: string },
  currentUser: { id: 7, name: '测试用户' },
  theme: { isDarkMode: false, toggleTheme: vi.fn() },
  listQuery: {
    data: { items: [], total: 0 },
    isLoading: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    error: null,
  },
  createMutation: {
    reset: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    data: null,
  },
  updateMutation: {
    reset: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  },
  deleteMutation: {
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  },
  projectsQuery: {
    data: [{ projectId: 'project-1', name: 'Alpha 空间' }],
    isLoading: false,
    isError: false,
    error: null,
  },
  createProjectMutation: {
    reset: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  },
  recentVisitsQuery: {
    data: {
      pages: [
        {
          items: [
            {
              resourceType: 'KB',
              resourceId: 'kb-9',
              title: '最近知识库',
              projectId: 'project-9',
              kbId: 'kb-9',
              available: true,
            },
            {
              resourceType: 'PROJECT',
              resourceId: 'project-8',
              title: '最近空间',
              projectId: 'project-8',
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
  persistedKbCount: '2',
  apiErrorMessage: '知识库加载失败：mock',
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
    useParams: () => mockState.params,
    useLocation: () => ({ pathname: '/project/project-1', search: '', state: null, hash: '', key: 'mock-location' }),
  };
});

vi.mock('@/shared/ui/ThemeToggle', () => ({
  default: ({ isDarkMode }: { isDarkMode: boolean }) => (
    <div data-testid="theme-toggle">{isDarkMode ? 'dark' : 'light'}</div>
  ),
}));

vi.mock('@/shared/ui/UserMenu', () => ({
  default: ({ user }: { user: { name: string } | null }) => (
    <div data-testid="user-menu">{user?.name ?? 'anonymous'}</div>
  ),
}));

vi.mock('@/shared/ui/AddIconButton', () => ({
  default: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

vi.mock('@/shared/ui/SharedLinkCard', () => ({
  default: ({
    title,
    children,
    headerLeft,
    headerActions,
    footerLeft,
  }: {
    title: string;
    children?: React.ReactNode;
    headerLeft?: React.ReactNode;
    headerActions?: React.ReactNode;
    footerLeft?: React.ReactNode;
  }) => (
    <article data-testid="shared-link-card">
      {headerLeft}
      {headerActions}
      <h3>{title}</h3>
      <div>{children}</div>
      {footerLeft}
    </article>
  ),
}));

vi.mock('../../../../widgets/project-detail', () => ({
  default: ({ projectId, guideTag }: { projectId: string; guideTag?: string }) => (
    <aside>{`sidebar:${projectId}:${guideTag ?? 'none'}`}</aside>
  ),
  ProjectDetailSidebar: ({
    projectId,
    guideTag,
  }: {
    projectId: string;
    guideTag?: string;
  }) => <aside>{`sidebar:${projectId}:${guideTag ?? 'none'}`}</aside>,
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
  CreateKnowledgeBaseForm: ({
    defaultProjectId,
  }: {
    defaultProjectId?: string;
  }) => <div>{`create-kb-form:${defaultProjectId ?? 'none'}`}</div>,
  EditKnowledgeBaseForm: ({
    knowledgeBase,
  }: {
    knowledgeBase: { kbId: string };
  }) => <div>{`edit-kb-form:${knowledgeBase.kbId}`}</div>,
}));

vi.mock('../../../../adapter', () => ({
  useProjectKnowledgeBaseManagement: () => ({
    listQuery: mockState.listQuery,
    createMutation: mockState.createMutation,
    updateMutation: mockState.updateMutation,
    deleteMutation: mockState.deleteMutation,
    knowledgeBases: mockState.listQuery.data?.items ?? [],
    total: mockState.listQuery.data?.total ?? 0,
    totalPages: Math.max(1, Math.ceil((mockState.listQuery.data?.total ?? 0) / 6)),
    listErrorMessage: mockState.apiErrorMessage,
  }),
}));

vi.mock('../../../../features/list', () => ({
  useProjects: () => mockState.projectsQuery,
}));

vi.mock('@/modules/project', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useCreateProject: () => mockState.createProjectMutation,
  };
});

vi.mock('../../../../../visit', () => ({
  useRecentVisits: () => mockState.recentVisitsQuery,
}));

vi.mock('@/modules/workspace', () => ({
  ProjectEntryModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>project-entry-modal</div> : null),
}));

vi.mock('@/shared/lib/formatters', () => ({
  formatVisitedAt: (value: string) => `visited:${value}`,
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
  }) => (isOpen ? <section data-testid="modal">{title}{children}</section> : null),
  ConfirmDialog: ({
    isOpen,
    title,
    message,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
  }) => (isOpen ? <section data-testid="confirm-dialog">{title}{message}</section> : null),
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

vi.mock('@/app/store/ui/toastSlice', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    enqueueToast: (payload: unknown) => ({ type: 'toast/enqueue', payload }),
  };
});

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: () => mockState.apiErrorMessage,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <i data-testid="material-icon">{name}</i>,
}));

vi.mock('@/shared/contexts/useTheme', () => ({
  useTheme: () => mockState.theme,
}));

vi.mock('@/shared/ui/SkeletonLoader', () => ({
  default: () => <div>kb-skeleton</div>,
}));

vi.mock('@/shared/ui/GlobalMobileBottomNav', () => ({
  default: mockState.GlobalMobileBottomNav,
}));

vi.mock('@/shared/lib/safeLocalStorage', () => ({
  safeLocalStorageGet: () => mockState.persistedKbCount,
  safeLocalStorageSet: vi.fn(),
}));

vi.mock('@leary/tour-guide', () => ({
  TourOverlay: () => <div>tour-overlay</div>,
  TourProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TourStep: ({
    title,
    content,
    children,
  }: {
    title: string;
    content: string;
    children: React.ReactNode;
  }) => (
    <section data-testid="tour-step">
      <span>{title}</span>
      <span>{content}</span>
      {children}
    </section>
  ),
}));

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    mockState.navigate.mockReset();
    mockState.setSession.mockReset();
    mockState.dispatch.mockReset();
    mockState.params = { projectId: 'project-1' };
    mockState.currentUser = { id: 7, name: '测试用户' };
    mockState.theme = { isDarkMode: false, toggleTheme: vi.fn() };
    mockState.listQuery = {
      data: { items: [], total: 0 },
      isLoading: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      error: null,
    };
    mockState.createMutation = {
      reset: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: null,
    };
    mockState.updateMutation = {
      reset: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    };
    mockState.deleteMutation = {
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    };
    mockState.projectsQuery = {
      data: [{ projectId: 'project-1', name: 'Alpha 空间' }],
      isLoading: false,
      isError: false,
      error: null,
    };
    mockState.createProjectMutation = {
      reset: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    };
    mockState.recentVisitsQuery = {
      data: {
        pages: [
          {
            items: [
              {
                resourceType: 'KB',
                resourceId: 'kb-9',
                title: '最近知识库',
                projectId: 'project-9',
                kbId: 'kb-9',
                available: true,
              },
              {
                resourceType: 'PROJECT',
                resourceId: 'project-8',
                title: '最近空间',
                projectId: 'project-8',
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
    mockState.persistedKbCount = '2';
    mockState.apiErrorMessage = '知识库加载失败：mock';
  });

  it('renders the missing-project branch safely', () => {
    mockState.params = {};

    const markup = renderToStaticMarkup(<ProjectDetailPage />);

    expect(markup).toContain('项目详情');
    expect(markup).toContain('缺少项目参数，请从项目入口访问。');
    expect(markup).toContain('sidebar::guide:project-detail:v1');
    expect(markup).toContain('创建内容');
    expect(markup).toContain('global-mobile-nav:home|project:project:打开快捷创建');
  });

  it('renders loading skeletons safely', () => {
    mockState.listQuery = {
      data: { items: [], total: 0 },
      isLoading: true,
      isError: false,
      isSuccess: false,
      isFetching: false,
      error: null,
    };
    mockState.persistedKbCount = '2';

    const markup = renderToStaticMarkup(<ProjectDetailPage />);

    expect(markup).toContain('Alpha 空间');
    expect(markup).toContain('kb-skeleton');
    expect(markup).toContain('sidebar:project-1:guide:project-detail:v1');
    expect(markup).toContain('global-mobile-nav:home|project:project:打开快捷创建');
  });

  it('renders the knowledge base list safely', () => {
    mockState.listQuery = {
      data: {
        items: [
          {
            kbId: 'kb-1',
            name: '产品知识库',
            description: '用于产品文档整理',
            visibility: 'TEAM',
            visitedAt: '2026-03-01T08:00:00.000Z',
          },
        ],
        total: 1,
      },
      isLoading: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      error: null,
    };

    const markup = renderToStaticMarkup(<ProjectDetailPage />);

    expect(markup).toContain('Alpha 空间');
    expect(markup).toContain('产品知识库');
    expect(markup).toContain('用于产品文档整理');
    expect(markup).toContain('visited:2026-03-01T08:00:00.000Z');
    expect(markup).toContain('团队');
    expect(markup).toContain('global-mobile-nav:home|project:project:打开快捷创建');
  });
});
