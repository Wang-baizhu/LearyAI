// RichTextMarkdown.test.tsx 负责验证资源文本预览中 citation 与 timestamp 可同时渲染。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/store/hooks', () => ({
  useAppSelector: (selector: (state: any) => unknown) =>
    selector({
      resourceCenter: {
        docNameMap: {
          'doc-1': '需求文档',
          'doc-2': '设计文档',
          'doc-3': '说明文档',
        },
      },
    }),
}));

import RichTextMarkdown from '../RichTextMarkdown';

describe('RichTextMarkdown', () => {
  it('会同时渲染 citation 标签与 timestamp 按钮', () => {
    const html = renderToStaticMarkup(
      <RichTextMarkdown
        text={'参考([doc-1][1]) 并跳转到[00:00:07-00:00:10]'}
        onCitationClick={() => undefined}
        onTimestampClick={() => undefined}
      />
    );

    expect(html).toContain('P1');
    expect(html).toContain('00:00:07-00:00:10');
    expect(html).toContain('点击打开 PDF 第 1 页');
  });

  it('会解析单个 docId 下的多个页码', () => {
    const html = renderToStaticMarkup(
      <RichTextMarkdown
        text={'先声明([doc-2][2][4-5])'}
        onCitationClick={() => undefined}
      />
    );

    expect(html).toContain('点击打开 PDF 第 2 页');
    expect(html).toContain('点击打开 PDF 第 4-5 页');
    expect(html).toContain('P2');
    expect(html).toContain('P4-5');
  });

  it('会把 page 标记通过插件渲染为 citation 标签', () => {
    const html = renderToStaticMarkup(
      <RichTextMarkdown
        text={'先看(page: 8-9)，再跳转到[00:00:07-00:00:10]'}
        pageMarkerDocId="doc-3"
        onCitationClick={() => undefined}
        onTimestampClick={() => undefined}
      />
    );

    expect(html).toContain('P8-9');
    expect(html).toContain('00:00:07-00:00:10');
    expect(html).toContain('点击打开 PDF 第 8-9 页');
  });

  it('会把一个 docId 后的多个 page 渲染为单个 citation 内的多个页码按钮', () => {
    const html = renderToStaticMarkup(
      <RichTextMarkdown
        text={'参考([doc-1][11][70][8-9])'}
        onCitationClick={() => undefined}
      />
    );

    expect((html.match(/inline-flex max-w-full items-center gap-2/g) ?? []).length).toBe(1);
    expect(html).toContain('点击打开 PDF 第 11 页');
    expect(html).toContain('点击打开 PDF 第 70 页');
    expect(html).toContain('点击打开 PDF 第 8-9 页');
    expect(html).toContain('P11');
    expect(html).toContain('P70');
    expect(html).toContain('P8-9');
  });
});
