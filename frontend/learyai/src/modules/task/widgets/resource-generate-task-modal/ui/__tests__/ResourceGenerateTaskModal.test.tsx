// @vitest-environment jsdom
// ResourceGenerateTaskModal.test.tsx 负责验证生成任务弹窗的默认引用显示与切换行为。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  resolveDocReferenceState: vi.fn(),
  useQuery: vi.fn(() => ({
    isLoading: false,
    isError: false,
    data: undefined,
  })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@leary/ui', () => ({
  Modal: ({ isOpen, title, children }: React.PropsWithChildren<{ isOpen: boolean; title: string }>) =>
    isOpen ? (
      <div data-testid="modal">
        <div>{title}</div>
        {children}
      </div>
    ) : null,
  ErrorDialog: () => null,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@/shared/lib/formatters', () => ({
  formatUrlDisplayName: (value: string) => value,
}));

vi.mock('../../../../../resource', () => ({
  resolveDocReferenceState: mocks.resolveDocReferenceState,
  resourceFlowCanvasApi: {
    getResourceCatalog: vi.fn(),
  },
}));

vi.mock('../../../../entities', () => ({
  taskApi: {
    createTask: mocks.createTask,
  },
}));

import ResourceGenerateTaskModal from '../ResourceGenerateTaskModal';

describe('ResourceGenerateTaskModal', () => {
  beforeEach(() => {
    mocks.createTask.mockReset();
    mocks.resolveDocReferenceState.mockReset();
    mocks.useQuery.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const resources = [
    {
      docId: 'doc-1',
      name: '文档一',
      status: 'DONE',
    },
    {
      docId: 'doc-2',
      name: '文档二',
      status: 'DONE',
    },
  ] as any[];

  const renderModal = () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <ResourceGenerateTaskModal
          isOpen
          type="mindmap"
          resources={resources}
          projectId="project-1"
          kbId="kb-1"
          onClose={vi.fn()}
        />
      );
    });

    return { container, root };
  };

  it('会把默认已引用文档展示为已引用并在提交时带上 docRefs', async () => {
    mocks.resolveDocReferenceState.mockImplementation(({ docId }: { docId: string }) => docId === 'doc-1');
    mocks.createTask.mockResolvedValue(undefined);

    const { container, root } = renderModal();

    expect(container.textContent).toContain('当前已选 1 条引用');
    const docOneButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('文档一')
    );
    expect(docOneButton?.textContent).toContain('已引用');

    const submitButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('确认生成')
    );
    expect(submitButton).toBeDefined();

    submitButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PROCESSING',
        changeType: 'status_snapshot',
        pipelineContext: expect.objectContaining({
          docRefs: [{ id: 'doc-1', name: '文档一' }],
        }),
      })
    );

    flushSync(() => {
      root.unmount();
    });
  });

  it('首次切换未引用文档时不会丢失默认已引用集合', () => {
    mocks.resolveDocReferenceState.mockImplementation(({ docId }: { docId: string }) => docId === 'doc-1');

    const { container, root } = renderModal();

    const docTwoButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('文档二')
    );
    expect(docTwoButton).toBeDefined();

    flushSync(() => {
      docTwoButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前已选 2 条引用');
    const docOneButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('文档一')
    );
    const updatedDocTwoButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('文档二')
    );
    expect(docOneButton?.textContent).toContain('已引用');
    expect(updatedDocTwoButton?.textContent).toContain('已引用');

    flushSync(() => {
      root.unmount();
    });
  });
});
