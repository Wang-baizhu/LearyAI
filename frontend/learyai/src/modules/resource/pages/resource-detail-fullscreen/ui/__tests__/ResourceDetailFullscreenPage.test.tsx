// ResourceDetailFullscreenPage.test.tsx 负责验证详情全屏页头部与详情面板装配。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  DEFAULT_FLOW_CANVAS_BOARD: {
    boardId: 'resource-global-view',
    title: '全局视图',
  },
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  ThemeToggle: vi.fn((props: any) => <button type="button">theme:{props.isDarkMode ? 'dark' : 'light'}</button>),
  UserMenu: vi.fn((props: any) => <div data-testid="user-menu">{props.user?.name ?? 'anonymous'}</div>),
  ResourceDetailPanel: vi.fn(() => <div data-testid="resource-detail-panel">detail-panel</div>),
  useCurrentUser: vi.fn(() => ({ name: '测试用户', email: 'test@example.com' })),
  useUserSession: vi.fn(() => ({ setSession: vi.fn() })),
  logout: vi.fn(),
  useTheme: vi.fn(() => ({ isDarkMode: true, toggleTheme: vi.fn() })),
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
  useParams: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams('page=12&jump=34')]),
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('@/shared/ui/ThemeToggle', () => ({
  default: mocks.ThemeToggle,
}));

vi.mock('@/shared/ui/UserMenu', () => ({
  default: mocks.UserMenu,
}));

vi.mock('@/modules/flow-canvas', () => ({
  DEFAULT_FLOW_CANVAS_BOARD: mocks.DEFAULT_FLOW_CANVAS_BOARD,
}));

vi.mock('../../../../features/resource-detail-panel', () => ({
  __esModule: true,
  default: mocks.ResourceDetailPanel,
}));

vi.mock('../../../../../auth', () => {
  return {
    authApi: {
      logout: mocks.logout,
    },
    useCurrentUser: mocks.useCurrentUser,
    useUserSession: mocks.useUserSession,
  };
});

vi.mock('@/shared/contexts/useTheme', () => ({
  useTheme: mocks.useTheme,
}));

vi.mock('react-router-dom', () => ({
  useLocation: mocks.useLocation,
  useNavigate: mocks.useNavigate,
  useParams: mocks.useParams,
  useSearchParams: mocks.useSearchParams,
}));

import ResourceDetailFullscreenPage from '../ResourceDetailFullscreenPage';

