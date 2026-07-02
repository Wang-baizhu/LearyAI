// panel.test.ts 负责验证资源中心标签类型守卫与常量定义。
import { describe, expect, it } from 'vitest';
import {
  DETAIL_GROUP_DRAG_ID_PREFIX,
  DETAIL_MERGE_DROP_ZONE_PREFIX,
  RESOURCE_CENTER_TAB_KEYS,
  SIDEBAR_TAB_DROP_ZONE_ID,
  isDetailTabKey,
  isResourceCenterTab,
} from './panel';

describe('resource center panel types', () => {
  it('会暴露稳定的静态面板常量', () => {
    expect(RESOURCE_CENTER_TAB_KEYS).toEqual(['all', 'kbdoc']);
    expect(SIDEBAR_TAB_DROP_ZONE_ID).toBe('resource-center-sidebar-drop-zone');
    expect(DETAIL_MERGE_DROP_ZONE_PREFIX).toBe('resource-center-merge-target:');
    expect(DETAIL_GROUP_DRAG_ID_PREFIX).toBe('resource-center-group-drag:');
  });

  it('会正确判断资源中心标签与详情标签 key', () => {
    expect(isResourceCenterTab('all')).toBe(true);
    expect(isResourceCenterTab('mindmap')).toBe(true);
    expect(isResourceCenterTab('ai')).toBe(false);
    expect(isDetailTabKey('doc:abc')).toBe(true);
    expect(isDetailTabKey('template:abc')).toBe(true);
    expect(isDetailTabKey('video:abc')).toBe(true);
    expect(isDetailTabKey('mindmap')).toBe(false);
  });
});
