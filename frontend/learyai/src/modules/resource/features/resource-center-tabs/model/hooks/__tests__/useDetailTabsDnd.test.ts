// useDetailTabsDnd.test.ts 负责验证资源中心详情标签拖拽的核心分支。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useState: vi.fn((initialValue: unknown) => [initialValue, vi.fn()]),
  useCallback: vi.fn((fn: (...args: never[]) => unknown) => fn),
  useSensor: vi.fn(),
  useSensors: vi.fn((...args: unknown[]) => args),
  pointerWithin: vi.fn(),
  rectIntersection: vi.fn(),
  detailTabsMap: new Map(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: mocks.useState,
    useCallback: mocks.useCallback,
  };
});

vi.mock('@dnd-kit/core', () => ({
  PointerSensor: 'PointerSensor',
  pointerWithin: mocks.pointerWithin,
  rectIntersection: mocks.rectIntersection,
  useSensor: mocks.useSensor,
  useSensors: mocks.useSensors,
}));

import useDetailTabsDnd from '../../useDetailTabsDnd';

describe('useDetailTabsDnd', () => {
  beforeEach(() => {
    mocks.useState.mockClear();
    mocks.useCallback.mockClear();
    mocks.useSensor.mockClear();
    mocks.useSensors.mockClear();
    mocks.pointerWithin.mockClear();
    mocks.rectIntersection.mockClear();
    mocks.detailTabsMap = new Map([
      ['doc:root', { key: 'doc:root', label: 'Root' }],
      ['doc:child', { key: 'doc:child', label: 'Child' }],
      ['doc:target', { key: 'doc:target', label: 'Target' }],
    ]);
  });

  it('collisionWithFallback 会优先返回 sidebar 命中，否则回退到 pointerWithin / rectIntersection', () => {
    mocks.pointerWithin.mockReturnValueOnce([
      { id: 'sidebar-zone' },
      { id: 'other' },
    ]);

    const collision = useDetailTabsDnd({
      sidebarDropZoneId: 'sidebar-zone',
      detailMergeDropZonePrefix: 'merge:',
      detailGroupDragIdPrefix: 'group:',
      detailTabs: [],
      detailTabsMap: new Map(),
      activePanel: 'all',
      getDetailRootKey: (key) => key,
      handleDetachDetailTab: vi.fn(),
      mergeDetailTabs: vi.fn(),
      setActivePanel: vi.fn(),
      setSidebarDetailTab: vi.fn(),
    });

    expect(mocks.useSensor).toHaveBeenCalledWith('PointerSensor', {
      activationConstraint: { distance: 6 },
    });
    expect(mocks.useSensors).toHaveBeenCalledTimes(1);

    const args = { active: { id: 'doc:child' }, collisions: [] } as never;
    expect(collision.collisionWithFallback(args)).toEqual([{ id: 'sidebar-zone' }]);

    mocks.pointerWithin.mockReturnValueOnce([{ id: 'doc:child' }]);
    expect(collision.collisionWithFallback(args)).toEqual([{ id: 'doc:child' }]);

    mocks.pointerWithin.mockReturnValueOnce([]);
    mocks.rectIntersection.mockReturnValueOnce([{ id: 'fallback' }]);
    expect(collision.collisionWithFallback(args)).toEqual([{ id: 'fallback' }]);
  });

  it('拖拽开始/结束会按分组、侧边栏和合并目标触发对应回调', () => {
    const handleDetachDetailTab = vi.fn();
    const mergeDetailTabs = vi.fn();
    const setActivePanel = vi.fn();
    const setSidebarDetailTab = vi.fn();

    const dnd = useDetailTabsDnd({
      sidebarDropZoneId: 'sidebar-zone',
      detailMergeDropZonePrefix: 'merge:',
      detailGroupDragIdPrefix: 'group:',
      detailTabs: [
        { key: 'doc:root', label: 'Root' },
        { key: 'doc:child', label: 'Child' },
      ] as never[],
      detailTabsMap: mocks.detailTabsMap as never,
      activePanel: 'doc:child',
      getDetailRootKey: (key) => (key === 'doc:child' ? 'doc:root' : key),
      handleDetachDetailTab,
      mergeDetailTabs,
      setActivePanel,
      setSidebarDetailTab,
    });

    dnd.handleTabDragStart({ active: { id: 'doc:child' } } as never);
    expect(handleDetachDetailTab).toHaveBeenCalledWith('doc:child');
    expect(dnd.isTabDragging).toBe(false);

    dnd.handleTabDragEnd({
      active: { id: 'doc:child' },
      over: { id: 'sidebar-zone' },
    } as never);
    expect(setSidebarDetailTab).toHaveBeenCalledWith({ key: 'doc:child', label: 'Child' });

    dnd.handleTabDragEnd({
      active: { id: 'doc:child' },
      over: { id: 'merge:doc:target' },
    } as never);
    expect(mergeDetailTabs).toHaveBeenCalledWith('doc:child', 'doc:target');
    expect(setActivePanel).toHaveBeenCalledWith('doc:child');

    dnd.handleTabDragEnd({
      active: { id: 'group:doc:child' },
      over: null,
    } as never);
    expect(dnd.handleTabDragCancel).toBeInstanceOf(Function);
  });
});
