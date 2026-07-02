// @vitest-environment jsdom
// SidebarAddResourceModal.test.tsx 负责验证资源引用弹窗的筛选与关闭重置行为。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { SidebarResource } from '@/modules/kbdoc';
import SidebarAddResourceModal from '../SidebarAddResourceModal';

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe('SidebarAddResourceModal', () => {
  it('reopens with cleared keyword after closing', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const resources: SidebarResource[] = [
      {
        id: '1',
        code: 'resource-1',
        title: '数学笔记',
        description: '数学复习资料',
        type: 'DOC',
        icon: 'book',
        category: 'study',
      },
      {
        id: '2',
        code: 'resource-2',
        title: '英语笔记',
        description: '英语复习资料',
        type: 'DOC',
        icon: 'book',
        category: 'study',
      },
    ];

    flushSync(() => {
      root.render(
        <SidebarAddResourceModal
          isOpen
          resources={resources}
          onClose={vi.fn()}
          selectedResourceIds={[]}
          onToggleResource={vi.fn()}
        />
      );
    });

    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    expect(valueSetter).toBeTypeOf('function');
    valueSetter!.call(input, '数学');
    input!.dispatchEvent(new Event('input', { bubbles: true }));

    expect(container.textContent).toContain('数学笔记');
    expect(container.textContent).not.toContain('英语笔记');

    flushSync(() => {
      root.render(<></>);
    });

    flushSync(() => {
      root.render(
        <SidebarAddResourceModal
          isOpen
          resources={resources}
          onClose={vi.fn()}
          selectedResourceIds={[]}
          onToggleResource={vi.fn()}
        />
      );
    });

    const reopenedInput = container.querySelector('input') as HTMLInputElement | null;
    expect(reopenedInput).not.toBeNull();
    expect(reopenedInput!.value).toBe('');
    expect(container.textContent).toContain('数学笔记');
    expect(container.textContent).toContain('英语笔记');

    flushSync(() => {
      root.unmount();
    });
  });
});
