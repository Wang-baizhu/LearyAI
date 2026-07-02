// ResourceGrid.test.tsx 负责验证资源卡片列表与空状态。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  DeleteResourceAction: vi.fn(({ docId }: any) => <button data-testid="delete-action">{docId}</button>),
  MaterialIcon: vi.fn(({ name }: any) => <span data-icon={name} />),
}));

vi.mock('../../../../features/delete-resource', () => ({
  default: mocks.DeleteResourceAction,
}));

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: mocks.MaterialIcon,
}));

import ResourceGrid from '../ResourceGrid';

describe('ResourceGrid', () => {
  it('在没有资源时会渲染空状态', () => {
    const html = renderToStaticMarkup(
      <ResourceGrid items={[]} onOpen={vi.fn()} />
    );

    expect(html).toContain('暂无资源');
  });

  it('会渲染资源卡片，并区分处理中、已引用与可删除状态', () => {
    const onToggleReference = vi.fn();
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(
      <ResourceGrid
        items={[
          {
            docId: 'doc-1',
            name: 'Doc 1',
            fileType: 'pdf',
            status: 'DONE',
          } as any,
          {
            docId: 'doc-2',
            name: 'Doc 2',
            fileType: 'md',
            status: 'PROCESSING',
          } as any,
          {
            docId: 'doc-3',
            name: 'Doc 3',
            fileType: 'docx',
            status: 'DONE',
          } as any,
        ]}
        onOpen={onOpen}
        projectId="project-1"
        referencedDocIds={['doc-1']}
        onToggleReference={onToggleReference}
        onResourceDeleted={vi.fn()}
      />
    );

    expect(html).toContain('已引用');
    expect(html).toContain('请等待处理完成');
    expect(html).toContain('absolute right-4 top-4 z-10 flex items-start gap-2');
    expect(html).toContain('border-slate-200 bg-slate-100 text-slate-500');
    expect(html).toContain('pr-24');
    expect(html).toContain('markdown');
    expect(html).toContain('picture_as_pdf');
    expect(html).toContain('data-testid="delete-action"');
    expect(mocks.DeleteResourceAction).toHaveBeenCalledTimes(6);
  });

  it('会为 url 资源渲染链接图标', () => {
    const longUrl = 'https://www.bilibili.com/video/BV1EVq2BDEgf?from=search&seid=1234567890abcdef';
    const html = renderToStaticMarkup(
      <ResourceGrid
        items={[
          {
            docId: 'doc-url',
            name: longUrl,
            fileType: 'url',
            status: 'DONE',
          } as any,
        ]}
        onOpen={vi.fn()}
      />
    );

    expect(html).toContain('link');
    expect(html).toContain('https://www.bilibili.com/video/BV1EVq2BDEgf...');
    expect(html).toContain('title="https://www.bilibili.com/video/BV1EVq2BDEgf?from=search&amp;seid=1234567890abcdef"');
  });
});