describe('ResourceDetailFullscreenPage', () => {
  beforeEach(() => {
    mocks.MaterialIcon.mockClear();
    mocks.ThemeToggle.mockClear();
    mocks.UserMenu.mockClear();
    mocks.ResourceDetailPanel.mockClear();
    mocks.useLocation.mockReset();
    mocks.useNavigate.mockReset();
    mocks.useParams.mockReset();
    mocks.useSearchParams.mockReset();
    mocks.useLocation.mockReturnValue({
      pathname: '/project/project-1/template/tpl-1',
      state: {
        fromPath: '/workspace',
      },
    });
    mocks.useNavigate.mockReturnValue(vi.fn());
    mocks.useParams.mockReturnValue({
      projectId: 'project-1',
      templateId: 'tpl-1',
    });
    mocks.useSearchParams.mockReturnValue([new URLSearchParams('page=12&jump=34')]);
  });

  it('会在全屏页头部渲染主题切换与用户菜单', () => {
    const html = renderToStaticMarkup(<ResourceDetailFullscreenPage />);

    expect(html).toContain('theme:dark');
    expect(html).toContain('测试用户');
    expect(html).toContain('detail-panel');
    expect(mocks.ThemeToggle).toHaveBeenCalledTimes(1);
    expect(mocks.UserMenu).toHaveBeenCalledTimes(1);
    expect(mocks.ResourceDetailPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        docId: 'tpl-1',
        kbId: undefined,
        projectId: 'project-1',
        detailKind: 'template',
        templateId: 'tpl-1',
        jumpToPage: 12,
        jumpToken: 34,
        isDarkMode: true,
      }),
      undefined
    );
  });

  it('会把 video 路由参数解析为视频详情模式', () => {
    mocks.useLocation.mockReturnValue({
      pathname: '/resource-center/project-1/kb-1/fullscreen/video/doc-9',
      state: {
        fromPath: '/resource-center/project-1/kb-1',
      },
    });
    mocks.useParams.mockReturnValue({
      projectId: 'project-1',
      kbId: 'kb-1',
      detailKind: 'video',
      docId: 'doc-9',
    });

    renderToStaticMarkup(<ResourceDetailFullscreenPage />);

    expect(mocks.ResourceDetailPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        docId: 'doc-9',
        detailKind: 'video',
        templateId: undefined,
      }),
      undefined
    );
  });

  it('会把 kbdoc 路由参数解析为文档详情模式', () => {
    mocks.useLocation.mockReturnValue({
      pathname: '/resource-center/project-1/kb-1/fullscreen/kbdoc/doc-9',
      state: {
        fromPath: '/resource-center/project-1/kb-1',
      },
    });
    mocks.useParams.mockReturnValue({
      projectId: 'project-1',
      kbId: 'kb-1',
      detailKind: 'kbdoc',
      docId: 'doc-9',
    });

    renderToStaticMarkup(<ResourceDetailFullscreenPage />);

    expect(mocks.ResourceDetailPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        docId: 'doc-9',
        detailKind: 'kbdoc',
        templateId: undefined,
      }),
      undefined
    );
  });

  it('会把 whiteboard 路由参数解析为白板详情模式', () => {
    mocks.useLocation.mockReturnValue({
      pathname: '/resource-center/project-1/kb-1/fullscreen/whiteboard/resource-global-view',
      state: {
        fromPath: '/resource-center/project-1/kb-1',
      },
    });
    mocks.useParams.mockReturnValue({
      projectId: 'project-1',
      kbId: 'kb-1',
      detailKind: 'whiteboard',
      docId: 'resource-global-view',
    });

    renderToStaticMarkup(<ResourceDetailFullscreenPage />);

    expect(mocks.ResourceDetailPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        docId: 'resource-global-view',
        detailKind: 'whiteboard',
        whiteboardConfig: {
          boardId: 'resource-global-view',
          title: '全局视图',
        },
      }),
      undefined
    );
  });

  it('会拒绝旧的 resource 详情路由参数', () => {
    mocks.useLocation.mockReturnValue({
      pathname: '/resource-center/project-1/kb-1/fullscreen/resource/doc-1',
      state: {
        fromPath: '/resource-center/project-1/kb-1',
      },
    });
    mocks.useParams.mockReturnValue({
      projectId: 'project-1',
      kbId: 'kb-1',
      detailKind: 'resource',
      docId: 'doc-1',
    });

    const html = renderToStaticMarkup(<ResourceDetailFullscreenPage />);

    expect(html).toContain('无法定位详情资源');
    expect(mocks.ResourceDetailPanel).not.toHaveBeenCalled();
  });

  it('会兼容旧的资源中心模板全屏路由', () => {
    mocks.useLocation.mockReturnValue({
      pathname: '/resource-center/project-1/kb-1/fullscreen/template/tpl-1',
      state: {
        fromPath: '/resource-center/project-1/kb-1',
      },
    });
    mocks.useParams.mockReturnValue({
      projectId: 'project-1',
      kbId: 'kb-1',
      detailKind: 'template',
      docId: 'tpl-1',
    });

    renderToStaticMarkup(<ResourceDetailFullscreenPage />);

    expect(mocks.ResourceDetailPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        docId: 'tpl-1',
        kbId: 'kb-1',
        projectId: 'project-1',
        detailKind: 'template',
        templateId: 'tpl-1',
      }),
      undefined
    );
  });
});
