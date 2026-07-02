// ResourceTabChip.test.tsx 负责验证顶部 chip 的主要交互分支。
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

import ResourceTabChip from '../ResourceTabChip';

describe('ResourceTabChip', () => {
  beforeEach(() => {
    mocks.useDraggable.mockReset();
    mocks.useDroppable.mockReset();
    mocks.MaterialIcon.mockClear();
    mocks.useDraggable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: undefined,
      isDragging: false,
    });
    mocks.useDroppable.mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: false,
    });
  });

  it('会在 compact 状态下渲染激活 chip 与关闭入口', () => {
    const html = renderToStaticMarkup(
      <ResourceTabChip
        tab={{ key: 'doc:1', label: 'Doc 1', closable: true } as any}
        activePanel="doc:1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        draggable
        compact
        mergeDropZoneId="merge:doc:1"
      />
    );

    expect(html).toContain('Doc 1');
    expect(html).toContain('bg-primary text-white');
    expect(html).toContain('max-w-[112px]');
    expect(html).toContain('sm:max-w-[160px]');
    expect(html).toContain('aria-label="关闭标签"');
    expect(html).toContain('data-icon="close"');
  });

  it('会在非激活状态下保留普通 chip 样式，并支持无关闭入口的渲染', () => {
    mocks.useDroppable.mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: true,
    });

    const html = renderToStaticMarkup(
      <ResourceTabChip
        tab={{ key: 'all', label: 'All', closable: false } as any}
        activePanel="doc:1"
        onSelect={vi.fn()}
      />
    );

    expect(html).toContain('All');
    expect(html).toContain('border-b-2');
    expect(html).toContain('max-w-[128px]');
    expect(html).toContain('sm:max-w-[200px]');
    expect(html).not.toContain('aria-label="关闭标签"');
  });

  it('会对禁用标签输出禁用态样式', () => {
    const html = renderToStaticMarkup(
      <ResourceTabChip
        tab={{ key: 'card', label: '记忆卡', disabled: true } as any}
        activePanel="all"
        onSelect={vi.fn()}
      />
    );

    expect(html).toContain('记忆卡');
    expect(html).toContain('cursor-not-allowed');
    expect(html).toContain('opacity-45');
    expect(html).toContain('disabled=""');
  });
});
