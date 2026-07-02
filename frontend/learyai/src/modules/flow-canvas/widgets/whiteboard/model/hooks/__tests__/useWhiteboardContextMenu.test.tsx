// useWhiteboardContextMenu.test.tsx 负责验证白板右键菜单对资源节点的复制入口约束。
import { describe, expect, it, vi } from 'vitest';

import {
  buildNodeContextMenuOptions,
  buildSelectionContextMenuOptions,
} from '..';

describe('buildNodeContextMenuOptions', () => {
  it('资源节点右键菜单不展示复制节点', () => {
    const options = buildNodeContextMenuOptions(
      {
        id: 'kbdoc:doc-1',
        data: { label: '文档 1' },
      } as never,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );

    expect(options.map((option) => option.label)).toEqual(['编辑内容', '删除节点']);
  });

  it('普通节点右键菜单仍展示复制节点', () => {
    const options = buildNodeContextMenuOptions(
      {
        id: 'custom-node',
        data: { label: '普通节点' },
      } as never,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );

    expect(options.map((option) => option.label)).toEqual(['编辑内容', '复制节点', '删除节点']);
  });
});

describe('buildSelectionContextMenuOptions', () => {
  it('纯资源节点选区不展示复制节点', () => {
    const options = buildSelectionContextMenuOptions(
      ['kbdoc:doc-1', 'template:template-1'],
      [],
      vi.fn(),
      vi.fn()
    );

    expect(options.map((option) => option.label)).toEqual(['删除选中项']);
  });

  it('混合选区复制时只传递普通节点', () => {
    const duplicateNodeIds = vi.fn();
    const options = buildSelectionContextMenuOptions(
      ['kbdoc:doc-1', 'custom-node'],
      [],
      duplicateNodeIds,
      vi.fn()
    );

    expect(options.map((option) => option.label)).toEqual(['复制节点', '删除选中项']);
    options[0]?.onClick();
    expect(duplicateNodeIds).toHaveBeenCalledWith(['custom-node']);
  });
});
