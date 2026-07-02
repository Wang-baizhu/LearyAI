// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import SessionList from '../SessionList';

vi.mock('@leary/ui', () => ({
  Modal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) => (isOpen ? <section>{title}{children}</section> : null),
}));

vi.mock('@/shared/ui/ContextMenu', () => ({
  default: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe('SessionList', () => {
  it('renders the visible session list safely', () => {
    const render = () =>
      renderToStaticMarkup(
        <SessionList
          isVisible
          currentKbId="kb-1"
          sessions={[
            {
              id: 'session-1',
              name: '会话一',
              kbId: 'kb-1',
              updatedAt: '2026-03-28T08:00:00.000Z',
              messageCount: 2,
              referenceCount: 0,
              isStreaming: false,
            },
          ]}
          onSelectSession={vi.fn()}
          onCreateSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDeleteSession={vi.fn()}
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('当前会话列表');
    expect(markup).toContain('新增会话');
    expect(markup).toContain('会话一');
  });

  it('renders pending request badge for parent session safely', () => {
    const markup = renderToStaticMarkup(
      <SessionList
        isVisible
        sessions={[
          {
            id: 'session-1',
            name: '会话一',
            kbId: 'kb-1',
            updatedAt: '2026-03-28T08:00:00.000Z',
            messageCount: 2,
            referenceCount: 0,
            isStreaming: false,
          },
        ]}
        pendingRequestCountBySessionId={{ 'session-1': 3 }}
      />
    );

    expect(markup).toContain('待处理 3');
  });

  it('marks sessions from another knowledge base as locked', () => {
    const markup = renderToStaticMarkup(
      <SessionList
        isVisible
        currentKbId="kb-1"
        sessions={[
          {
            id: 'session-2',
            name: '受限会话',
            kbId: 'kb-2',
            updatedAt: '2026-03-28T09:00:00.000Z',
            messageCount: 3,
            referenceCount: 1,
            isStreaming: false,
          },
        ]}
        onSelectSession={vi.fn()}
      />
    );

    expect(markup).toContain('受限会话');
    expect(markup).toContain('当前知识库不可进入');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('disabled=""');
  });

  it('renders the active session with highlighted styles', () => {
    const markup = renderToStaticMarkup(
      <SessionList
        isVisible
        activeSessionId="session-1"
        currentKbId="kb-1"
        sessions={[
          {
            id: 'session-1',
            name: '当前会话',
            kbId: 'kb-1',
            updatedAt: '2026-03-28T09:00:00.000Z',
            messageCount: 3,
            referenceCount: 1,
            isStreaming: false,
          },
        ]}
      />
    );

    expect(markup).toContain('border-primary');
    expect(markup).toContain('text-primary');
  });

  it('打开历史面板时会滚动到当前 active session', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const container = document.createElement('div');
    const root = createRoot(container);
    const sessions = [
      {
        id: 'session-1',
        name: '会话一',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T08:00:00.000Z',
        messageCount: 2,
        referenceCount: 0,
        isStreaming: false,
      },
      {
        id: 'session-2',
        name: '会话二',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T09:00:00.000Z',
        messageCount: 4,
        referenceCount: 1,
        isStreaming: false,
      },
    ];

    flushSync(() => {
      root.render(<SessionList isVisible={false} activeSessionId="session-2" sessions={sessions} />);
    });

    flushSync(() => {
      root.render(<SessionList isVisible activeSessionId="session-2" sessions={sessions} />);
    });

    await Promise.resolve();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });

    flushSync(() => {
      root.unmount();
    });
  });

  it('加载更多 session 时不会重新定位当前 active session', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const container = document.createElement('div');
    const root = createRoot(container);
    const baseSessions = [
      {
        id: 'session-1',
        name: '会话一',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T08:00:00.000Z',
        messageCount: 2,
        referenceCount: 0,
        isStreaming: false,
      },
      {
        id: 'session-2',
        name: '会话二',
        kbId: 'kb-1',
        updatedAt: '2026-03-28T09:00:00.000Z',
        messageCount: 4,
        referenceCount: 1,
        isStreaming: false,
      },
    ];

    flushSync(() => {
      root.render(<SessionList isVisible activeSessionId="session-2" sessions={baseSessions} />);
    });

    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    flushSync(() => {
      root.render(
        <SessionList
          isVisible
          activeSessionId="session-2"
          sessions={[
            ...baseSessions,
            {
              id: 'session-3',
              name: '会话三',
              kbId: 'kb-1',
              updatedAt: '2026-03-28T10:00:00.000Z',
              messageCount: 1,
              referenceCount: 0,
              isStreaming: false,
            },
          ]}
        />
      );
    });

    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    flushSync(() => {
      root.unmount();
    });
  });

  it('首屏未撑满容器且仍有更多时会自动继续加载', async () => {
    const onLoadMore = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <SessionList
          isVisible
          hasMore
          onLoadMore={onLoadMore}
          sessions={[
            {
              id: 'session-1',
              name: '会话一',
              kbId: 'kb-1',
              updatedAt: '2026-03-28T08:00:00.000Z',
              messageCount: 2,
              referenceCount: 0,
              isStreaming: false,
            },
          ]}
        />
      );
    });

    const list = container.querySelector('.overflow-y-auto') as HTMLDivElement | null;
    expect(list).not.toBeNull();
    Object.defineProperty(list!, 'scrollHeight', { configurable: true, value: 120 });
    Object.defineProperty(list!, 'clientHeight', { configurable: true, value: 160 });

    flushSync(() => {
      root.render(
        <SessionList
          isVisible
          hasMore
          onLoadMore={onLoadMore}
          sessions={[
            {
              id: 'session-1',
              name: '会话一',
              kbId: 'kb-1',
              updatedAt: '2026-03-28T08:00:00.000Z',
              messageCount: 2,
              referenceCount: 0,
              isStreaming: false,
            },
          ]}
        />
      );
    });

    await Promise.resolve();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    flushSync(() => {
      root.unmount();
    });
  });
});
