// useResourceFlowCanvasBoard.test.ts 负责验证白板节点打开时的详情路由分流。
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  useMemo: vi.fn((factory: () => unknown) => factory()),
  useCallback: vi.fn((fn: (...args: never[]) => unknown) => fn),
  useEffect: vi.fn((effect: () => void | (() => void)) => effect()),
  useRef: vi.fn((initialValue: unknown) => ({ current: initialValue })),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  getResourceDetail: vi.fn(),
  getCanvas: vi.fn(),
  getResourceCatalog: vi.fn(),
  updateCanvas: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    useState: mocks.useState,
    useMemo: mocks.useMemo,
    useCallback: mocks.useCallback,
    useEffect: mocks.useEffect,
    useRef: mocks.useRef,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useMutation: mocks.useMutation,
}));

vi.mock('@/modules/kbdoc', () => ({
  resourceApi: {
    getResourceDetail: mocks.getResourceDetail,
  },
}));

vi.mock('../../effects/api', () => ({
  resourceFlowCanvasApi: {
    getCanvas: mocks.getCanvas,
    getResourceCatalog: mocks.getResourceCatalog,
    updateCanvas: mocks.updateCanvas,
  },
}));

import { useResourceFlowCanvasBoard } from '../useResourceFlowCanvasBoard';

const ensureWindow = () => {
  if (!('window' in globalThis)) {
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      configurable: true,
    });
  }
};

describe('useResourceFlowCanvasBoard', () => {
  beforeEach(() => {
    ensureWindow();
    mocks.useState.mockReset();
    mocks.useMemo.mockClear();
    mocks.useCallback.mockClear();
    mocks.useEffect.mockClear();
    mocks.useRef.mockClear();
    mocks.useQuery.mockReset();
    mocks.useMutation.mockReset();
    mocks.getResourceDetail.mockReset();
    mocks.getCanvas.mockReset();
    mocks.getResourceCatalog.mockReset();
    mocks.updateCanvas.mockReset();

    mocks.useQuery.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      isError: false,
    }));
    mocks.useMutation.mockImplementation(() => ({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }));
    mocks.useState.mockImplementation((initialValue: unknown) => [initialValue, vi.fn()]);
  });

  it('会在打开 kbdoc 节点时补查资源详情并保留视频路由', async () => {
    const onOpenDetailTab = vi.fn();

    const board = useResourceFlowCanvasBoard('project-1', 'kb-1', onOpenDetailTab);
    board.handleEvent({
      type: 'nodeOpened',
      nodeId: 'node-1',
      label: '节点标题',
      refId: 'doc-1',
      refKind: 'kbdoc',
    });

    expect(onOpenDetailTab).toHaveBeenCalledWith({
      docId: 'doc-1',
      label: '节点标题',
      kind: 'kbdoc',
    });
  });

  it('会在打开普通 kbdoc 节点时保持资源路由', async () => {
    const onOpenDetailTab = vi.fn();

    const board = useResourceFlowCanvasBoard('project-1', 'kb-1', onOpenDetailTab);
    board.handleEvent({
      type: 'nodeOpened',
      nodeId: 'node-2',
      label: '普通节点',
      refId: 'doc-2',
      refKind: 'kbdoc',
    });

    expect(onOpenDetailTab).toHaveBeenCalledWith({
      docId: 'doc-2',
      label: '普通节点',
      kind: 'kbdoc',
    });
  });
});
