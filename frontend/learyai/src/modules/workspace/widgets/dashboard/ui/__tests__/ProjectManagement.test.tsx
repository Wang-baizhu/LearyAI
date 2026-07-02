import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectManagement from '../ProjectManagement';

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
  dispatch: vi.fn(),
  projectsState: {
    projects: [],
    defaultProjectId: null,
    isLoading: false,
    isError: false,
    error: null,
  },
  renameMutation: {
    reset: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
  },
  deleteMutation: {
    mutate: vi.fn(),
    isPending: false,
  },
  ownerCount: '2',
  joinedCount: '1',
  errorMessage: '空间加载失败：mock',
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/workspace',
    search: '',
  }),
  useNavigate: () => mockState.navigate,
}));

vi.mock('../../../../../project', () => ({
  RenameProjectForm: ({ defaultName }: { defaultName: string }) => <div>{`rename-form:${defaultName}`}</div>,
  useDeleteProject: () => mockState.deleteMutation,
  useRenameProject: () => mockState.renameMutation,
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

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: () => mockState.errorMessage,
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
  ConfirmDialog: ({
    isOpen,
    title,
    message,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
  }) => (isOpen ? <section>{title}{message}</section> : null),
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: () => mockState.dispatch,
}));

vi.mock('@/app/store/ui/dialogSlice', () => ({
  default: () => ({
    isOpen: false,
    type: null,
    payload: null,
  }),
  openDialog: (payload: unknown) => ({ type: 'dialog/open', payload }),
}));

vi.mock('@/app/store/ui/toastSlice', () => ({
  default: () => ({
    queue: [],
  }),
  enqueueToast: (payload: unknown) => ({ type: 'toast/enqueue', payload }),
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <i>{name}</i>,
}));

vi.mock('@/shared/ui/SkeletonLoader', () => ({
  default: () => <div>project-skeleton</div>,
}));

vi.mock('@/shared/lib/safeLocalStorage', () => ({
  safeLocalStorageGet: (key: string) => {
    if (key === 'workspace:project:owner:list-count') {
      return mockState.ownerCount;
    }
    if (key === 'workspace:project:joined:list-count') {
      return mockState.joinedCount;
    }
    return null;
  },
  safeLocalStorageSet: vi.fn(),
}));

describe('ProjectManagement', () => {
  beforeEach(() => {
    mockState.navigate.mockReset();
    mockState.dispatch.mockReset();
    mockState.projectsState = {
      projects: [],
      defaultProjectId: null,
      isLoading: false,
      isError: false,
      error: null,
    };
    mockState.renameMutation = {
      reset: vi.fn(),
      mutate: vi.fn(),
      isPending: false,
    };
    mockState.deleteMutation = {
      mutate: vi.fn(),
      isPending: false,
    };
    mockState.ownerCount = '2';
    mockState.joinedCount = '1';
    mockState.errorMessage = '空间加载失败：mock';
  });

  it('renders loading placeholders safely', () => {
    mockState.projectsState = {
      projects: [],
      defaultProjectId: null,
      isLoading: true,
      isError: false,
      error: null,
    };

    const markup = renderToStaticMarkup(
      <ProjectManagement onCreateProject={vi.fn()} projectsState={mockState.projectsState} />
    );

    expect(markup).toContain('空间管理');
    expect(markup).toContain('我的空间');
    expect(markup).toContain('加入的其他空间');
    expect(markup).toContain('project-skeleton');
  });

  it('renders the error branch safely', () => {
    mockState.projectsState = {
      projects: [],
      defaultProjectId: null,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    };

    const markup = renderToStaticMarkup(
      <ProjectManagement onCreateProject={vi.fn()} projectsState={mockState.projectsState} />
    );

    expect(markup).toContain('空间加载失败：mock');
  });

  it('renders owner and joined project cards safely', () => {
    mockState.projectsState = {
      projects: [
        { projectId: 'project-1', name: 'Alpha 空间', role: 'OWNER' },
        { projectId: 'project-2', name: 'Beta 空间', role: 'ADMIN' },
      ],
      defaultProjectId: 'project-1',
      isLoading: false,
      isError: false,
      error: null,
    };

    const markup = renderToStaticMarkup(
      <ProjectManagement onCreateProject={vi.fn()} projectsState={mockState.projectsState} />
    );

    expect(markup).toContain('Alpha 空间');
    expect(markup).toContain('Beta 空间');
    expect(markup).toContain('我的空间');
    expect(markup).toContain('加入的其他空间');
    expect(markup).toContain('OWNER');
    expect(markup).toContain('ADMIN');
  });
});
