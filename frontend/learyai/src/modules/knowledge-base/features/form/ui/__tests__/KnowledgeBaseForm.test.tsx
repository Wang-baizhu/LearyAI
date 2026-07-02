// @vitest-environment jsdom
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@leary/tour-guide', () => ({
  TourStep: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import KnowledgeBaseForm from '../KnowledgeBaseForm';

describe('KnowledgeBaseForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('会提交知识库基础字段，不再携带模板插件配置', async () => {
    const onSubmit = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <KnowledgeBaseForm
          defaultProjectId="project-1"
          projects={[{ projectId: 'project-1', name: '项目 A' } as never]}
          initialValues={{
            name: '知识库 A',
            description: '面向客服问答',
            tags: ['客服', 'FAQ'],
            visibility: 'PRIVATE',
          }}
          requireProject
          submitLabel="保存修改"
          onSubmit={onSubmit}
        />
      );
    });

    flushSync(() => {
      vi.runAllTimers();
    });
    await Promise.resolve();
    flushSync(() => {});

    const form = container.querySelector('form');
    expect(form?.className).toContain('max-h-[calc(100dvh-12rem)]');
    expect(form?.className).toContain('flex');
    expect(form?.className).toContain('flex-col');
    expect(form?.className).toContain('min-h-0');
    expect(container.querySelector('.md\\:grid-cols-2')).not.toBeNull();
    expect(container.textContent).toContain('保存修改');
    expect(form).not.toBeNull();

    flushSync(() => {
      const projectSelect = container.querySelector('select');
      projectSelect?.dispatchEvent(new Event('change', { bubbles: true }));
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: '知识库 A',
      description: '面向客服问答',
      tags: ['客服', 'FAQ'],
      visibility: 'PRIVATE',
    }));

    root.unmount();
    container.remove();
  });
});
