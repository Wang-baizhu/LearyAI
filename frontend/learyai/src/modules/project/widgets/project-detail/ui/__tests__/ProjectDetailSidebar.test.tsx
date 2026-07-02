import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectDetailSidebar from '../ProjectDetailSidebar';

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
  dispatch: vi.fn(),
  currentUser: { id: 2, name: '当前用户' },
  membersQuery: {
    data: { items: [] },
    isLoading: false,
    isError: false,
    error: null,
  },
  removeMutation: { isPending: false, mutateAsync: vi.fn() },
  leaveMutation: { isPending: false, mutateAsync: vi.fn() },
  transferMutation: { isPending: false, mutateAsync: vi.fn() },
  updateRoleMutation: { isPending: false, mutateAsync: vi.fn() },
  createInviteMutation: { isPending: false, mutateAsync: vi.fn() },
  errorMessage: '成员加载失败：mock',
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/workspace',
    search: '',
  }),
  useNavigate: () => mockState.navigate,
}));

vi.mock('../../../../features/members', () => ({
  useProjectMembers: () => mockState.membersQuery,
  useRemoveProjectMember: () => mockState.removeMutation,
  useLeaveProject: () => mockState.leaveMutation,
  useTransferProjectOwner: () => mockState.transferMutation,
  useUpdateProjectMemberRole: () => mockState.updateRoleMutation,
}));

vi.mock('../../../../features/invite', () => ({
  useCreateProjectInvite: () => mockState.createInviteMutation,
}));

vi.mock('@/modules/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useCurrentUser: () => mockState.currentUser,
  };
});

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

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: () => mockState.errorMessage,
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

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <i data-testid="material-icon">{name}</i>,
}));

vi.mock('@leary/tour-guide', () => ({
  TourStep: ({
    tag,
    title,
    content,
    children,
  }: {
    tag: string;
    title: string;
    content: string;
    children: React.ReactNode;
  }) => (
    <div data-testid={`tour-step:${tag}`}>
      <span>{title}</span>
      <span>{content}</span>
      {children}
    </div>
  ),
}));

describe('ProjectDetailSidebar', () => {
  beforeEach(() => {
    mockState.navigate.mockReset();
    mockState.dispatch.mockReset();
    mockState.currentUser = { id: 2, name: '当前用户' };
    mockState.membersQuery = {
      data: { items: [] },
      isLoading: false,
      isError: false,
      error: null,
    };
    mockState.removeMutation = { isPending: false, mutateAsync: vi.fn() };
    mockState.leaveMutation = { isPending: false, mutateAsync: vi.fn() };
    mockState.transferMutation = { isPending: false, mutateAsync: vi.fn() };
    mockState.updateRoleMutation = { isPending: false, mutateAsync: vi.fn() };
    mockState.createInviteMutation = { isPending: false, mutateAsync: vi.fn() };
    mockState.errorMessage = '成员加载失败：mock';
  });

  it('renders the loading branch safely', () => {
    mockState.membersQuery = {
      data: { items: [] },
      isLoading: true,
      isError: false,
      error: null,
    };

    const markup = renderToStaticMarkup(<ProjectDetailSidebar projectId="project-1" />);

    expect(markup).toContain('项目成员');
    expect(markup).toContain('成员加载中...');
    expect(markup).toContain('邀请新成员');
    expect(markup).toContain('退出当前项目');
    expect(markup).toContain('0位成员');
    expect(markup).toContain('点击管理查看完整成员信息');
  });

  it('renders the error branch safely', () => {
    mockState.membersQuery = {
      data: { items: [] },
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    };

    const markup = renderToStaticMarkup(<ProjectDetailSidebar projectId="project-1" />);

    expect(markup).toContain('成员加载失败：mock');
    expect(markup).toContain('邀请新成员');
  });

  it('在内联移动端模式下只渲染成员数摘要', () => {
    mockState.membersQuery = {
      data: {
        items: [
          { userId: 1, name: '王', role: 'OWNER' },
          { userId: 2, name: '李', role: 'MEMBER' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    };

    const markup = renderToStaticMarkup(
      <ProjectDetailSidebar
        projectId="project-1"
        mobileSummaryMode="inline"
        desktopPanelVisible={false}
      />
    );

    expect(markup).toContain('2位成员');
    expect(markup).toContain('管理');
    expect(markup).not.toContain('点击管理查看完整成员信息');
    expect(markup).not.toContain('邀请新成员');
  });

  it('renders the owner branch with guide content safely', () => {
    mockState.currentUser = { id: 1, name: '空间所有者' };
    mockState.membersQuery = {
      data: {
        items: [
          { userId: 1, name: '空间所有者', role: 'OWNER' },
          { userId: 2, name: '管理员甲', role: 'ADMIN' },
          { userId: 3, name: '成员乙', role: 'MEMBER' },
          { userId: 4, name: '成员丙', role: 'MEMBER' },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    };

    const markup = renderToStaticMarkup(
      <ProjectDetailSidebar projectId="project-1" guideTag="guide:sidebar" />
    );

    expect(markup).toContain('成员权限');
    expect(markup).toContain('这里可以管理成员权限。');
    expect(markup).toContain('空间所有者');
    expect(markup).toContain('管理员甲');
    expect(markup).toContain('成员乙');
    expect(markup).toContain('+1');
    expect(markup).toContain('移交当前项目');
    expect(markup).toContain('4位成员');
    expect(markup).toContain('管理');
  });
});
