// ImagePreview.test.tsx 负责验证图片预览在跳页场景下的加载策略。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ImagePreview from '../ImagePreview';

describe('ImagePreview', () => {
  it('会将跳页目标页及其前置页标记为 eager，避免高度未稳定时就开始定位', () => {
    const html = renderToStaticMarkup(
      <ImagePreview
        pages={[
          { pageNumber: 14, url: 'https://example.com/page-14.png' },
          { pageNumber: 15, url: 'https://example.com/page-15.png' },
        ]}
        jumpToPage={15}
      />
    );

    expect(html).toContain('page-14.png');
    expect(html).toContain('page-15.png');
    expect(html.match(/loading="eager"/g)).toHaveLength(2);
  });

  it('会为移动端图片预览提供满宽图片和全屏查看入口', () => {
    const html = renderToStaticMarkup(
      <ImagePreview
        pages={[
          { pageNumber: 1, url: 'https://example.com/page-1.png' },
        ]}
      />
    );

    expect(html).toContain('class="w-full overflow-hidden rounded-2xl');
    expect(html).toContain('class="w-full max-w-full cursor-zoom-in');
    expect(html).toContain('aria-label="全屏查看第 1 页"');
    expect(html).toContain('Page 1');
    expect(html).not.toContain('Page 1 /');
  });

  it('会在全屏预览实现里保留缩放控制入口', () => {
    const html = renderToStaticMarkup(
      <ImagePreview
        pages={[
          { pageNumber: 7, url: 'https://example.com/page-7.png' },
        ]}
      />
    );

    expect(html).toContain('全屏查看第 7 页');
    expect(html).toContain('Page 7');
    expect(html).not.toContain('totalPages');
  });
});
