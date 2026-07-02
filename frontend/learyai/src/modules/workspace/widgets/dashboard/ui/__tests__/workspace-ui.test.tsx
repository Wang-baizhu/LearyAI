// @vitest-environment jsdom
// workspace-ui.test.tsx 负责验证工作区首页组件的静态输出与安全渲染。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GettingStarted from '../GettingStarted';
import Header from '../Header';
import Hero from '../Hero';
import QuickActions from '../QuickActions';

const mocks = {
  toggleTheme: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/modules/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useCurrentUser: () => ({
      name: '张三',
      email: 'zhangsan@example.com',
      userMode: 'TEAM',
    }),
  };
});

vi.mock('@/shared/contexts/useTheme', () => ({
  useTheme: () => ({
    isDarkMode: false,
    toggleTheme: mocks.toggleTheme,
  }),
}));

vi.mock('@/shared/ui/ThemeToggle', () => ({
  default: ({ isDarkMode }: { isDarkMode: boolean }) => (
    <div data-testid="theme-toggle">{isDarkMode ? 'dark-mode' : 'light-mode'}</div>
  ),
}));

vi.mock('@/shared/ui/UserMenu', () => ({
  default: () => <div data-testid="user-menu">user-menu</div>,
}));

vi.mock('@leary/tour-guide', () => ({
  TourStep: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Workspace widgets UI', () => {
  it('renders Header safely', () => {
    const render = () =>
      renderToStaticMarkup(
        <Header
          onLogout={mocks.logout}
          activeTab="quick-start"
          onTabChange={vi.fn()}
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('Leary AI');
    expect(markup).toContain('快速开始');
    expect(markup).toContain('空间管理');
    expect(markup).toContain('light-mode');
    expect(markup).toContain('user-menu');
  });

  it('renders Hero safely', () => {
    const render = () => renderToStaticMarkup(<Hero />);

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('Welcome Back!');
    expect(markup).toContain('AI 知识库应用');
    expect(markup).toContain('workspace-hero-copy-scroll');
    expect(markup).toContain('workspace-hero-typing');
    expect(markup).toContain('viewBox="0 -960 960 960"');
    expect(markup).toContain('whitespace-nowrap');
  });

  it('renders GettingStarted safely', () => {
    const render = () => renderToStaticMarkup(<GettingStarted />);

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('入门指南');
    expect(markup).toContain('快速上手');
    expect(markup).toContain('API文档');
  });

  it('renders QuickActions safely', () => {
    const render = () =>
      renderToStaticMarkup(
        <QuickActions
          onCreateKnowledgeBase={vi.fn()}
          onCreateProject={vi.fn()}
          onPlaceholderAction={vi.fn()}
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('快捷操作');
    expect(markup).toContain('新建知识库');
    expect(markup).toContain('新建空间');
    expect(markup).toContain('更多能力');
    expect(markup).toContain('overflow-x-auto');
    expect(markup).toContain('md:hidden');
    expect(markup).toContain('hidden grid-cols-1 gap-6');
    expect(markup).toContain('md:grid');
  });

  it('点击占位快捷入口会触发对应回调', () => {
    const onPlaceholderAction = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <QuickActions
          onCreateKnowledgeBase={vi.fn()}
          onCreateProject={vi.fn()}
          onPlaceholderAction={onPlaceholderAction}
        />
      );
    });

    const placeholderCard = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('更多能力')
    );

    expect(placeholderCard).not.toBeUndefined();

    flushSync(() => {
      placeholderCard?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(onPlaceholderAction).toHaveBeenCalledTimes(1);

    flushSync(() => {
      root.unmount();
    });
  });
});
