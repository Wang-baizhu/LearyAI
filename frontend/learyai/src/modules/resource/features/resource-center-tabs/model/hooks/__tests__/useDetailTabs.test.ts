// useDetailTabs.test.ts 负责验证资源中心详情标签的打开、更新与关闭分支。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  useMemo: vi.fn((factory: () => unknown) => factory()),
  useCallback: vi.fn((fn: (...args: never[]) => unknown) => fn),
  useEffect: vi.fn((effect: () => void | (() => void)) => effect()),
  useRef: vi.fn((initialValue: unknown) => ({ current: initialValue })),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: mocks.useState,
    useMemo: mocks.useMemo,
    useCallback: mocks.useCallback,
    useEffect: mocks.useEffect,
    useRef: mocks.useRef,
  };
});

import useDetailTabs, { buildDetailTabKey } from '../../useDetailTabs';

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

describe('useDetailTabs', () => {
  beforeEach(() => {
    ensureWindow();
    mocks.useState.mockReset();
    mocks.useMemo.mockClear();
    mocks.useCallback.mockClear();
    mocks.useEffect.mockClear();
    mocks.useRef.mockClear();
  });

  it('buildDetailTabKey 会按 kind 生成稳定的详情标签 key', () => {
    expect(buildDetailTabKey('kbdoc', 'doc-1')).toBe('doc:doc-1');
    expect(buildDetailTabKey('template', 'tpl-1')).toBe('template:tpl-1');
    expect(buildDetailTabKey('video', 'doc-1')).toBe('video:doc-1');
  });

  it('handleOpenDetailTab 会新增详情标签，并在同 key 已存在时更新字段', () => {
    queueStateValues(
      'all',
      'all',
      [
        {
          key: 'doc:doc-1',
          label: '旧标题',
          kind: 'kbdoc',
          docId: 'doc-1',
        },
      ],
      {},
      {},
      null
    );

    const tabs = useDetailTabs();
    const setters = (mocks.useState.mock.results.map((item) => item.value?.[1]) as Array<ReturnType<typeof vi.fn>>);
    setters.forEach((setter) => setter.mockClear());

    tabs.handleOpenDetailTab({
      docId: 'doc-2',
      kind: 'kbdoc',
      label: '新文档',
    });

    const createDetailTab = setters[2].mock.calls[0][0] as (prev: never[]) => never[];
    expect(
      createDetailTab([])
    ).toEqual([
      {
        key: 'doc:doc-2',
        label: '新文档',
        kind: 'kbdoc',
        docId: 'doc-2',
        templateId: undefined,
        jumpToPage: undefined,
        jumpToken: undefined,
      },
    ]);
    expect(setters[1]).toHaveBeenCalledWith('doc:doc-2');

    tabs.handleOpenDetailTab({
      docId: 'doc-1',
      kind: 'kbdoc',
      label: '更新标题',
      templateId: 'tpl-1',
      jumpToPage: 4,
      jumpToken: 9,
    });

    const updateDetailTab = setters[2].mock.calls[1][0] as (prev: typeof queueStateValues extends never ? never : never[]) => never[];
    expect(
      updateDetailTab([
        {
          key: 'doc:doc-1',
          label: '旧标题',
          kind: 'kbdoc',
          docId: 'doc-1',
        },
      ] as never[])
    ).toEqual([
      {
        key: 'doc:doc-1',
        label: '更新标题',
        kind: 'kbdoc',
        docId: 'doc-1',
        templateId: 'tpl-1',
        jumpToPage: 4,
        jumpToken: 9,
      },
    ]);
  });

  it('handleCloseSingleDetailTab 会在单标签与分组标签两种情况下更新活跃面板', () => {
    queueStateValues(
      'all',
      'doc:child',
      [
        { key: 'doc:root', label: 'Root', kind: 'kbdoc', docId: 'root' },
        { key: 'doc:child', label: 'Child', kind: 'kbdoc', docId: 'child' },
      ],
      { 'doc:child': 'doc:root' },
      { 'doc:root': 'doc:child' },
      null
    );

    const tabs = useDetailTabs();
    const setters = (mocks.useState.mock.results.map((item) => item.value?.[1]) as Array<ReturnType<typeof vi.fn>>);
    setters.forEach((setter) => setter.mockClear());

    tabs.handleCloseSingleDetailTab('doc:child');

    const detailTabsUpdater = setters[2].mock.calls[0][0] as (prev: never[]) => never[];
    expect(
      detailTabsUpdater([
        { key: 'doc:root', label: 'Root', kind: 'kbdoc', docId: 'root' },
        { key: 'doc:child', label: 'Child', kind: 'kbdoc', docId: 'child' },
      ] as never[])
    ).toEqual([{ key: 'doc:root', label: 'Root', kind: 'kbdoc', docId: 'root' }]);

    const mergedParentUpdater = setters[3].mock.calls[0][0] as (prev: Record<string, string>) => Record<string, string>;
    expect(
      mergedParentUpdater({ 'doc:child': 'doc:root' })
    ).toEqual({});

    const groupActiveUpdater = setters[4].mock.calls[0][0] as (prev: Record<string, string>) => Record<string, string>;
    expect(
      groupActiveUpdater({ 'doc:root': 'doc:child' })
    ).toEqual({ 'doc:root': 'doc:root' });

    const activePanelUpdater = setters[1].mock.calls[0][0] as (current: string) => string;
    expect(activePanelUpdater('doc:child')).toBe('doc:root');
  });
});
