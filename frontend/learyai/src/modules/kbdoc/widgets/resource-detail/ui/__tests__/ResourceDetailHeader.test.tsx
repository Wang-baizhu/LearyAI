// ResourceDetailHeader.test.tsx 负责验证资源详情头部的标题编辑布局与动作区渲染。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/ui/icons/MaterialIcon', () => ({
  default: vi.fn(({ name }: any) => <span data-icon={name} />),
}));

import ResourceDetailHeader from '../ResourceDetailHeader';

describe('ResourceDetailHeader', () => {
  it('会将资源名称编辑按钮渲染在标题右侧，避免覆盖标题文本', () => {
    const html = renderToStaticMarkup(
      <ResourceDetailHeader
        canOpenVideoDetail={false}
        onRequestTextEdit={vi.fn()}
        resource={{
          docId: 'doc-1',
          name: '这是一个很长很长的资源标题用于验证编辑按钮不再遮挡文本内容',
          fileType: 'pdf',
        } as any}
        resourceMeta="2026-05-09"
      />
    );

    expect(html).toContain('这是一个很长很长的资源标题用于验证编辑按钮不再遮挡文本内容');
    expect(html).toContain('flex min-w-0 items-start gap-3');
    expect(html).toContain('leary-editable-text--inline');
    expect(html).toContain('min-w-0 flex-1');
    expect(html).toContain('mt-1');
  });
});
