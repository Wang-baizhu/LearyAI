// @vitest-environment jsdom
// ImagePreviewViewport.test.tsx 负责验证图片预览跳页状态机的等待与重试行为。
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImagePreview from '../ImagePreview';

const setOffsetTop = (element: HTMLElement, value: number) => {
  Object.defineProperty(element, 'offsetTop', {
    configurable: true,
    get: () => value,
  });
};

const originalScrollTo = HTMLDivElement.prototype.scrollTo;

describe('ImagePreviewViewport', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
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
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(function complete(this: HTMLImageElement) {
      return this.dataset.loaded === 'true';
    });
  });

  afterEach(() => {
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

  it('会等待目标页及其前置页图片完成后再完成跳转', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onJumpHandled = vi.fn();

    flushSync(() => {
      root.render(
        <ImagePreview
          pages={[
            { pageNumber: 10, url: 'https://example.com/page-10.png' },
            { pageNumber: 11, url: 'https://example.com/page-11.png' },
            { pageNumber: 12, url: 'https://example.com/page-12.png' },
          ]}
          jumpToPage={12}
          jumpToken={1}
          onJumpHandled={onJumpHandled}
        />
      );
    });

    const scrollContainer = container.querySelector('.custom-scrollbar') as HTMLDivElement | null;
    const pageElements = Array.from(container.querySelectorAll<HTMLElement>('[data-page-number]'));
    expect(scrollContainer).not.toBeNull();
    expect(pageElements).toHaveLength(3);

    setOffsetTop(pageElements[0], 0);
    setOffsetTop(pageElements[1], 320);
    setOffsetTop(pageElements[2], 640);

    const images = pageElements.map((element) => element.querySelector('img') as HTMLImageElement | null);
    expect(images.every(Boolean)).toBe(true);
    expect(onJumpHandled).not.toHaveBeenCalled();

    flushSync(() => {
      images[0]!.dataset.loaded = 'true';
      images[0]!.dispatchEvent(new Event('load'));
      images[1]!.dataset.loaded = 'true';
      images[1]!.dispatchEvent(new Event('load'));
    });
    expect(onJumpHandled).not.toHaveBeenCalled();

    flushSync(() => {
      images[2]!.dataset.loaded = 'true';
      images[2]!.dispatchEvent(new Event('load'));
    });

    expect(scrollContainer?.scrollTop).toBe(616);
    expect(onJumpHandled).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Page 12');

    flushSync(() => {
      root.unmount();
    });
    container.remove();
  });

  it('会在目标页后续进入已加载窗口时继续完成待处理跳转', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onJumpHandled = vi.fn();

    flushSync(() => {
      root.render(
        <ImagePreview
          pages={[
            { pageNumber: 20, url: 'https://example.com/page-20.png' },
            { pageNumber: 21, url: 'https://example.com/page-21.png' },
          ]}
          jumpToPage={23}
          jumpToken={2}
          onJumpHandled={onJumpHandled}
        />
      );
    });

    expect(container.querySelectorAll('[data-page-number]')).toHaveLength(2);
    expect(onJumpHandled).not.toHaveBeenCalled();

    flushSync(() => {
      root.render(
        <ImagePreview
          pages={[
            { pageNumber: 20, url: 'https://example.com/page-20.png' },
            { pageNumber: 21, url: 'https://example.com/page-21.png' },
            { pageNumber: 22, url: 'https://example.com/page-22.png' },
            { pageNumber: 23, url: 'https://example.com/page-23.png' },
          ]}
          jumpToPage={23}
          jumpToken={2}
          onJumpHandled={onJumpHandled}
        />
      );
    });

    const scrollContainer = container.querySelector('.custom-scrollbar') as HTMLDivElement | null;
    const pageElements = Array.from(container.querySelectorAll<HTMLElement>('[data-page-number]'));
    expect(scrollContainer).not.toBeNull();
    expect(pageElements).toHaveLength(4);

    setOffsetTop(pageElements[0], 0);
    setOffsetTop(pageElements[1], 320);
    setOffsetTop(pageElements[2], 640);
    setOffsetTop(pageElements[3], 960);

    const images = pageElements.map((element) => element.querySelector('img') as HTMLImageElement | null);
    expect(images.every(Boolean)).toBe(true);

    flushSync(() => {
      images[0]!.dataset.loaded = 'true';
      images[0]!.dispatchEvent(new Event('load'));
      images[1]!.dataset.loaded = 'true';
      images[1]!.dispatchEvent(new Event('load'));
      images[2]!.dataset.loaded = 'true';
      images[2]!.dispatchEvent(new Event('load'));
    });
    expect(onJumpHandled).not.toHaveBeenCalled();

    flushSync(() => {
      images[3]!.dataset.loaded = 'true';
      images[3]!.dispatchEvent(new Event('load'));
    });

    expect(scrollContainer?.scrollTop).toBe(936);
    expect(onJumpHandled).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Page 23');

    flushSync(() => {
      root.unmount();
    });
    container.remove();
  });

  it('清理跳页参数后不会因为组件重挂载而回到顶部', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onJumpHandled = vi.fn();

    flushSync(() => {
      root.render(
        <ImagePreview
          pages={[
            { pageNumber: 30, url: 'https://example.com/page-30.png' },
            { pageNumber: 31, url: 'https://example.com/page-31.png' },
            { pageNumber: 32, url: 'https://example.com/page-32.png' },
          ]}
          jumpToPage={32}
          jumpToken={3}
          onJumpHandled={onJumpHandled}
        />
      );
    });

    const scrollContainer = container.querySelector('.custom-scrollbar') as HTMLDivElement | null;
    const pageElements = Array.from(container.querySelectorAll<HTMLElement>('[data-page-number]'));
    expect(scrollContainer).not.toBeNull();
    expect(pageElements).toHaveLength(3);

    setOffsetTop(pageElements[0], 0);
    setOffsetTop(pageElements[1], 320);
    setOffsetTop(pageElements[2], 640);

    const images = pageElements.map((element) => element.querySelector('img') as HTMLImageElement | null);
    expect(images.every(Boolean)).toBe(true);

    flushSync(() => {
      images[0]!.dataset.loaded = 'true';
      images[0]!.dispatchEvent(new Event('load'));
      images[1]!.dataset.loaded = 'true';
      images[1]!.dispatchEvent(new Event('load'));
      images[2]!.dataset.loaded = 'true';
      images[2]!.dispatchEvent(new Event('load'));
    });

    expect(scrollContainer?.scrollTop).toBe(616);
    expect(container.textContent).toContain('Page 32');

    flushSync(() => {
      root.render(
        <ImagePreview
          pages={[
            { pageNumber: 30, url: 'https://example.com/page-30.png' },
            { pageNumber: 31, url: 'https://example.com/page-31.png' },
            { pageNumber: 32, url: 'https://example.com/page-32.png' },
          ]}
          onJumpHandled={onJumpHandled}
        />
      );
    });

    expect(scrollContainer?.scrollTop).toBe(616);
    expect(container.textContent).toContain('Page 32');

    flushSync(() => {
      root.unmount();
    });
    container.remove();
  });
});
