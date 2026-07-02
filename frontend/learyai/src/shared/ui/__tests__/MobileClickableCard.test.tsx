// @vitest-environment jsdom
// MobileClickableCard.test.tsx 负责验证移动端卡片壳的点击、禁用与键盘交互。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import MobileClickableCard from '../MobileClickableCard';

describe('MobileClickableCard', () => {
  it('会在点击时触发 onClick', () => {
    const onClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <MobileClickableCard onClick={onClick}>
          <span>card</span>
        </MobileClickableCard>
      );
    });

    const card = container.querySelector('[role="button"]');
    expect(card).not.toBeNull();
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
    flushSync(() => {
      root.unmount();
    });
  });

  it('在禁用时不会触发 onClick', () => {
    const onClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <MobileClickableCard onClick={onClick} disabled>
          <span>card</span>
        </MobileClickableCard>
      );
    });

    const card = container.firstElementChild as HTMLElement | null;
    expect(card?.getAttribute('role')).toBeNull();
    expect(card?.getAttribute('tabindex')).toBeNull();
    card?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).not.toHaveBeenCalled();
    flushSync(() => {
      root.unmount();
    });
  });

  it('支持通过 Enter 和 Space 触发', () => {
    const onClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    flushSync(() => {
      root.render(
        <MobileClickableCard onClick={onClick}>
          <span>card</span>
        </MobileClickableCard>
      );
    });

    const card = container.querySelector('[role="button"]');
    expect(card).not.toBeNull();
    card?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    card?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(2);
    flushSync(() => {
      root.unmount();
    });
  });
});
