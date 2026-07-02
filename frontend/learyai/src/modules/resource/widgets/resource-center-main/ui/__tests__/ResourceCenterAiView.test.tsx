// ResourceCenterAiView.test.tsx 负责验证 AI 面板的静态渲染。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  AIChatPanel: vi.fn((props: any) => (
    <div data-testid="ai-chat">
      {props.resources.length}|{props.referencedResources.length}|{props.isCollapsed ? 'collapsed' : 'expanded'}
    </div>
  )),
  useResourceScope: vi.fn(() => ({ projectId: 'project-1', kbId: 'kb-1' })),
}));

vi.mock('../../../../../ai-chat', () => ({
  AIChatPanel: mocks.AIChatPanel,
}));

vi.mock('../../../../entities/resource-center', () => ({
  useResourceScope: mocks.useResourceScope,
}));

import ResourceCenterAiView from '../ResourceCenterAiView';

describe('ResourceCenterAiView', () => {
  it('在缺少 aiState 时返回空内容', () => {
    const html = renderToStaticMarkup(<ResourceCenterAiView variant="main" />);

    expect(html).toBe('');
    expect(mocks.AIChatPanel).not.toHaveBeenCalled();
  });

  it('会按 sidebar 变体渲染 AIChatPanel 并传递折叠状态', () => {
    const html = renderToStaticMarkup(
      <ResourceCenterAiView
        variant="sidebar"
        isCollapsed
        onToggleCollapsed={vi.fn()}
        aiState={{
          resources: [{ docId: 'doc-1' } as any],
          referencedResources: [{ docId: 'doc-2' } as any],
          referencedDocRefs: [{ id: 'doc-2', name: 'Doc Two' }],
          onToggleReference: vi.fn(),
          onClearReferences: vi.fn(),
          showCollapseToggle: true,
        }}
      />
    );

    expect(html).toContain('flex-1 min-h-0 h-full overflow-hidden');
    expect(html).toContain('1|1|collapsed');
    expect(mocks.AIChatPanel).toHaveBeenCalledTimes(1);
    expect(mocks.AIChatPanel.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        isCollapsed: true,
        showCollapseToggle: true,
        projectId: 'project-1',
        kbId: 'kb-1',
      })
    );
  });
});
