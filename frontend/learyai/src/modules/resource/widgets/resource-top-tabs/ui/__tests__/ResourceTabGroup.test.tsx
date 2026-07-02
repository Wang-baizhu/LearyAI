// ResourceTabGroup.test.tsx 负责验证顶部聚合分组的静态渲染。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useDraggable: vi.fn(),
  useDroppable: vi.fn(),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
}));

vi.mock('@dnd-kit/core', () => ({
  useDraggable: mocks.useDraggable,
  useDroppable: mocks.useDroppable,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

import ResourceTabGroup from '../ResourceTabGroup';

describe('ResourceTabGroup', () => {
  beforeEach(() => {
    mocks.useDraggable.mockReset();
    mocks.useDroppable.mockReset();
    mocks.MaterialIcon.mockClear();
    mocks.useDraggable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      transform: { x: 4, y: 8 },
      isDragging: true,
    });
    mocks.useDroppable.mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: true,
    });
  });

  it('会渲染成员 chip、拖拽手柄与关闭按钮', () => {
    const html = renderToStaticMarkup(
      <ResourceTabGroup
        tab={{ key: 'doc:1', label: 'Doc 1', closable: true } as any}
        members={[
          { key: 'doc:1', label: 'Doc 1' },
          { key: 'doc:1b', label: 'Doc 1B' },
        ] as any}
        activeTopPanel="doc:1"
        activePanel="doc:1"
        onSelect={vi.fn()}
        onCloseGroup={vi.fn()}
        onCloseSingle={vi.fn()}
        mergeDropZoneId="merge:doc:1"
      />
    );

    expect(html).toContain('Doc 1');
    expect(html).toContain('Doc 1B');
    expect(html).toContain('合并落点');
    expect(html).toContain('拖拽分组');
    expect(html).toContain('关闭聚合标签');
    expect(html).toContain('max-w-[var(--group-collapsed-mobile)]');
    expect(html).toContain('sm:max-w-[var(--group-collapsed)]');
    expect(html).toContain('border-primary/70');
    expect(html).toContain('opacity-70');
  });
});
