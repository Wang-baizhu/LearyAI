// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import SidebarChatMessages from '../SidebarChatMessages';

vi.mock('../MessageRoleRenderer', () => ({
  default: ({
    message,
    isConnectionStatus,
    isLastTextAssistant,
  }: {
    message: { id: string };
    isConnectionStatus?: boolean;
    isLastTextAssistant?: boolean;
  }) => (
    <div>
      message-row:{message.id}:{String(isConnectionStatus)}:{String(isLastTextAssistant)}
    </div>
  ),
}));

vi.mock('@/shared/ui/SkeletonLoader', () => ({
  default: ({ barCount }: { barCount: number }) => <div>skeleton-loader:{barCount}</div>,
}));

describe('SidebarChatMessages', () => {
  it('renders the welcome quick prompts when the session is empty', () => {
    const render = () =>
      renderToStaticMarkup(
        <SidebarChatMessages
          renderMessages={[]}
          uiState={{
            isStreaming: false,
            statusMessage: null,
            showWaitingRow: false,
            showQuickPromptWelcome: true,
            showTempSkeleton: false,
            showContextSkeleton: false,
            lastTextAssistantId: null,
          }}
          isHidden={false}
          quickPrompts={['总结知识库', '列出重点']}
          onQuickPrompt={vi.fn()}
        />
      );

    expect(render).not.toThrow();
    const markup = render();
    expect(markup).toContain('欢迎使用 learyAI');
    expect(markup).toContain('总结知识库');
    expect(markup).toContain('列出重点');
  });

  it('appends the connection status row and loading placeholders', () => {
    const markup = renderToStaticMarkup(
      <SidebarChatMessages
        renderMessages={[
          {
            id: 'user-1',
            sender: 'user',
            blocks: [],
          },
        ]}
        uiState={{
          isStreaming: true,
          statusMessage: '连接已断开，正在重试...',
          showWaitingRow: true,
          showQuickPromptWelcome: false,
          showTempSkeleton: true,
          showContextSkeleton: true,
          lastTextAssistantId: null,
        }}
        isHidden={false}
        sessionId="session-1"
      />
    );

    expect(markup).toContain('message-row:user-1:undefined:false');
    expect(markup).toContain('连接已断开，正在重试...');
    expect(markup).toContain('AI 正在等待下一条消息');
    expect(markup).toContain('skeleton-loader:6');
    expect(markup).toContain('skeleton-loader:7');
  });

  it('历史窗口未撑满容器且仍有更多时会自动补历史', async () => {
    const onLoadMoreHistory = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    flushSync(() => {
      root.render(
        <SidebarChatMessages
          renderMessages={[
            {
              id: 'assistant-1',
              sender: 'assistant',
              blocks: [],
            },
          ]}
          uiState={{
            isStreaming: false,
            statusMessage: null,
            showWaitingRow: false,
            showQuickPromptWelcome: false,
            showTempSkeleton: false,
            showContextSkeleton: false,
            lastTextAssistantId: null,
          }}
          isHidden={false}
          sessionId="session-1"
          hasMoreHistory
          onLoadMoreHistory={onLoadMoreHistory}
        />
      );
    });

    const panel = container.querySelector('.overflow-y-auto') as HTMLDivElement | null;
    expect(panel).not.toBeNull();
    Object.defineProperty(panel!, 'scrollHeight', { configurable: true, value: 140 });
    Object.defineProperty(panel!, 'clientHeight', { configurable: true, value: 220 });
    Object.defineProperty(panel!, 'scrollTop', { configurable: true, writable: true, value: 0 });

    flushSync(() => {
      root.render(
        <SidebarChatMessages
          renderMessages={[
            {
              id: 'assistant-1',
              sender: 'assistant',
              blocks: [],
            },
          ]}
          uiState={{
            isStreaming: false,
            statusMessage: null,
            showWaitingRow: false,
            showQuickPromptWelcome: false,
            showTempSkeleton: false,
            showContextSkeleton: false,
            lastTextAssistantId: null,
          }}
          isHidden={false}
          sessionId="session-1"
          hasMoreHistory
          onLoadMoreHistory={onLoadMoreHistory}
        />
      );
    });

    await Promise.resolve();
    expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);

    flushSync(() => {
      root.unmount();
    });
  });
});
