// @vitest-environment jsdom
// 职责: 验证 PPT 样式编辑颜色控件仅在调整结束后再提交样式变更。
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PptStyleEditorFields } from './pptStyleEditorUi';
import type { PptEditSelectionSnapshot } from './pptEditProtocol';

const selection: PptEditSelectionSnapshot = {
  selector: '[data-block-id="title"]',
  tagName: 'section',
  text: '季度复盘',
  rect: {
    x: 72,
    y: 48,
    width: 620,
    height: 68,
  },
  style: {
    color: 'rgba(15, 23, 42, 1)',
    fontSize: '28px',
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 1)',
    opacity: '1',
    zIndex: '2',
    left: '72px',
    top: '48px',
    width: '620px',
    height: '68px',
  },
};

describe('PptStyleEditorFields', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('debounces palette updates until the adjustment settles', () => {
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 19 act 测试开关。
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onFieldChange = vi.fn();

    act(() => {
      root.render(
        <PptStyleEditorFields
          selection={selection}
          onFieldChange={onFieldChange}
        />,
      );
    });

    const paletteButton = container.querySelector<HTMLButtonElement>('button[title="#2563eb"]');
    expect(paletteButton).toBeDefined();

    act(() => {
      paletteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onFieldChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onFieldChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(onFieldChange).toHaveBeenCalledTimes(1);
    expect(onFieldChange).toHaveBeenLastCalledWith('color', '#2563eb');

    act(() => {
      root.unmount();
    });
  });

  it('flushes the pending color update immediately when the field loses focus', () => {
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 19 act 测试开关。
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onFieldChange = vi.fn();

    act(() => {
      root.render(
        <PptStyleEditorFields
          selection={selection}
          onFieldChange={onFieldChange}
        />,
      );
    });

    const paletteButton = container.querySelector<HTMLButtonElement>('button[title="#2563eb"]');
    const fieldWrapper = container.querySelector('[aria-label="文字颜色调色板"]')?.parentElement;

    act(() => {
      paletteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fieldWrapper?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(onFieldChange).toHaveBeenCalledTimes(1);
    expect(onFieldChange).toHaveBeenLastCalledWith('color', '#2563eb');

    act(() => {
      vi.advanceTimersByTime(200);
      root.unmount();
    });
    expect(onFieldChange).toHaveBeenCalledTimes(1);
  });
});
