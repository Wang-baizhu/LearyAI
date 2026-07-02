// @vitest-environment jsdom
// SidebarSubagentSwitcher.test.tsx 负责验证主/子会话悬浮切换器的展开与收起行为。
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SidebarSubagentSwitcher from '../SidebarSubagentSwitcher';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe('SidebarSubagentSwitcher', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (!container || !root) {
      return;
    }
    act(() => {
      root?.unmount();
    });
    container.remove();
    container = null;
    root = null;
  });

  it('默认展开，并支持收起后只保留极简标识', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <SidebarSubagentSwitcher
          sessions={[
            {
              sessionId: 'agent-1',
              parentSessionId: 'session-1',
              subagentType: 'coder',
              title: '修复器',
              status: 'completed',
              updatedAt: '2026-06-29T00:00:00Z',
              pendingPermissionCount: 1,
              pendingQuestionCount: 0,
            },
            {
              sessionId: 'agent-2',
              parentSessionId: 'session-1',
              subagentType: 'researcher',
              title: '分析器',
              status: 'running_background',
              updatedAt: '2026-06-29T00:00:00Z',
              pendingPermissionCount: 0,
              pendingQuestionCount: 2,
            },
          ]}
          activeView={{ kind: 'subagent', sessionId: 'agent-1' }}
          onSelectMain={vi.fn()}
          onSelectSubagent={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('主 Agent');
    expect(container.textContent).toContain('分析器');

    const toggleButton = container.querySelector('button');
    expect(toggleButton).not.toBeNull();

    act(() => {
      toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('当前会话视图');
    expect(container.textContent).not.toContain('主 Agent');
    expect(container.textContent).not.toContain('分析器');
    expect(container.textContent).not.toContain('修复器');
    expect(container.textContent).toContain('子');
  });

  it('从空列表切换到有子会话时不会触发 Hook 顺序错误', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <SidebarSubagentSwitcher
          sessions={[]}
          activeView={{ kind: 'main' }}
          onSelectMain={vi.fn()}
          onSelectSubagent={vi.fn()}
        />
      );
    });

    expect(container.textContent).toBe('');

    act(() => {
      root.render(
        <SidebarSubagentSwitcher
          sessions={[
            {
              sessionId: 'agent-1',
              parentSessionId: 'session-1',
              subagentType: 'coder',
              title: '修复器',
              status: 'completed',
              updatedAt: '2026-06-29T00:00:00Z',
              pendingPermissionCount: 0,
              pendingQuestionCount: 0,
            },
          ]}
          activeView={{ kind: 'subagent', sessionId: 'agent-1' }}
          onSelectMain={vi.fn()}
          onSelectSubagent={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('修复器');
    expect(container.textContent).toContain('主 Agent');
  });

  it('点击切换目标后会自动收起面板', () => {
    const onSelectSubagent = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <SidebarSubagentSwitcher
          sessions={[
            {
              sessionId: 'agent-1',
              parentSessionId: 'session-1',
              subagentType: 'coder',
              title: '修复器',
              status: 'completed',
              updatedAt: '2026-06-29T00:00:00Z',
              pendingPermissionCount: 0,
              pendingQuestionCount: 0,
            },
          ]}
          activeView={{ kind: 'main' }}
          onSelectMain={vi.fn()}
          onSelectSubagent={onSelectSubagent}
        />
      );
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(1);

    act(() => {
      buttons[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectSubagent).toHaveBeenCalledWith('agent-1');
    expect(container.textContent).not.toContain('主 Agent');
    expect(container.textContent).not.toContain('修复器');
    expect(container.textContent).toContain('主');
  });
});
