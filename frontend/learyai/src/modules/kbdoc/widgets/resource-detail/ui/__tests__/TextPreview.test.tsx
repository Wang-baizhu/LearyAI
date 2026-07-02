// @vitest-environment jsdom
// TextPreview.test.tsx 负责验证文本预览跳转完成后清参时仍保持当前视口位置。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../RichTextMarkdown', () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

import TextPreview from '../TextPreview';

const setOffsetTop = (element: HTMLElement, value: number) => {
  Object.defineProperty(element, 'offsetTop', {
    configurable: true,
    get: () => value,
  });
};

const originalScrollTo = HTMLDivElement.prototype.scrollTo;

describe('TextPreview', () => {
  const animationFrameCallbacks: FrameRequestCallback[] = [];
  const flushAnimationFrames = () => {
    const callbacks = animationFrameCallbacks.splice(0);
    callbacks.forEach((callback) => callback(0));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
      configurable: true,
      value: function scrollTo(this: HTMLDivElement, options?: ScrollToOptions | number) {
        if (typeof options === 'number') {
          this.scrollTop = options;
          return;
        }
        this.scrollTop = options?.top ?? 0;
      },
    });
  });

  afterEach(() => {
    animationFrameCallbacks.length = 0;
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalScrollTo) {
      Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
        configurable: true,
        value: originalScrollTo,
      });
      return;
    }
    delete (HTMLDivElement.prototype as { scrollTo?: unknown }).scrollTo;
  });

  it('清理跳转参数后不会回到顶部，并保持当前段落页码', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onJumpHandled = vi.fn();

    flushSync(() => {
      root.render(
        <TextPreview
          chunks={[
            { chunkSec: 30, text: 'chunk-30' },
            { chunkSec: 31, text: 'chunk-31' },
            { chunkSec: 32, text: 'chunk-32' },
          ]}
          jumpToChunk={32}
          jumpToken={4}
          onJumpHandled={onJumpHandled}
          maxHeightClassName="h-full"
        />
      );
    });

    const scrollContainer = container.querySelector('.custom-scrollbar') as HTMLDivElement | null;
    const chunkElements = Array.from(container.querySelectorAll<HTMLElement>('[data-chunk-sec]'));
    expect(scrollContainer).not.toBeNull();
    expect(chunkElements).toHaveLength(3);

    setOffsetTop(chunkElements[0], 0);
    setOffsetTop(chunkElements[1], 0);
    setOffsetTop(chunkElements[2], 0);

    flushSync(() => {
      root.render(
        <TextPreview
          chunks={[
            { chunkSec: 30, text: 'chunk-30' },
            { chunkSec: 31, text: 'chunk-31' },
            { chunkSec: 32, text: 'chunk-32' },
          ]}
          jumpToChunk={32}
          jumpToken={3}
          onJumpHandled={onJumpHandled}
          maxHeightClassName="h-full"
        />
      );
    });

    flushSync(() => {
      flushAnimationFrames();
      flushAnimationFrames();
    });

    expect(scrollContainer?.scrollTop).toBe(0);
    expect(onJumpHandled).not.toHaveBeenCalled();

    setOffsetTop(chunkElements[0], 0);
    setOffsetTop(chunkElements[1], 320);
    setOffsetTop(chunkElements[2], 640);

    flushSync(() => {
      vi.advanceTimersByTime(80);
      flushAnimationFrames();
    });

    expect(scrollContainer?.scrollTop).toBe(616);
    expect(onJumpHandled).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Page 32');

    flushSync(() => {
      root.render(
        <TextPreview
          chunks={[
            { chunkSec: 30, text: 'chunk-30' },
            { chunkSec: 31, text: 'chunk-31' },
            { chunkSec: 32, text: 'chunk-32' },
          ]}
          onJumpHandled={onJumpHandled}
          maxHeightClassName="h-full"
        />
      );
    });

    flushSync(() => {
      vi.runAllTimers();
    });

    expect(scrollContainer?.scrollTop).toBe(616);
    expect(container.textContent).toContain('Page 32');
    expect(onJumpHandled).toHaveBeenCalledTimes(1);

    flushSync(() => {
      root.unmount();
    });
    container.remove();
  });
});
