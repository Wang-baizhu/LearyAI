// DockSidebar.detail-override.test.tsx 负责验证白板内嵌详情覆盖层的状态切换。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  useEffect: vi.fn((effect: () => void | (() => void)) => effect()),
  useCallback: vi.fn((fn: (...args: never[]) => unknown) => fn),
  useRef: vi.fn((initialValue: unknown) => ({ current: initialValue })),
  useDroppable: vi.fn(),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
  useResourceScope: vi.fn(() => ({ projectId: 'project-1', kbId: 'kb-1' })),
  ResourceCenterContent: vi.fn((props: any) => (
    <div data-testid="resource-center-content">
      {props.detailState?.detailKind ?? 'none'}
    </div>
  )),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    useState: mocks.useState,
    useEffect: mocks.useEffect,
    useCallback: mocks.useCallback,
    useRef: mocks.useRef,
  };
});

vi.mock('@dnd-kit/core', () => ({
  useDroppable: mocks.useDroppable,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

vi.mock('../../../resource-center-main', () => ({
  ResourceCenterContent: mocks.ResourceCenterContent,
}));

vi.mock('../../../../entities/resource-center', () => ({
  useResourceScope: mocks.useResourceScope,
}));

import DockSidebar from '../DockSidebar';

const ensureWindow = () => {
  if (!('window' in globalThis)) {
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      configurable: true,
    });
  }
};

const makeSetter = () => vi.fn();

const queueStateValues = (...values: unknown[]) => {
  values.forEach((value) => {
    mocks.useState.mockImplementationOnce(() => [value, makeSetter()]);
  });
};

describe('DockSidebar detail override', () => {
  beforeEach(() => {
    ensureWindow();
    mocks.useState.mockReset();
    mocks.useEffect.mockClear();
    mocks.useCallback.mockClear();
    mocks.useRef.mockClear();
    mocks.useDroppable.mockReset();
    mocks.MaterialIcon.mockClear();
    mocks.ResourceCenterContent.mockClear();
    mocks.useDroppable.mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: false,
    });
  });

  it('会在白板详情中打开节点时写入覆盖详情状态', () => {
    queueStateValues(
      false,
      384,
      false,
      null,
      'resource',
      undefined,
      null
    );

    renderToStaticMarkup(
      <DockSidebar
        dockedPanel="kbdoc"
        tabDropZoneId="sidebar-zone"
        resources={[{ docId: 'doc-1', name: '文档一' } as any]}
        referencedResources={[]}
        referencedDocRefs={[]}
        fallbackDocRef={null}
        listState={null}
        onToggleReference={vi.fn()}
        onToggleListReference={vi.fn()}
        referencedDocIds={[]}
        onClearReferences={vi.fn()}
        onPageChange={vi.fn()}
        onResourceDeleted={vi.fn()}
        sidebarDetailTab={{
          key: 'whiteboard:board-1',
          docId: 'board-1',
          label: '白板一',
          kind: 'whiteboard',
        }}
        onClearSidebarDetail={vi.fn()}
        onOpenVideoDetailTab={vi.fn()}
        isDarkMode={false}
        toggleTheme={vi.fn()}
      />
    );

    const detailState = mocks.ResourceCenterContent.mock.calls[0][0].detailState;
    const overrideSetter = mocks.useState.mock.results[6].value[1] as ReturnType<typeof vi.fn>;

    detailState.onOpenResourceDetailTab('doc-2');

    expect(overrideSetter).toHaveBeenCalledWith({
      docId: 'doc-2',
      detailKind: 'kbdoc',
    });
  });
});
