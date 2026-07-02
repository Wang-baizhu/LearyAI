// @vitest-environment jsdom
// EditResourceAction.test.tsx 负责验证对象型 documentation 在目录编辑弹窗中的回填。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  Modal: vi.fn(({ isOpen, children, title }: any) => (isOpen ? <div data-testid="modal">{title}{children}</div> : null)),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  useAppDispatch: vi.fn(),
  openDialog: vi.fn((payload: any) => ({ type: 'ui/openDialog', payload })),
  enqueueToast: vi.fn((payload: any) => ({ type: 'ui/enqueueToast', payload })),
  renameReferenceResource: vi.fn((payload: any) => ({ type: 'resource/renameReferenceResource', payload })),
  upsertDocNames: vi.fn((payload: any) => ({ type: 'resource/upsertDocNames', payload })),
  resolveApiErrorMessage: vi.fn(() => '更新失败，请稍后重试'),
  useUpdateResourceDetail: vi.fn(),
}));

vi.mock('@leary/ui', () => ({
  Modal: mocks.Modal,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('@/app/store/hooks', () => ({
  useAppDispatch: mocks.useAppDispatch,
}));

vi.mock('@/app/store/ui/dialogSlice', () => ({
  openDialog: mocks.openDialog,
}));

vi.mock('@/app/store/ui/toastSlice', () => ({
  enqueueToast: mocks.enqueueToast,
}));

vi.mock('@/modules/resource', () => ({
  renameReferenceResource: mocks.renameReferenceResource,
  upsertDocNames: mocks.upsertDocNames,
}));

vi.mock('@/shared/api/resolveApiError', () => ({
  resolveApiErrorMessage: mocks.resolveApiErrorMessage,
}));

vi.mock('../../../../entities/resource', () => ({
  useUpdateResourceDetail: mocks.useUpdateResourceDetail,
}));

import EditResourceAction from '../EditResourceAction';

describe('EditResourceAction', () => {
  beforeEach(() => {
    mocks.Modal.mockClear();
    mocks.MaterialIcon.mockClear();
    mocks.useAppDispatch.mockReset();
    mocks.openDialog.mockClear();
    mocks.enqueueToast.mockClear();
    mocks.renameReferenceResource.mockClear();
    mocks.upsertDocNames.mockClear();
    mocks.resolveApiErrorMessage.mockClear();
    mocks.useUpdateResourceDetail.mockReset();
    mocks.useAppDispatch.mockReturnValue(vi.fn());
    mocks.useUpdateResourceDetail.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue({
        docId: 'doc-1',
        name: '新资源名称',
      }),
    });
  });

  it('会把对象型 documentation 回填为 JSON 字符串', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <EditResourceAction
          projectId="project-1"
          resource={{
            docId: 'doc-1',
            name: '旧资源名称',
            fileType: 'pdf',
            size: 1,
            createdAt: '2026-03-29',
            metadata: {
              description: '旧描述',
              documentation: {
                version: 1,
                nodes: [
                  {
                    id: 'chapter-1',
                    title: '第一章',
                    summary: '摘要',
                    page_start: 1,
                    page_end: 2,
                    children: [],
                  },
                ],
              },
            },
          }}
        />
      );
    });

    const openButton = container.querySelector('button[aria-label="编辑目录"]');
    expect(openButton).not.toBeNull();

    flushSync(() => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toContain('"version": 1');
    expect(textarea?.value).toContain('"title": "第一章"');

    flushSync(() => {
      root.unmount();
    });
  });
});
