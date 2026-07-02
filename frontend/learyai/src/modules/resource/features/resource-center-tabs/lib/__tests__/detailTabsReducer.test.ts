// detailTabsReducer.test.ts 负责验证资源中心详情标签分组的纯状态迁移逻辑。
import { describe, expect, it } from 'vitest';
import {
  reduceCloseDetailTabGroup,
  reduceDetachDetailTab,
  reduceMergeDetailTabs,
  resolveDetailRootKey,
} from '../detailTabsReducer';

const detailTabs = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];

describe('detailTabsReducer', () => {
  it('resolveDetailRootKey 会沿父映射追溯根节点', () => {
    expect(
      resolveDetailRootKey('c', {
        c: 'b',
        b: 'a',
      })
    ).toBe('a');
  });

  it('reduceMergeDetailTabs 会把源分组合并到目标分组，并更新激活成员', () => {
    const result = reduceMergeDetailTabs<string, { key: string }>({
      detailTabs,
      mergedParentMap: {
        b: 'a',
        d: 'c',
      },
      groupActiveMemberMap: {
        a: 'b',
        c: 'b',
      },
      sourceKey: 'a',
      targetKey: 'c',
      activeDetailKey: 'b',
    });

    expect(result.changed).toBe(true);
    expect(result.mergedParentMap).toEqual({
      a: 'c',
      b: 'c',
      d: 'c',
    });
    expect(result.groupActiveMemberMap).toEqual({
      c: 'b',
    });
    expect(result.nextActiveDetailKey).toBe('a');
  });

  it('reduceDetachDetailTab 会在子成员脱组时移除父映射，并在必要时重置组内激活成员', () => {
    const result = reduceDetachDetailTab<string, { key: string }>({
      key: 'b',
      detailTabs,
      mergedParentMap: {
        b: 'a',
        c: 'a',
      },
      groupActiveMemberMap: {
        a: 'b',
      },
    });

    expect(result.changed).toBe(true);
    expect(result.mergedParentMap).toEqual({
      c: 'a',
    });
    expect(result.groupActiveMemberMap).toEqual({
      a: 'a',
    });
    expect(result.nextActiveDetailKey).toBe('b');
  });

  it('reduceDetachDetailTab 会在根节点脱组时重选新的根和激活成员', () => {
    const result = reduceDetachDetailTab<string, { key: string }>({
      key: 'a',
      detailTabs,
      mergedParentMap: {
        b: 'a',
        c: 'a',
      },
      groupActiveMemberMap: {
        a: 'c',
      },
    });

    expect(result.changed).toBe(true);
    expect(result.mergedParentMap).toEqual({
      c: 'b',
    });
    expect(result.groupActiveMemberMap).toEqual({
      b: 'c',
    });
    expect(result.nextActiveDetailKey).toBe('a');
  });

  it('reduceCloseDetailTabGroup 会关闭整组标签并清理映射', () => {
    const result = reduceCloseDetailTabGroup<string, { key: string }>({
      key: 'b',
      detailTabs,
      mergedParentMap: {
        b: 'a',
        c: 'a',
      },
      groupActiveMemberMap: {
        a: 'c',
      },
    });

    expect(result.closeRoot).toBe('a');
    expect(Array.from(result.membersToClose)).toEqual(['a', 'b', 'c']);
    expect(result.detailTabs).toEqual([{ key: 'd' }]);
    expect(result.mergedParentMap).toEqual({});
    expect(result.groupActiveMemberMap).toEqual({});
  });
});
